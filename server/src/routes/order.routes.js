import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import ownerMiddleware from "../middleware/owner.middleware.js";
import { validate } from "../middleware/validate.js";
import { checkoutSchema, estimateSchema } from "../validation/schemas.js";
import { calculateFees } from "../services/feecalculator.js";
import { notify } from "../services/events.js";
import { refundPayment } from "../services/paystack.js";
import crypto from "crypto";
import { checkoutLimiter } from "../middleware/rate-limiter.js";
import { getRefundWindowMinutes } from "../utils/refund.js";

const router = express.Router();

// Resolve + price cart items against the DB. Shared by checkout and estimate so the
// server stays the single source of truth for what an order actually costs.
async function resolveOrderItems(restaurantId, items) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: Number(restaurantId) },
  });
  if (!restaurant) {
    return { error: { status: 404, message: "Restaurant not found" } };
  }

  const validatedItems = [];
  for (const item of items) {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: item.menuItemId },
    });

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

    validatedItems.push({
      unitPrice: Number(menuItem.price),
      quantity: item.quantity,
      menuItemId: item.menuItemId,
    });
  }

  return { validatedItems };
}

// ── Checkout: create order + payment ──
router.post("/orders/checkout", checkoutLimiter, authMiddleware, validate(checkoutSchema), async (req, res, next) => {
  try {
    const { restaurantId, deliveryAddress, items, idempotencyKey } = req.body;

    // 1. Input validated by validate(checkoutSchema) middleware (zod)

    // 2. Check restaurant exists + validate menu items (exist + all belong to this restaurant)
    const { validatedItems, error } = await resolveOrderItems(restaurantId, items);
    if (error) return res.status(error.status).json({ message: error.message });

    // 3. Calculate fees on the backend (never trust frontend totals)
    const fees = calculateFees(validatedItems);

    // 4. Create the order — idempotent: a duplicate (customerId, idempotencyKey) returns the existing order
    let order;
    try {
      order = await prisma.order.create({
        data: {
          customerId: req.user.id,
          restaurantId: Number(restaurantId),
          deliveryAddress,
          idempotencyKey,
          status: "PENDING_PAYMENT",
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
        },
        include: {
          orderItems: { include: { menuItem: true } },
          restaurant: true,
        },
      });
    } catch (error) {
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
            restaurant: true,
            payment: true,
          },
        });

        return res.status(200).json({
          message: "Order already exists",
          order: existing,
          payment: existing.payment,
        });
      }
      throw error;
    }

    // 5. Create payment record
    const reference = `CHOW-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: fees.totalAmount,
        reference,
        status: "PENDING",
      },
    });

    // 6. Return everything
    res.status(201).json({
      message: "Order created — payment pending",
      order,
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
        restaurant: true
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
      orders,
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
        restaurant: {
          include: {
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
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
      include: { restaurant: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: "You can only update orders for your restaurant" });
    }

    // Refund the customer before cancelling a paid order — otherwise they lose
    // both their food and their money. The `order.status !== "CANCELLED"` guard
    // stops a second "Cancel" click from refunding an already-cancelled order twice.
    if (status === "CANCELLED" && order.status !== "CANCELLED") {
      const payment = await prisma.payment.findUnique({
        where: { orderId: order.id },
      });

      // Only orders that actually took the customer's money get refunded.
      if (payment && payment.status === "SUCCESS") {
        const { refunded } = await refundPayment(payment.reference);

        if (!refunded) {
          return res.status(502).json({
            message: "Refund failed — order was NOT cancelled. Please try again.",
          });
        }
      }
    }

    const updated = await prisma.order.update({
      where: { id: Number(req.params.id) },
      data: { status },
      include: {
        orderItems: { include: { menuItem: true } },
        restaurant: true,
      },
    });

    // Notify customer of order status change
    notify("order:updated", [order.customerId]);

    // When the food is ready for pickup, also notify all riders (new available order)
    if (status === "READY_FOR_PICKUP") {
      notify("order:updated", ["*"]);
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

    // Refund paid orders — but only while they're still inside the free-cancel
    // window. After it lapses the customer still cancels, just without a refund.
    const payment = await prisma.payment.findUnique({ where: { orderId: order.id } });
    let refunded = false;

    if (payment && payment.status === "SUCCESS" && payment.paidAt) {
      const windowMinutes = getRefundWindowMinutes();
      const elapsed = Date.now() - new Date(payment.paidAt).getTime();

      if (elapsed <= windowMinutes * 60 * 1000) {
        const { refunded: ok } = await refundPayment(payment.reference);
        if (!ok) {
          return res.status(502).json({
            message: "Refund failed — order was NOT cancelled. Please try again.",
          });
        }
        refunded = true;
      }
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED" },
    });

    notify("order:updated", [order.customerId, order.restaurant.ownerId]);

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
