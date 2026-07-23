import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import riderMiddleware from "../middleware/rider.middleware.js";

const router = express.Router();

// State machine: valid transitions
const VALID_TRANSITIONS = {
  ZILLA_ON_IT: ["AT_KITCHEN", "FAILED"],
  AT_KITCHEN:  ["BAGGED", "FAILED"],
  BAGGED:      ["MOVING", "FAILED"],
  MOVING:      ["CLOSE_BY", "FAILED"],
  CLOSE_BY:    ["DELIVERED", "FAILED"],
  DELIVERED:   [],
  FAILED:      [],
};

// Get available orders for riders (PREPARING, no delivery assigned)
router.get("/riders/available-orders", authMiddleware, riderMiddleware, async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        status: "PREPARING",
        delivery: null, // No rider assigned yet
      },
      include: {
        orderItems: {
          include: {
            menuItem: true,
          },
        },
        restaurant: {
          select: { id: true, name: true, address: true, phone: true },
        },
        customer: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: "asc" }, // Oldest first
    });

    res.status(200).json({
      message: "Available orders fetched successfully",
      orders,
    });
  } catch (error) {
    console.error("GET /riders/available-orders error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

// Accept an order (assign rider, create delivery, move order to OUT_FOR_DELIVERY)
router.post("/deliveries/:orderId/accept", authMiddleware, riderMiddleware, async (req, res) => {
  try {
    // Look up the rider
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({
        message: "Rider profile not found. Please register first.",
      });
    }

    const orderId = Number(req.params.orderId);

    // Active delivery statuses (non-terminal)
    const ACTIVE_STATUSES = ["ZILLA_ON_IT", "AT_KITCHEN", "BAGGED", "MOVING", "CLOSE_BY"];

    // Use a transaction to prevent race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Guard: rider must not already have an active delivery
      const activeDelivery = await tx.delivery.findFirst({
        where: {
          riderId: rider.id,
          status: { in: ACTIVE_STATUSES },
        },
      });

      if (activeDelivery) {
        throw {
          status: 409,
          message: "You already have an active delivery. Complete or fail it before accepting a new order.",
        };
      }

      // Verify order exists and is in PREPARING status
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { delivery: true },
      });

      if (!order) {
        throw { status: 404, message: "Order not found" };
      }

      if (order.status !== "PREPARING") {
        throw { status: 400, message: "This order is no longer available for pickup" };
      }

      if (order.delivery) {
        throw { status: 409, message: "This order has already been assigned to a rider" };
      }

      // Create delivery and update order status atomically
      const delivery = await tx.delivery.create({
        data: {
          orderId,
          riderId: rider.id,
          status: "ZILLA_ON_IT",
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: "OUT_FOR_DELIVERY" },
        include: {
          orderItems: { include: { menuItem: true } },
          restaurant: { select: { id: true, name: true, address: true, phone: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      return { delivery, order: updatedOrder };
    });

    res.status(201).json({
      message: "Order accepted successfully",
      delivery: result.delivery,
      order: result.order,
    });
  } catch (error) {
    // Handle structured throws from the transaction
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error("POST /deliveries/:orderId/accept error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

// Update delivery status
router.put("/deliveries/:id/status", authMiddleware, riderMiddleware, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const deliveryId = Number(req.params.id);

    // Fetch the delivery
    const delivery = await prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: {
        rider: true,
        order: true,
      },
    });

    if (!delivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    // Verify this rider owns the delivery
    if (delivery.rider.userId !== req.user.id) {
      return res.status(403).json({ message: "You can only update your own deliveries" });
    }

    // Validate the transition
    const allowed = VALID_TRANSITIONS[delivery.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        message: `Cannot transition from ${delivery.status} to ${status}. Allowed: ${allowed.join(", ") || "none"}`,
      });
    }

    // Use transaction to update delivery and possibly order
    const result = await prisma.$transaction(async (tx) => {
      // Set timestamps based on new status
      const data = { status };
      if (status === "BAGGED") {
        data.pickedUpAt = new Date();
      }
      if (status === "DELIVERED") {
        data.deliveredAt = new Date();
      }

      const updatedDelivery = await tx.delivery.update({
        where: { id: deliveryId },
        data,
        include: {
          order: {
            include: {
              orderItems: { include: { menuItem: true } },
              restaurant: { select: { id: true, name: true, address: true } },
              customer: { select: { id: true, name: true, phone: true } },
            },
          },
          rider: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
      });

      let updatedOrder = null;

      // When delivery is marked FAILED: delete it and reset order to PREPARING
      // so another rider can accept it
      if (status === "FAILED") {
        await tx.delivery.delete({ where: { id: deliveryId } });

        updatedOrder = await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: "PREPARING" },
          include: {
            orderItems: { include: { menuItem: true } },
            restaurant: { select: { id: true, name: true, address: true } },
            customer: { select: { id: true, name: true, phone: true } },
          },
        });
      }

      // When delivery is marked DELIVERED, also update the order
      if (status === "DELIVERED") {
        updatedOrder = await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: "DELIVERED" },
          include: {
            orderItems: { include: { menuItem: true } },
            restaurant: { select: { id: true, name: true, address: true } },
            customer: { select: { id: true, name: true, phone: true } },
          },
        });
      }

      return { delivery: updatedDelivery, order: updatedOrder };
    });

    const response = {
      message: "Delivery status updated successfully",
      delivery: result.delivery,
    };

    if (result.order) {
      response.order = result.order;
    }

    res.status(200).json(response);
  } catch (error) {
    console.error("PUT /deliveries/:id/status error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

// Get rider's own deliveries
router.get("/riders/my-deliveries", authMiddleware, riderMiddleware, async (req, res) => {
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({
        message: "Rider profile not found. Please register first.",
      });
    }

    const deliveries = await prisma.delivery.findMany({
      where: { riderId: rider.id },
      include: {
        order: {
          include: {
            orderItems: { include: { menuItem: true } },
            restaurant: { select: { id: true, name: true, address: true, phone: true } },
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Deliveries fetched successfully",
      deliveries,
    });
  } catch (error) {
    console.error("GET /riders/my-deliveries error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

export default router;
