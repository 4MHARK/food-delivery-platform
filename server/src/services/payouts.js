import prisma from "../config/prisma.js";
import { initiateTransfer } from "./paystack.js";
import crypto from "crypto";

const newReference = () => `CHOW-TRF-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

// Create one Payout row and (when bank details exist) fire the transfer.
// Returns null when there is nothing to pay out (zero/negative amount).
async function createAndRunPayout({ orderId, type, amountNaira, recipientCode, reason }) {
  if (amountNaira <= 0) return null;

  const reference = newReference();

  // No bank details yet → record the failure so the admin sees it; no transfer.
  if (!recipientCode) {
    return prisma.payout.create({
      data: {
        orderId,
        type,
        amount: amountNaira,
        recipientCode: null,
        reference,
        status: "FAILED",
        gatewayResponse: { reason: "bank details missing" },
      },
    });
  }

  const amountKobo = Math.round(amountNaira * 100);
  const result = await initiateTransfer({ recipientCode, amountKobo, reference, reason });

  return prisma.payout.create({
    data: {
      orderId,
      type,
      amount: amountNaira,
      recipientCode,
      reference,
      status: result.ok ? "SUCCESS" : "FAILED",
      gatewayResponse: result.ok ? result.data : { message: result.message, ...result.data },
    },
  });
}

// Split a delivered order's money: subtotal → restaurant, deliveryFee → rider.
// The platform keeps serviceFee (it never leaves the Paystack balance).
export async function settleOrderPayouts(orderId) {
  // Idempotency guard — never pay the same order twice.
  const existing = await prisma.payout.findFirst({ where: { orderId } });
  if (existing) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      restaurant: { select: { recipientCode: true, name: true } },
      delivery: { include: { rider: { select: { recipientCode: true } } } },
    },
  });

  if (!order) return;

  const payouts = [
    {
      orderId,
      type: "RESTAURANT",
      amountNaira: Number(order.subtotal),
      recipientCode: order.restaurant?.recipientCode || null,
      reason: `Payout for order #${orderId} (${order.restaurant?.name || "restaurant"})`,
    },
    {
      orderId,
      type: "RIDER",
      amountNaira: Number(order.deliveryFee),
      recipientCode: order.delivery?.rider?.recipientCode || null,
      reason: `Delivery fee for order #${orderId}`,
    },
  ];

  await Promise.all(payouts.map((p) => createAndRunPayout(p)));
}
