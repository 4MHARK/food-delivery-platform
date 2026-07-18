import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import ownerMiddleware from "../middleware/owner.middleware.js";

const router = express.Router();

router.post("/orders", authMiddleware, async (req, res) => {
  try {
    const { restaurantId, deliveryAddress, items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: "Order must have at least one item",
      });
    }
    if (!restaurantId) {
      return res.status(400).json({
        message: "Restaurant id is required",
      });
    }
    if (!deliveryAddress) {
      return res.status(400).json({
        message: "Delivery address is required",
      });
    }

    let total = 0;
    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: item.menuItemId },
      });

      if (!menuItem) {
        return res.status(404).json({
          message: `Menu Item ${item.menuItemId} not found`,
        });
      }
      total += menuItem.price * item.quantity;
      item.price = menuItem.price;
    }

    const order = await prisma.order.create({
      data: {
        customerId: req.user.id,
        restaurantId: Number(restaurantId),
        deliveryAddress,
        total,
        orderItems: {
          create: items.map((item) => ({
            quantity: item.quantity,
            price: item.price,
            menuItemId: item.menuItemId,
          })),
        },
      },
      include: {
        orderItems: true,
        restaurant: true,
      },
    });

    res.status(201).json({
      message: "Order Placed scuccessfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: " Server is down",
      error: error.message,
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
    res.status(500).json({
      message: "Server error",
      error: error.message,
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
    res.status(500).json({
      message: "Server error",
      error: error.message,
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
      },
    });
    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    const isCustomer = order.customerId === req.user.id;
    const isOwner = order.restaurant.ownerId === req.user.id;

    if (!isCustomer && !isOwner) {
      return res.status(403).json({
        message: "You are not allowed to view this order",
      });
    }

    res.status(200).json({
      message: "Order fetched successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.put("/orders/:id/status", authMiddleware, ownerMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const validStatuses = ["CONFIRMED", "PREPARING", "READY", "DELIVERING", "DELIVERED", "CANCELLED"];
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

    res.status(200).json({
      message: "Order status updated successfully",
      order: updated,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
