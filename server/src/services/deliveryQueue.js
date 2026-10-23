import prisma from "../config/prisma.js";
import { notify } from "./events.js";
import { recordDeliveryFailure } from "./accountability.js";
import { generateDeliveryCode } from "../utils/deliveryCode.js";

// Non-terminal statuses. A delivery in any of these still holds a rider and an
// order; everything else is finished.
export const ACTIVE_DELIVERY_STATUSES = [
  "ZILLA_ON_IT",
  "AT_KITCHEN",
  "BAGGED",
  "MOVING",
  "CLOSE_BY",
];

// Tell eligible riders on the same campus that an order is back in the queue.
// This is what makes a release visible immediately instead of waiting for the
// rider dashboard to be reloaded.
export async function notifyCampusRiders(order, { excludeUserId } = {}) {
  if (!order?.restaurant?.campusId) return;

  const riders = await prisma.rider.findMany({
    where: {
      campusId: order.restaurant.campusId,
      isAvailable: true,
      isVerified: true,
      isSuspended: false,
      ...(excludeUserId ? { userId: { not: excludeUserId } } : {}),
    },
    select: { userId: true },
  });

  const riderUserIds = riders.map((r) => r.userId);
  if (!riderUserIds.length) return;

  notify("order:updated", riderUserIds, {
    status: "READY_FOR_PICKUP",
    // Customer/owner already received the FAILED notification; null here stops
    // this rider-facing event from pushing to them a second time.
    customerId: null,
    ownerId: null,
    riderIds: riderUserIds,
    orderId: order.id,
  });
}

// The transactional half of failing a stale delivery. Exported so it can be
// driven inside a rollback-only transaction in tests. The updateMany is the
// claim: it only matches while the delivery is still active AND still older
// than the cutoff, so two servers cannot both fail (and re-rotate) it.
export async function failOneStaleDelivery(tx, delivery, { cutoff, timeoutMinutes }) {
  const reason = `No status update for ${timeoutMinutes} minutes`;

  const claimed = await tx.delivery.updateMany({
    where: {
      id: delivery.id,
      status: { in: ACTIVE_DELIVERY_STATUSES },
      updatedAt: { lt: cutoff },
    },
    data: { status: "FAILED", failureReason: reason },
  });

  if (claimed.count === 0) return null;

  // Only an order that is still in flight goes back to the queue. If it moved
  // on (cancelled elsewhere), the delivery is closed by the claim above, but
  // nothing is requeued and the rider is not blamed.
  const requeued = await tx.order.updateMany({
    where: { id: delivery.orderId, status: "OUT_FOR_DELIVERY" },
    data: {
      status: "READY_FOR_PICKUP",
      // Same rule as a rider-reported failure: the old code is void.
      deliveryCode: generateDeliveryCode(),
    },
  });

  if (requeued.count === 0) return null;

  await recordDeliveryFailure(tx, {
    orderId: delivery.orderId,
    riderId: delivery.riderId,
    kind: "STALE",
    reason,
  });

  await tx.rejectedOrder.createMany({
    data: [{ riderId: delivery.riderId, orderId: delivery.orderId }],
    skipDuplicates: true,
  });

  return tx.order.findUnique({
    where: { id: delivery.orderId },
    include: {
      restaurant: { select: { ownerId: true, campusId: true } },
      customer: { select: { id: true } },
    },
  });
}

// Commit one stale delivery, then notify. Notification stays outside the
// transaction so a push failure cannot roll back the requeue.
async function failStaleDelivery(delivery, cutoff, timeoutMinutes) {
  const order = await prisma.$transaction((tx) =>
    failOneStaleDelivery(tx, delivery, { cutoff, timeoutMinutes })
  );

  if (!order) return null;

  const customerId = order.customer?.id;
  const ownerId = order.restaurant?.ownerId;
  notify("order:updated", [customerId, ownerId].filter(Boolean), {
    status: "FAILED",
    customerId,
    ownerId,
    orderId: order.id,
  });

  await notifyCampusRiders(order, { excludeUserId: delivery.rider.userId });

  return order;
}

// One sweep: fail every active delivery whose last update is older than the
// timeout. Exposed separately so it can be run by hand in support situations.
export async function failStaleDeliveries({ timeoutMinutes, limit = 25 } = {}) {
  const configured = Number(process.env.STALE_DELIVERY_MINUTES ?? 90);
  const minutes =
    timeoutMinutes ?? (Number.isFinite(configured) && configured > 0 ? configured : 90);

  const cutoff = new Date(Date.now() - minutes * 60 * 1000);

  const stale = await prisma.delivery.findMany({
    where: {
      status: { in: ACTIVE_DELIVERY_STATUSES },
      updatedAt: { lt: cutoff },
    },
    include: { rider: { select: { userId: true } } },
    orderBy: { updatedAt: "asc" },
    take: limit,
  });

  let failed = 0;
  let skipped = 0;

  for (const delivery of stale) {
    const order = await failStaleDelivery(delivery, cutoff, minutes);
    if (order) failed++;
    else skipped++;
  }

  return { scanned: stale.length, failed, skipped };
}

// Background sweep. Same shape as the stale-payment sweeper: run once at
// startup, then on an interval, never overlapping. unref() keeps the timer from
// holding the process open.
export function startStaleDeliverySweeper() {
  const interval = Number(process.env.STALE_DELIVERY_SWEEP_INTERVAL_MINUTES ?? 5);
  if (!Number.isFinite(interval) || interval <= 0) return;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await failStaleDeliveries();
      if (summary.failed > 0) console.log("[deliveries] stale sweep", summary);
    } catch (error) {
      console.error("[deliveries] stale sweep failed", error);
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, interval * 60 * 1000).unref();
  console.log(`[deliveries] stale sweep every ${interval} minute(s)`);
}
