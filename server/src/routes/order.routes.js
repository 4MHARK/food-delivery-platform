import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import ownerMiddleware from "../middleware/owner.middleware.js";
import { validate } from "../middleware/validate.js";
import { checkoutSchema, estimateSchema } from "../validation/schemas.js";
import { calculateFees } from "../services/feecalculator.js";
import { notify } from "../services/events.js";
import { refundPaymentOnce } from "../services/refunds.js";
import { announceMenuUpdate, releaseOrderStock } from "../services/inventory.js";
import { computeOpenStatus } from "../services/hours.js";
import crypto from "crypto";
import { checkoutLimiter } from "../middleware/rate-limiter.js";
import { getRefundWindowMinutes } from "../utils/refund.js";
import { PUBLIC_RESTAURANT } from "../utils/selects.js";

// Owner-driven order transitions. Payment verification owns
// PENDING_PAYMENT → PENDING_RESTAURANT_CONFIRMATION, and the delivery flow owns
// OUT_FOR_DELIVERY → DELIVERED. Anything not listed here is terminal for the owner.
const ORDER_TRANSITIONS = {
  PENDING_RESTAURANT_CONFIRMATION: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["CANCELLED"],
};

const router = express.Router();

// Resolve + price cart items against the DB. Shared by checkout and estimate so the
// server stays the single source of truth for what an order actually costs.
async function resolveOrderItems(restaurantId, items) {
  const numericRestaurantId = Number(restaurantId);
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: numericRestaurantId },
    select: {
      id: true,
      campusId: true,
      approvalStatus: true,
      isOpen: true,
      hours: {
        select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
      },
    },
  });
  if (!restaurant) {
    return { error: { status: 404, message: "Restaurant not found" } };
  }

  // Pending, rejected, and suspended restaurants must not receive orders even
  // if a client sends the id directly.
  if (restaurant.approvalStatus !== "APPROVED") {
    return {
      error: { status: 403, message: "This restaurant is not currently accepting orders" },
    };
  }

  // The manual switch and the weekly schedule both gate ordering.
  if (!computeOpenStatus(restaurant).isOpenNow) {
    return { error: { status: 403, message: "This restaurant is currently closed" } };
  }

  // One query for the whole cart instead of one per item.
  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((item) => item.menuItemId) } },
  });
  const menuItemsById = new Map(menuItems.map((menuItem) => [menuItem.id, menuItem]));

  const validatedItems = [];

  // Iterate the cart (not the query result) so errors still point at the item
  // the customer actually submitted.
  for (const item of items) {
    const menuItem = menuItemsById.get(item.menuItemId);

    if (!menuItem) {
      return { error: { status: 404, message: `Menu item "${item.menuItemId}" not found` } };
    }

    if (menuItem.restaurantId !== Number(restaurantId)) {
      return {
        error: {
          status: 400,
          message: `"${menuItem.name}" belongs to a different restaurant. You can only order from one restaurant at a time.`,
        },
      };
    }

    if (!menuItem.isAvailable) {
      return {
        error: { status: 400, message: `"${menuItem.name}" is currently unavailable` },
      };
    }

    validatedItems.push({
      unitPrice: Number(menuItem.price),
      quantity: item.quantity,
      menuItemId: item.menuItemId,
      name: menuItem.name,
    });
  }

  return { validatedItems, restaurant };
}

