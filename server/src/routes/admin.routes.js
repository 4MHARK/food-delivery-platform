import express from "express";
import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";

const router = express.Router();

// ── Admin registration (public — requires invite code) ──
router.post("/admin/register", async (req, res) => {
  try {
    const { name, email, password, inviteCode } = req.body;

    if (!name || !email || !password || !inviteCode) {
      return res.status(400).json({ message: "All fields are required." });
    }

    if (inviteCode !== process.env.ADMIN_INVITE_CODE) {
      return res.status(403).json({ message: "Invalid invite code." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "User with this email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "ADMIN",
      },
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Admin account created successfully",
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("POST /admin/register error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

// All other admin routes require auth + admin role
router.use(authMiddleware, adminMiddleware);

// ── Riders: list all ──
router.get("/admin/riders", async (req, res) => {
  try {
    const riders = await prisma.rider.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, createdAt: true },
        },
        deliveries: {
          select: { id: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = riders.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.user.name,
      email: r.user.email,
      phone: r.phone,
      vehicleType: r.vehicleType,
      licensePlate: r.licensePlate,
      licenseNumber: r.licenseNumber,
      matricNumber: r.matricNumber,
      isAvailable: r.isAvailable,
      isVerified: r.isVerified,
      totalDeliveries: r.deliveries.length,
      completedDeliveries: r.deliveries.filter((d) => d.status === "DELIVERED").length,
      failedDeliveries: r.deliveries.filter((d) => d.status === "FAILED").length,
      joinedAt: r.user.createdAt,
    }));

    res.status(200).json({
      message: "Riders fetched successfully",
      riders: formatted,
    });
  } catch (error) {
    console.error("GET /admin/riders error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

// ── Riders: toggle verification ──
router.put("/admin/riders/:id/verify", async (req, res) => {
  try {
    const riderId = Number(req.params.id);

    const rider = await prisma.rider.findUnique({
      where: { id: riderId },
      include: { user: { select: { name: true } } },
    });

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const updated = await prisma.rider.update({
      where: { id: riderId },
      data: { isVerified: !rider.isVerified },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(200).json({
      message: updated.isVerified
        ? `${rider.user.name} has been verified`
        : `${rider.user.name} has been unverified`,
      rider: {
        id: updated.id,
        name: updated.user.name,
        isVerified: updated.isVerified,
      },
    });
  } catch (error) {
    console.error("PUT /admin/riders/:id/verify error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

// ── Platform overview (stats for admin dashboard) ──
router.get("/admin/overview", async (req, res) => {
  try {
    const [totalUsers, totalOrders, totalRiders, totalRestaurants, recentOrders] =
      await Promise.all([
        prisma.user.count(),
        prisma.order.count(),
        prisma.rider.count(),
        prisma.restaurant.count(),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: {
            customer: { select: { name: true } },
            restaurant: { select: { name: true } },
          },
        }),
      ]);

    res.status(200).json({
      overview: {
        totalUsers,
        totalOrders,
        totalRiders,
        totalRestaurants,
        recentOrders: recentOrders.map((o) => ({
          id: o.id,
          status: o.status,
          totalAmount: Number(o.totalAmount),
          customer: o.customer.name,
          restaurant: o.restaurant.name,
          createdAt: o.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error("GET /admin/overview error:", error);
    res.status(500).json({ message: error.message || "Server error" });
  }
});

export default router;
