import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { verifyPayment, resolveAccount, listBanks } from "../services/paystack.js";
import { refundPaymentOnce } from "../services/refunds.js";
import { PUBLIC_RESTAURANT } from "../utils/selects.js";
import { notify } from "../services/events.js";
import { generateDeliveryCode } from "../utils/deliveryCode.js";
import crypto from "node:crypto";

// Webhook event → the only status transition it may make. The `from` guard is
// what makes duplicate and out-of-order deliveries harmless.
const TRANSFER_EVENTS = {
  "transfer.success": { status: "SUCCESS", from: ["PENDING"] },
  "transfer.failed": { status: "FAILED", from: ["PENDING"] },
  "transfer.reversed": { status: "REVERSED", from: ["SUCCESS"] },
};

// Mark a Paystack-confirmed payment as SUCCESS and advance its order exactly
// once. Shared by client verification and the charge.success webhook.
async function applySuccessfulPayment(payment, paystackData) {
  const deliveryCode = generateDeliveryCode();

  const result = await prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCESS",
        paidAt: payment.paidAt ?? new Date(),
        // Keep the original transaction payload on duplicate events.
        gatewayResponse:
          payment.status === "SUCCESS" ? (payment.gatewayResponse ?? paystackData) : paystackData,
      },
    });

    const claimed = await tx.order.updateMany({
      where: { id: payment.orderId, status: "PENDING_PAYMENT" },
      data: { status: "PENDING_RESTAURANT_CONFIRMATION", deliveryCode },
    });

    const updatedOrder = await tx.order.findUnique({
      where: { id: payment.orderId },
      include: {
        orderItems: { include: { menuItem: { select: { name: true } } } },
        restaurant: PUBLIC_RESTAURANT,
      },
    });

    return { updatedPayment, updatedOrder, claimed: claimed.count };
  });

  if (result.claimed === 0 && result.updatedOrder?.status === "CANCELLED") {
    const paidAt = result.updatedPayment.paidAt
      ? new Date(result.updatedPayment.paidAt).getTime()
      : 0;
    const cancelledAt = new Date(result.updatedOrder.updatedAt).getTime();

    // Money that was already settled before the cancellation keeps the normal
    // cancellation policy; only a genuinely late payment gets auto-refunded.
    if (paidAt <= cancelledAt) {
      return { ...result, outcome: "cancelled" };
    }

    const refund = await refundPaymentOnce(result.updatedPayment);
    return {
      ...result,
      refund,
      outcome: refund.ok ? "cancelled_refunded" : "refund_failed",
    };
  }

  if (result.claimed === 1) {
    notify("order:updated", [result.updatedOrder.customerId, result.updatedOrder.restaurant.ownerId], {
      status: "PENDING_RESTAURANT_CONFIRMATION",
      customerId: result.updatedOrder.customerId,
      ownerId: result.updatedOrder.restaurant.ownerId,
      orderId: result.updatedOrder.id,
    });
    return { ...result, outcome: "settled" };
  }

  return { ...result, outcome: "already" };
}

// charge.success is the fallback for a customer whose client never reaches
// /payments/verify (app closed, connection dropped, etc.).
async function handleChargeSuccess(reference, data) {
  if (data?.status && data.status !== "success") {
    console.log(`[paystack-webhook] charge.success ref=${reference} status=${data.status} — ignored`);
    return { ok: true, ignored: true };
  }

  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { order: true },
  });

  if (!payment) {
    console.log(`[paystack-webhook] charge.success ref=${reference} — unknown payment`);
    return { ok: true, ignored: true };
  }

  const expectedAmount = Math.round(Number(payment.amount) * 100);
  if (Number(data.amount) !== expectedAmount) {
    console.error(
      `[paystack-webhook] charge.success ref=${reference} amount mismatch: got ${data.amount}, expected ${expectedAmount}`
    );
    return { ok: true, ignored: true };
  }

  const result = await applySuccessfulPayment(payment, data);
  console.log(`[paystack-webhook] charge.success ref=${reference} outcome=${result.outcome}`);
  return { ok: result.outcome !== "refund_failed", outcome: result.outcome };
}

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
  } else if (event === "charge.success" && reference) {
    try {
      const result = await handleChargeSuccess(reference, data);
      if (!result.ok) {
        // Refund failed — let Paystack retry the event.
        return res.status(500).json({ message: "Webhook processing failed" });
      }
    } catch (error) {
      console.error(`[paystack-webhook] charge.success failed for ${reference}:`, error);
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

    // Only the order's customer may verify/read its payment. Admins may do so
    // on a customer's behalf for support.
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user.role);
    if (payment.order.customerId !== req.user.id && !isAdmin) {
      return res.status(403).json({ message: "You are not allowed to verify this payment" });
    }

    // 2. Idempotent: if already verified, return existing data — but never
    // leave a cancelled order's payment unrefunded.
    if (payment.status === "SUCCESS") {
      if (payment.order.status === "CANCELLED") {
        // Only refund when the money landed *after* the cancellation. A paid
        // order cancelled outside its refund window must stay unrefunded.
        const paidAt = payment.paidAt ? new Date(payment.paidAt).getTime() : 0;
        const cancelledAt = new Date(payment.order.updatedAt).getTime();

        if (paidAt <= cancelledAt) {
          return res.status(409).json({ message: "This order was cancelled." });
        }

        // refundPaymentOnce is idempotent: if cancellation already refunded,
        // this returns ok without calling Paystack again.
        const refund = await refundPaymentOnce(payment);

        if (!refund.ok) {
          console.error(
            `[payments/verify] late payment ${reference} needs a refund but Paystack refused`,
            refund.data
          );
          return res.status(502).json({
            message: "This order was cancelled and the refund could not be started. Please contact support.",
          });
        }

        return res.status(409).json({
          message: "This order was cancelled before payment completed. Your payment has been refunded.",
        });
      }

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

    // 5. Apply the payment and advance the order exactly once.
    const result = await applySuccessfulPayment(payment, paystackData);

    if (result.outcome === "refund_failed") {
      console.error(
        `[payments/verify] late payment ${reference} needs a refund but Paystack refused`,
        result.refund?.data
      );
      return res.status(502).json({
        message: "Payment succeeded, but the order was cancelled and the refund could not be started. Please contact support.",
      });
    }

    if (result.outcome === "cancelled_refunded") {
      return res.status(409).json({
        message: "This order was cancelled before payment completed. Your payment has been refunded.",
      });
    }

    if (result.outcome === "cancelled") {
      return res.status(409).json({ message: "This order was cancelled." });
    }

    res.status(200).json({
      message: result.outcome === "settled" ? "Payment verified successfully" : "Payment already verified",
      payment: result.updatedPayment,
      order: result.updatedOrder,
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
