import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import ownerMiddleware from "../middleware/owner.middleware.js";
import { calculateFees } from "../services/feecalculator.js";
import { notify } from "../services/events.js";
import crypto from "crypto";

const router = express.Router();

// ── Checkout: create order + payment ──
router.post("/orders/checkout", authMiddleware, async (req, res) => {
  try {
    const { restaurantId, deliveryAddress, items } = req.body;

    // 1. Validate input
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Order must have at least one item" });
    }
    if (!restaurantId) {
      return res.status(400).json({ message: "Restaurant id is required" });
    }
    if (!deliveryAddress) {
      return res.status(400).json({ message: "Delivery address is required" });
    }

    // 2. Check restaurant exists
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(restaurantId) },
    });
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // 3. Validate menu items: exist + all belong to this restaurant
    const validatedItems = [];
    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
      });

      if (!menuItem) {
        return res.status(404).json({
          message: `Menu item "${item.menuItemId}" not found`,
        });
      }

      if (menuItem.restaurantId !== Number(restaurantId)) {
        return res.status(400).json({
          message: `"${menuItem.name}" belongs to a different restaurant. You can only order from one restaurant at a time.`,
        });
      }

      validatedItems.push({
        unitPrice: Number(menuItem.price),
        quantity: item.quantity,
        menuItemId: item.menuItemId,
      });
    }

    // 4. Calculate fees on the backend (never trust frontend totals)
    const fees = calculateFees(validatedItems);

    // 5. Create the order
    const order = await prisma.order.create({
      data: {
        customerId: req.user.id,
        restaurantId: Number(restaurantId),
        deliveryAddress,
        status: "PENDING_PAYMENT",
        subtotal: fees.subtotal,
        deliveryFee: fees.deliveryFee,
        serviceFee: fees.serviceFee,
        tax: fees.tax,
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

    // 6. Create payment record
    const reference = `CHOW-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: fees.totalAmount,
        reference,
        status: "PENDING",
      },
    });

    // 7. Return everything
    res.status(201).json({
      message: "Order created — payment pending",
      order,
      payment,
      fees,
    });
  } catch (error) {
    console.error("POST /orders/checkout error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

router.get("/orders", authMiddleware, async (req, res) => {
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
    console.error("GET /orders error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

// Fetch all orders for a restaurant (owner only)
router.get("/restaurants/:id/orders", authMiddleware, async (req, res) => {
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
    console.error("GET /restaurants/:id/orders error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

router.get("/orders/:id", authMiddleware, async (req, res) => {
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
        delivery: {
          include: {
            rider: {
              include: {
                user: { select: { id: true, name: true } },
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

    res.status(200).json({
      message: "Order fetched successfully",
      order,
    });
  } catch (error) {
    console.error("GET /orders/:id error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

router.put("/orders/:id/status", authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["PENDING_RESTAURANT_CONFIRMATION", "PREPARING", "CANCELLED"];
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

    // When order becomes PREPARING, also notify all riders (new available order)
    if (status === "PREPARING") {
      notify("order:updated", ["*"]);
    }

    res.status(200).json({
      message: "Order status updated successfully",
      order: updated,
    });
  } catch (error) {
    console.error("PUT /orders/:id/status error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

export default router;