// ── Checkout: create order + payment ──
// authMiddleware must run before checkoutLimiter: the limiter keys
// authenticated users by user id and would otherwise fall back to the IP,
// sharing one 5/min budget across everyone on the same network.
router.post("/orders/checkout", authMiddleware, checkoutLimiter, validate(checkoutSchema), async (req, res, next) => {
  try {
    const {
      restaurantId,
      savedLocationId,
      deliveryLandmarkId,
      deliveryDetail,
      items,
      idempotencyKey,
    } = req.body;

    // 1. Input validated by validate(checkoutSchema) middleware (zod)

    // 2. Check restaurant exists + validate menu items. The restaurant's
    //    campusId is needed before a campus landmark can be validated.
    const { validatedItems, restaurant, error } = await resolveOrderItems(restaurantId, items);
    if (error) return res.status(error.status).json({ message: error.message });

    // 3. Resolve the drop-off. A campus landmark is owned by the server: its
    //    name and coordinates override anything the client sent.
    let deliveryLocation;
    if (deliveryLandmarkId) {
      const landmark = await prisma.campusLandmark.findFirst({
        where: {
          id: Number(deliveryLandmarkId),
          isActive: true,
          campusId: restaurant.campusId,
        },
        select: { id: true, name: true, lat: true, lng: true },
      });

      if (!landmark) {
        return res.status(400).json({
          message: "That drop-off point is not available for this restaurant's campus.",
        });
      }

      const detail = deliveryDetail?.trim() || null;
      const lat = landmark.lat ?? req.body.deliveryLat ?? null;
      const lng = landmark.lng ?? req.body.deliveryLng ?? null;

      if (lat == null || lng == null) {
        return res.status(400).json({
          message:
            "This drop-off point has no map pin yet. Use your current location or choose another landmark.",
        });
      }

      deliveryLocation = {
        landmarkId: landmark.id,
        detail,
        address: [landmark.name, detail].filter(Boolean).join(" — ").slice(0, 200),
        lat,
        lng,
      };
    } else if (savedLocationId) {
      const saved = await prisma.customerDeliveryLocation.findFirst({
        where: { id: savedLocationId, userId: req.user.id },
        select: { address: true, lat: true, lng: true, landmarkId: true },
      });

      if (!saved) {
        return res.status(404).json({ message: "Saved delivery location not found" });
      }

      deliveryLocation = {
        landmarkId: saved.landmarkId ?? null,
        detail: null,
        address: saved.address,
        lat: saved.lat,
        lng: saved.lng,
      };
    } else {
      deliveryLocation = {
        landmarkId: null,
        detail: null,
        address: req.body.deliveryAddress,
        lat: req.body.deliveryLat,
        lng: req.body.deliveryLng,
      };
    }

    // 4. Calculate fees on the backend (never trust frontend totals)
    const fees = calculateFees(validatedItems);

    // 4. Create the order, its items, and its payment in one transaction — a
    //    failure in any part leaves no orphan order. Idempotent: a duplicate
    //    (customerId, idempotencyKey) returns the existing order.
    const reference = `CHOW-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    let order;
    try {
      order = await prisma.$transaction(async (tx) => {
        // Aggregate duplicate lines, then claim stock atomically. Untracked
        // items (null) pass the OR branch and stay null after the decrement.
        const quantities = new Map();
        const names = new Map();
        for (const item of validatedItems) {
          quantities.set(item.menuItemId, (quantities.get(item.menuItemId) || 0) + item.quantity);
          names.set(item.menuItemId, item.name);
        }

        for (const [menuItemId, quantity] of quantities) {
          const claimed = await tx.menuItem.updateMany({
            where: {
              id: menuItemId,
              isAvailable: true,
              OR: [{ stockQuantity: null }, { stockQuantity: { gte: quantity } }],
            },
            data: { stockQuantity: { decrement: quantity } },
          });

          if (claimed.count === 0) {
            throw {
              status: 409,
              message: `"${names.get(menuItemId)}" just sold out. Please refresh your cart.`,
            };
          }
        }

        return tx.order.create({
          data: {
            customerId: req.user.id,
            restaurantId: Number(restaurantId),
            deliveryAddress: deliveryLocation.address,
            deliveryLandmarkId: deliveryLocation.landmarkId,
            deliveryDetail: deliveryLocation.detail,
            deliveryLat: deliveryLocation.lat,
            deliveryLng: deliveryLocation.lng,
            idempotencyKey,
            status: "PENDING_PAYMENT",
            stockReserved: true,
            subtotal: fees.subtotal,
            deliveryFee: fees.deliveryFee,
            serviceFee: fees.serviceFee,
            totalAmount: fees.totalAmount,
            orderItems: {
              create: validatedItems.map((item) => ({
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.unitPrice * item.quantity,
                menuItemId: item.menuItemId,
              })),
            },
            payment: {
              create: {
                amount: fees.totalAmount,
                reference,
                status: "PENDING",
              },
            },
          },
          include: {
            orderItems: { include: { menuItem: true } },
            restaurant: PUBLIC_RESTAURANT,
            deliveryLandmark: { select: { id: true, name: true, category: true } },
            payment: true,
          },
        });
      }, { timeout: 15000, maxWait: 10000 });
    } catch (error) {
      if (error.status) {
        return res.status(error.status).json({ message: error.message });
      }
      if (error.code === "P2002") {
        // This customer already has an order with this key → return it instead of creating a duplicate
        const existing = await prisma.order.findUnique({
          where: {
            customerId_idempotencyKey: {
              customerId: req.user.id,
              idempotencyKey,
            },
          },
          include: {
            orderItems: { include: { menuItem: true } },
            restaurant: PUBLIC_RESTAURANT,
            deliveryLandmark: { select: { id: true, name: true, category: true } },
            payment: true,
          },
        });

        // P2002 could also be a payment-reference collision; only replay when
        // the idempotency key is the one that matched.
        if (!existing) throw error;

        return res.status(200).json({
          message: "Order already exists",
          order: existing,
          payment: existing.payment,
        });
      }
      throw error;
    }

    // Stock changed for this restaurant's menu.
    announceMenuUpdate(Number(restaurantId));

    // 5. Return everything. The payment is created nested, so strip it back out
    //    of `order` to keep the response shape unchanged.
    const { payment, ...orderPayload } = order;
    res.status(201).json({
      message: "Order created — payment pending",
      order: orderPayload,
      payment,
      fees,
    });
  } catch (error) {
    next(error)
  }
});

// ── Estimate fees (no order created) — the cart calls this so the total it shows is
//    always the server's real number, never a client-side guess ──
router.post("/orders/estimate", authMiddleware, validate(estimateSchema), async (req, res, next) => {
  try {
    const { restaurantId, items } = req.body;
    const { validatedItems, error } = await resolveOrderItems(restaurantId, items);
    if (error) return res.status(error.status).json({ message: error.message });

    const fees = calculateFees(validatedItems);
    res.status(200).json({ message: "Fees estimated", fees });
  } catch (error) {
    next(error);
  }
});

router.get("/orders", authMiddleware, async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { customerId: req.user.id },
      include: {
        orderItems: {
          include:{
            menuItem:{select: {name: true}}
          }
        },
        restaurant: PUBLIC_RESTAURANT,
        deliveryLandmark: { select: { id: true, name: true, category: true } },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    res.status(200).json({
      message: "Order fetched successfully",
      orders,
    });
  } catch (error) {
    next(error)
  }
});

// Fetch all orders for a restaurant (owner only)
router.get("/restaurants/:id/orders", authMiddleware, async (req, res, next) => {
  try {
    const restaurantId = Number(req.params.id);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: "You can only view orders for your restaurant" });
    }

    const orders = await prisma.order.findMany({
      where: { restaurantId },
      include: {
        orderItems: {
          include: {
            menuItem: { select: { id: true, name: true } },
          },
        },
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: orders.map(({ deliveryCode, ...order }) => order),
    });
  } catch (error) {
   next(error)
  }
});

router.get("/orders/:id", authMiddleware, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: {
        id: Number(req.params.id),
      },
      include: {
        orderItems: {
          include: {
            menuItem: true,
          },
        },
       restaurant: { select: { ...PUBLIC_RESTAURANT.select, owner: { select: { id: true, name: true } } } },
        deliveryLandmark: { select: { id: true, name: true, category: true } },
        payment: {
          select: { status: true, paidAt: true, reference: true, amount: true },
        },
        delivery: {
          include: {
            rider: {
              include: {
                user: { select: { id: true, name: true, phone: true } },
              },
            },
          },
        },
      },
    });
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const isCustomer = order.customerId === req.user.id;
    const isOwner = order.restaurant.ownerId === req.user.id;
    const isRider = order.delivery?.rider?.userId === req.user.id;

    if (!isCustomer && !isOwner && !isRider) {
      return res.status(403).json({
        message: "You are not allowed to view this order",
      });
    }

    // Only the customer sees their handoff code.
    if (!isCustomer) delete order.deliveryCode;

    // Expose the free-cancellation deadline (same window as the cancel endpoint)
    // so the customer UI can show exactly when a cancel stops being refundable.
    if (order.payment?.paidAt) {
      const windowMinutes = getRefundWindowMinutes();
      order.refundDeadline = new Date(
        new Date(order.payment.paidAt).getTime() + windowMinutes * 60 * 1000
      ).toISOString();
    }

    res.status(200).json({
      message: "Order fetched successfully",
      order,
    });
  } catch (error) {
   next(error)
  }
});

router.put("/orders/:id/status", authMiddleware, ownerMiddleware, async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        restaurant: true,
        payment: { select: { id: true, status: true, reference: true, gatewayResponse: true } },
        delivery: { include: { rider: { select: { userId: true } } } },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: "You can only update orders for your restaurant" });
    }

    const orderIncludes = {
      orderItems: { include: { menuItem: true } },
      restaurant: true,
    };

    // Repeating the current status is a no-op (double-click friendly).
    if (status === order.status) {
      const unchanged = await prisma.order.findUnique({
        where: { id: order.id },
        include: orderIncludes,
      });
      if (unchanged) delete unchanged.deliveryCode;
      return res.status(200).json({ message: "Order status unchanged", order: unchanged });
    }

    const allowed = ORDER_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) {
      return res.status(409).json({
        message: `Cannot change order from ${order.status} to ${status}`,
      });
    }

    if (status === "ACCEPTED" && order.payment?.status !== "SUCCESS") {
      return res.status(409).json({ message: "Order has not been paid yet" });
    }

    if (status === "CANCELLED") {
      const previousStatus = order.status;

      // Atomic claim: only one request can make this transition, so a double
      // click can never refund twice.
      const claim = await prisma.order.updateMany({
        where: { id: order.id, status: previousStatus },
        data: { status: "CANCELLED", deliveryCode: null },
      });

      if (claim.count === 0) {
        return res.status(409).json({ message: "Order status changed — refresh and try again" });
      }

      // Refund paid orders. If Paystack refuses, put the order back so the
      // owner can retry instead of ending up cancelled without a refund.
      if (order.payment?.status === "SUCCESS") {
        let refund;
        try {
          refund = await refundPaymentOnce(order.payment);
        } catch (error) {
          console.error("[orders/status] refund failed", error);
          refund = { ok: false };
        }

        if (!refund.ok) {
          await prisma.order.updateMany({
            where: { id: order.id, status: "CANCELLED" },
            data: { status: previousStatus, deliveryCode: order.deliveryCode },
          });
          return res.status(502).json({
            message: "We couldn't start the refund, so the order was NOT cancelled. Please try again.",
          });
        }
      }

      // Release the inventory this order held (idempotent via stockReserved).
      try {
        await prisma.$transaction((tx) => releaseOrderStock(order.id, tx));
        announceMenuUpdate(order.restaurantId);
      } catch (error) {
        console.error("[orders/status] stock release failed", error);
      }
    } else {
      // Same atomic-claim pattern for every forward transition.
      const transition = await prisma.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status },
      });

      if (transition.count === 0) {
        return res.status(409).json({ message: "Order status changed — refresh and try again" });
      }
    }

    const updated = await prisma.order.findUnique({
      where: { id: order.id },
      include: orderIncludes,
    });

    // Never expose the customer's handoff code to the restaurant.
    if (updated) delete updated.deliveryCode;

    // Notify everyone who should know about this change. `order.delivery?.rider`
    // only exists once a rider has been assigned (e.g. a mid-delivery cancel).
    const riderUserId = order.delivery?.rider?.userId || null;

    if (status === "READY_FOR_PICKUP") {
      // Only available, verified riders on this restaurant's campus get the
      // ping — the queue itself is campus-scoped, so a global "riders" push
      // was waking riders who could never accept the order.
      const campusRiders = await prisma.rider.findMany({
        where: {
          campusId: order.restaurant.campusId,
          isAvailable: true,
          isVerified: true,
          isSuspended: false,
        },
        select: { userId: true },
      });
      const riderUserIds = campusRiders.map((r) => r.userId);

      notify("order:updated", [order.customerId, ...riderUserIds], {
        status,
        customerId: order.customerId,
        riderIds: riderUserIds.length ? riderUserIds : null,
        orderId: order.id,
      });
    } else {
      notify(
        "order:updated",
        riderUserId ? [order.customerId, riderUserId] : [order.customerId],
        {
          status,
          customerId: order.customerId,
          riderIds: riderUserId ? [riderUserId] : null,
          orderId: order.id,
        }
      );
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order: updated,
    });
  } catch (error) {
  next(error)
  }
});

// ── Customer cancel: full refund within a short window after payment ──
router.post("/orders/:id/cancel", authMiddleware, async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(req.params.id) },
      include: { restaurant: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.customerId !== req.user.id) {
      return res.status(403).json({ message: "You can only cancel your own order" });
    }

    if (order.status === "CANCELLED") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    // The customer can only cancel before the restaurant accepts. Once the
    // kitchen is working, only the owner can cancel (via the status endpoint).
    if (!["PENDING_PAYMENT", "PENDING_RESTAURANT_CONFIRMATION"].includes(order.status)) {
      return res.status(400).json({ message: "Order can no longer be cancelled" });
    }

    // Work out refund eligibility before claiming the cancellation.
    const payment = await prisma.payment.findUnique({ where: { orderId: order.id } });
    let refundDue = false;

    if (payment && payment.status === "SUCCESS" && payment.paidAt) {
      const windowMinutes = getRefundWindowMinutes();
      const elapsed = Date.now() - new Date(payment.paidAt).getTime();
      refundDue = elapsed <= windowMinutes * 60 * 1000;
    }

    // Atomic claim: concurrent cancels cannot both proceed to a refund.
    const previousStatus = order.status;
    const claim = await prisma.order.updateMany({
      where: { id: order.id, status: previousStatus },
      data: { status: "CANCELLED", deliveryCode: null },
    });

    if (claim.count === 0) {
      return res.status(409).json({ message: "Order status changed — refresh and try again" });
    }

    let refunded = false;
    if (refundDue) {
      let refund;
      try {
        refund = await refundPaymentOnce(payment);
      } catch (error) {
        console.error("[orders/cancel] refund failed", error);
        refund = { ok: false };
      }

      if (!refund.ok) {
        // Restore the order so the customer can retry.
        await prisma.order.updateMany({
          where: { id: order.id, status: "CANCELLED" },
          data: { status: previousStatus, deliveryCode: order.deliveryCode },
        });
        return res.status(502).json({
          message: "We couldn't start your refund, so the order was NOT cancelled. Please try again.",
        });
      }

      refunded = true;
    }

    // Put the reserved stock back on the menu (idempotent). A stock failure
    // must not turn a successful cancellation into an error; the sweep will
    // retry orders left with stockReserved = true.
    try {
      await prisma.$transaction((tx) => releaseOrderStock(order.id, tx));
      announceMenuUpdate(order.restaurantId);
    } catch (error) {
      console.error("[orders/cancel] stock release failed", error);
    }

    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    if (updated) delete updated.deliveryCode;

    // The customer initiated this, so only the owner needs a push. SSE still
    // refreshes both sides (customer's other devices + the owner's dashboard).
    notify("order:updated", [order.customerId, order.restaurant.ownerId], {
      status: "CANCELLED",
      ownerId: order.restaurant.ownerId,
      orderId: order.id,
    });

    res.status(200).json({
      message: refunded
        ? "Order cancelled — your payment has been refunded."
        : "Order cancelled. The free-cancellation window has passed, so no refund was issued.",
      order: updated,
      refunded,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
