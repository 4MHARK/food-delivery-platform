import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { verifyPayment } from "../services/paystack.js";

const router = express.Router();

router.post("/payments/verify", authMiddleware, async (req, res) => {
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
        data: { status: "PENDING_RESTAURANT_CONFIRMATION" },
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

    res.status(200).json({
      message: "Payment verified successfully",
      payment: updatedPayment,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("POST /payments/verify error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

export default router;
