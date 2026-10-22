import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { verifyPayment, resolveAccount, listBanks } from "../services/paystack.js";
import { notify } from "../services/events.js";
import crypto from "node:crypto";

const PUBLIC_RESTAURANT = {
  select: {
    id: true, name: true, description: true, imageUrl: true,
    address: true, phone: true, lat: true, lng: true, ownerId: true,
  },
};

// Webhook event → the only status transition it may make. The `from` guard is
// what makes duplicate and out-of-order deliveries harmless.
const TRANSFER_EVENTS = {
  "transfer.success": { status: "SUCCESS", from: ["PENDING"] },
  "transfer.failed": { status: "FAILED", from: ["PENDING"] },
  "transfer.reversed": { status: "REVERSED", from: ["SUCCESS"] },
};

const router = express.Router();

// ── Paystack webhook: called by Paystack, not by users. There is no JWT here —
// the one-way authentication is the HMAC signature over the raw request body. ──
router.post("/payments/webhook", async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;

  // Fail closed on configuration errors rather than trusting an unsigned body.
  if (!secret) {
    console.error("[paystack-webhook] PAYSTACK_SECRET_KEY is not set");
    return res.status(500).json({ message: "Webhook not configured" });
  }
  const given = req.headers["x-paystack-signature"];
  if (!req.rawBody || !given) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  const expected = crypto
    .createHmac("sha512", secret)
    .update(req.rawBody)
    .digest("hex");

  // timingSafeEqual throws when lengths differ, so check length first.
  if (given.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return res.status(401).json({ message: "Invalid webhook signature" });
  }

  const event = req.body?.event;
  const data = req.body?.data;
  const reference = data?.reference;
  const transition = TRANSFER_EVENTS[event];

  if (transition && reference) {
    try {
      // Idempotent by design: the status guard means a replayed event matches
      // zero rows and changes nothing. It also ignores out-of-order events,
      // e.g. a late "failed" arriving after a confirmed "success".
      const result = await prisma.payout.updateMany({
        where: { reference, status: { in: transition.from } },
        data: { status: transition.status, gatewayResponse: data },
      });
      console.log(
        `[paystack-webhook] ${event} ref=${reference} updated=${result.count}`
      );
    } catch (error) {
      // 500 so Paystack retries — a DB outage must not silently drop the event.
      console.error(`[paystack-webhook] update failed for ${reference}:`, error);
      return res.status(500).json({ message: "Webhook processing failed" });
    }
  } else {
    console.log(`[paystack-webhook] ignored event=${event} ref=${reference}`);
  }

  res.status(200).json({ received: true });
});

router.post("/payments/verify", authMiddleware, async (req, res, next) => {
  try {
    const { reference } = req.body;

    if (!reference || typeof reference !== "string") {
      return res.status(400).json({ message: "Payment reference is required" });
    }

    // 1. Find the payment in our database
    const payment = await prisma.payment.findUnique({
      where: { reference },
      include: { order: true },
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment reference not found" });
    }

    // 2. Idempotent: if already verified, return existing data
    if (payment.status === "SUCCESS") {
      return res.status(200).json({
        message: "Payment already verified",
        payment,
        order: payment.order,
      });
    }

    // 3. Verify with Paystack
    const { verified, data: paystackData } = await verifyPayment(reference);

    if (!verified) {
      // Payment failed or was declined
      await prisma.payment.update({
        where: { reference },
        data: {
          status: "FAILED",
          gatewayResponse: paystackData || {},
        },
      });

      return res.status(400).json({
        message: "Payment verification failed — payment was not successful",
        paystackStatus: paystackData?.status || "unknown",
      });
    }

    // 4. Amount check: Paystack returns amount in kobo, ours is in Naira
    const paystackAmount = paystackData.amount; // in kobo
    const expectedAmount = Math.round(Number(payment.amount) * 100);

    if (paystackAmount !== expectedAmount) {
      return res.status(400).json({
        message: "Payment amount mismatch",
      });
    }

    // 5. Update payment and order status atomically
    const [updatedPayment, updatedOrder] = await prisma.$transaction([
      prisma.payment.update({
        where: { reference },
        data: {
          status: "SUCCESS",
          paidAt: new Date(),
          gatewayResponse: paystackData,
        },
      }),
      prisma.order.update({
        where: { id: payment.orderId },
        data: {
          status: "PENDING_RESTAURANT_CONFIRMATION",
          deliveryCode: crypto.randomInt(0, 10000).toString().padStart(4, "0"),
        },
        include: {
          orderItems: {
            include: {
              menuItem: { select: { name: true } },
            },
          },
          restaurant: PUBLIC_RESTAURANT,
        },
      }),
    ]);

    // Notify the customer (payment received) and the restaurant (new paid order).
    notify("order:updated", [updatedOrder.customerId, updatedOrder.restaurant.ownerId], {
      status: "PENDING_RESTAURANT_CONFIRMATION",
      customerId: updatedOrder.customerId,
      ownerId: updatedOrder.restaurant.ownerId,
      orderId: updatedOrder.id,
    });

    res.status(200).json({
      message: "Payment verified successfully",
      payment: updatedPayment,
      order: updatedOrder,
    });
  } catch (error) {
   next(error)
  }
});

// Resolve an account number + bank code to the account holder's name, so the
// owner/rider can confirm the name before saving bank details. Read-only —
// this does NOT create a transfer recipient, it just returns the name.
router.get("/payments/resolve-account", authMiddleware, async (req, res, next) => {
  try {
    const accountNumber = String(req.query.account_number || "");
    const bankCode = String(req.query.bank_code || "");

    if (!accountNumber || !bankCode) {
      return res.status(400).json({ message: "Account number and bank code are required" });
    }
    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({ message: "Account number must be 10 digits" });
    }

    const result = await resolveAccount({ accountNumber, bankCode });

    if (!result.ok) {
      return res.status(400).json({ message: result.message || "Could not resolve account" });
    }

    res.status(200).json({
      accountName: result.accountName,
      accountNumber,
      bankCode,
    });
  } catch (error) {
    next(error);
  }
});

// List banks for the bank-details dropdown (fetched from Paystack, not hardcoded).
router.get("/payments/banks", authMiddleware, async (req, res, next) => {
  try {
    const result = await listBanks();

    if (!result.ok) {
      return res.status(502).json({ message: result.message || "Could not load banks" });
    }

    res.status(200).json({ banks: result.banks });
  } catch (error) {
    next(error);
  }
});

export default router;
