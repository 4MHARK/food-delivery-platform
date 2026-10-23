// A rider is flagged for manual review when this many failures land inside the
// window. Flagging is automatic; suspension stays an admin decision.
export const FAILURE_REVIEW_THRESHOLD = 3;
const FAILURE_WINDOW_DAYS = 7;

// Record a failed delivery attempt and update the rider's counters.
//
// Must be called inside the same transaction that marks the delivery FAILED:
// the audit row, the counter, and the failure itself commit together or not at
// all. `kind` is "REPORTED" for a rider-declared failure and "CODE_ATTEMPTS"
// when the handoff code was burned.
export async function recordDeliveryFailure(
  tx,
  { orderId, riderId, kind, reason, codeAttempts = 0 }
) {
  const createdAt = new Date();

  await tx.deliveryFailure.create({
    data: {
      orderId,
      riderId,
      kind,
      reason: reason || null,
      codeAttempts,
      createdAt,
    },
  });

  const since = new Date(createdAt.getTime() - FAILURE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recentFailures = await tx.deliveryFailure.count({
    where: { riderId, createdAt: { gte: since } },
  });

  await tx.rider.update({
    where: { id: riderId },
    data: {
      failureCount: { increment: 1 },
      lastFailureAt: createdAt,
      ...(recentFailures >= FAILURE_REVIEW_THRESHOLD && { flaggedForReview: true }),
    },
  });

  return recentFailures;
}
