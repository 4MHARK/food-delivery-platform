import prisma from "../config/prisma.js";
import { notify } from "./events.js";
import { cacheDelete } from "./cache.js";

export const LOW_STOCK_THRESHOLD = 5;

// Attach derived availability so clients don't have to infer it from two fields.
export function serializeMenuItem(item) {
  const tracked = item.stockQuantity !== null && item.stockQuantity !== undefined;
  return {
    ...item,
    inStock: item.isAvailable && (!tracked || item.stockQuantity > 0),
    lowStock: tracked && item.stockQuantity > 0 && item.stockQuantity <= LOW_STOCK_THRESHOLD,
  };
}

// Restore the stock held by an order. The stockReserved flag makes this
// idempotent and stops legacy orders (created before tracking) from inflating
// inventory when they are cancelled.
export async function releaseOrderStock(orderId, db = prisma) {
  const claim = await db.order.updateMany({
    where: { id: orderId, stockReserved: true },
    data: { stockReserved: false },
  });
  if (claim.count === 0) return false;

  const items = await db.orderItem.findMany({
    where: { orderId },
    select: { menuItemId: true, quantity: true },
  });

  const quantities = new Map();
  for (const item of items) {
    quantities.set(item.menuItemId, (quantities.get(item.menuItemId) || 0) + item.quantity);
  }

  for (const [menuItemId, quantity] of quantities) {
    await db.menuItem.updateMany({
      where: { id: menuItemId, stockQuantity: { not: null } },
      data: { stockQuantity: { increment: quantity } },
    });
  }

  return true;
}

// Drop the cached public menu and tell connected clients to refresh.
export function announceMenuUpdate(restaurantId) {
  cacheDelete(`menu:${restaurantId}`);
  notify("menu:updated", ["*"], { restaurantId });
}

const PENDING_PAYMENT_TIMEOUT_MINUTES = Number(
  process.env.PENDING_PAYMENT_TIMEOUT_MINUTES ?? 15
);

// Cancel unpaid orders that have held stock past the timeout, restoring it.
export async function cancelStalePendingOrders({
  olderThanMinutes = PENDING_PAYMENT_TIMEOUT_MINUTES,
  limit = 50,
} = {}) {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60 * 1000);

  // Only orders that actually reserved stock. Legacy PENDING_PAYMENT orders
  // (created before stock tracking) must not be mass-cancelled by the sweep.
  const orders = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", stockReserved: true, createdAt: { lt: cutoff } },
    select: {
      id: true,
      customerId: true,
      restaurantId: true,
      restaurant: { select: { ownerId: true } },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const summary = { scanned: orders.length, cancelled: 0 };

  for (const order of orders) {
    // Atomic claim: another instance may have cancelled it first.
    const claim = await prisma.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED", deliveryCode: null },
    });
    if (claim.count === 0) continue;

    await prisma.$transaction((tx) => releaseOrderStock(order.id, tx));
    announceMenuUpdate(order.restaurantId);

    // The customer initiated nothing, so both sides should know it expired.
    notify("order:updated", [order.customerId, order.restaurant.ownerId], {
      status: "CANCELLED",
      customerId: order.customerId,
      ownerId: order.restaurant.ownerId,
      orderId: order.id,
    });

    summary.cancelled += 1;
  }

  return summary;
}

// Safety net for a crash between "order cancelled" and "stock released".
export async function reconcileReleasedStock({ limit = 50 } = {}) {
  const orders = await prisma.order.findMany({
    where: { status: "CANCELLED", stockReserved: true },
    select: { id: true, restaurantId: true },
    take: limit,
  });

  let released = 0;
  for (const order of orders) {
    const didRelease = await prisma.$transaction((tx) => releaseOrderStock(order.id, tx));
    if (didRelease) {
      announceMenuUpdate(order.restaurantId);
      released += 1;
    }
  }

  return { scanned: orders.length, released };
}

export function startStaleOrderSweeper() {
  const minutes = Number(process.env.STALE_ORDER_SWEEP_INTERVAL_MINUTES ?? 5);
  if (!Number.isFinite(minutes) || minutes <= 0) return;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const summary = await cancelStalePendingOrders();
      const reconcile = await reconcileReleasedStock();
      if (summary.cancelled > 0 || reconcile.released > 0) {
        console.log("[orders] stale payment sweep", {
          ...summary,
          releasedStock: reconcile.released,
        });
      }
    } catch (error) {
      console.error("[orders] stale payment sweep failed", error);
    } finally {
      running = false;
    }
  };

  tick();
  setInterval(tick, minutes * 60 * 1000).unref();
  console.log(`[orders] stale payment sweep every ${minutes} minute(s)`);
}
