import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { verifyPayment, resolveAccount, listBanks } from "../services/paystack.js";
import { notify } from "../services/events.js";
import crypto from "node:crypto";

const router = express.Router();

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
          restaurant: true,
        },
      }),
    ]);

    // Notify the restaurant owner that a new paid order just arrived (SSE).
    notify("order:updated", [updatedOrder.restaurant.ownerId]);

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
