import prisma from "../config/prisma.js";
import { refundPayment } from "./paystack.js";

// Refund a payment exactly once, even when cancellation and late-payment
// verification race each other. `refundedAt` is the claim: only the request
// that sets it may call Paystack.
export async function refundPaymentOnce(payment) {
  const claim = await prisma.payment.updateMany({
    where: { id: payment.id, refundedAt: null },
    data: { refundedAt: new Date() },
  });

  if (claim.count === 0) {
    return { ok: true, alreadyRefunded: true };
  }

  const { refunded, data } = await refundPayment(payment.reference);

  if (!refunded) {
    // Release the claim so a later retry can try again.
    await prisma.payment.updateMany({
      where: { id: payment.id, refundReference: null },
      data: { refundedAt: null },
    });
    return { ok: false, data };
  }

  // Keep the original Paystack transaction payload; append the refund data.
  const previous =
    payment.gatewayResponse && typeof payment.gatewayResponse === "object"
      ? payment.gatewayResponse
      : {};

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      refundReference:
        data?.reference != null
          ? String(data.reference)
          : data?.id != null
            ? String(data.id)
            : "queued",
      gatewayResponse: { ...previous, refund: data },
    },
  });

  return { ok: true, alreadyRefunded: false, data };
}
