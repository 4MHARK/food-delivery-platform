import express from "express";
import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";
import superAdminMiddleware from "../middleware/superAdmin.middleware.js";
import { validate } from "../middleware/validate.js";
import { adminRegisterSchema } from "../validation/schemas.js";

const router = express.Router();

// ── Admin registration (public — requires invite code) ──
router.post("/admin/register", validate(adminRegisterSchema), async (req, res, next) => {
  try {
    const { name, email, password, inviteCode } = req.body;

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
        role: "SUPER_ADMIN",
      },
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, campusId: newUser.campusId },
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
        campusId: newUser.campusId,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    next(error)
  }
});

// All other admin routes require auth + admin role
router.use("/admin", authMiddleware, adminMiddleware);

// ── Current admin identity (role + campus scope) ──
router.get("/admin/me", async (req, res, next) => {
  try {
    let campusName = null;
    if (req.user.campusId) {
      const campus = await prisma.campus.findUnique({
        where: { id: req.user.campusId },
        select: { name: true },
      });
      campusName = campus?.name || null;
    }

    res.status(200).json({
      role: req.user.role,
      campusId: req.user.campusId || null,
      campusName,
    });
  } catch (error) {
    next(error)
  }
});

// ── Riders: list all ──
router.get("/admin/riders", async (req, res, next) => {
  try {
    // School admins only see their campus; super admins see everything.
    const where = req.user.role === "SUPER_ADMIN" ? {} : { campusId: req.user.campusId };

    const riders = await prisma.rider.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true, createdAt: true },
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
      phone: r.user.phone,
      vehicleType: r.vehicleType,
      licensePlate: r.licensePlate,
      licenseNumber: r.licenseNumber,
      matricNumber: r.matricNumber,
      isAvailable: r.isAvailable,
      isVerified: r.isVerified,
      isSuspended: r.isSuspended,
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
   next(error)
  }
});

// ── Riders: toggle verification ──
router.put("/admin/riders/:id/verify", async (req, res, next) => {
  try {
    const riderId = Number(req.params.id);

    const rider = await prisma.rider.findUnique({
      where: { id: riderId },
      include: { user: { select: { name: true } } },
    });

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // School admins can only manage riders in their own campus.
    if (req.user.role !== "SUPER_ADMIN" && rider.campusId !== req.user.campusId) {
      return res.status(403).json({ message: "You can only manage riders in your campus." });
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
    next(error)
  }
});

// ── Riders: toggle suspension ──
router.put("/admin/riders/:id/suspend", async (req, res, next) => {
  try {
    const riderId = Number(req.params.id);

    const rider = await prisma.rider.findUnique({
      where: { id: riderId },
      include: { user: { select: { name: true } } },
    });

    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // School admins can only manage riders in their own campus.
    if (req.user.role !== "SUPER_ADMIN" && rider.campusId !== req.user.campusId) {
      return res.status(403).json({ message: "You can only manage riders in your campus." });
    }

    const updated = await prisma.rider.update({
      where: { id: riderId },
      data: { isSuspended: !rider.isSuspended },
    });

    res.status(200).json({
      message: updated.isSuspended
        ? `${rider.user.name} has been suspended`
        : `${rider.user.name} has been unsuspended`,
      rider: { id: updated.id, name: rider.user.name, isSuspended: updated.isSuspended },
    });
  } catch (error) {
    next(error)
  }
});

// ── Platform overview (stats for admin dashboard) ──
router.get("/admin/overview", async (req, res, next) => {
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
    next(error)
  }
});

// ── Restaurants: list all ──
router.get("/admin/restaurants", async (req, res, next) => {
  try {
    // School admins only see their campus; super admins see everything.
    const where = req.user.role === "SUPER_ADMIN" ? {} : { campusId: req.user.campusId };

    const restaurants = await prisma.restaurant.findMany({
      where,
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { menuItems: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const formatted = restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      phone: r.phone,
      ownerName: r.owner.name,
      ownerEmail: r.owner.email,
      menuItemCount: r._count.menuItems,
      orderCount: r._count.orders,
      approvalStatus: r.approvalStatus,
      createdAt: r.createdAt,
    }));

    res.status(200).json({
      message: "Restaurants fetched successfully",
      restaurants: formatted,
    });
  } catch (error) {
    next(error)
  }
});

// ── Restaurants: approve / reject / suspend ──
router.put("/admin/restaurants/:id/status", async (req, res, next) => {
  try {
    const restaurantId = Number(req.params.id);
    const { status } = req.body;

    const allowed = ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // School admins can only manage restaurants in their own campus.
    if (req.user.role !== "SUPER_ADMIN" && restaurant.campusId !== req.user.campusId) {
      return res.status(403).json({ message: "You can only manage restaurants in your campus." });
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { approvalStatus: status },
    });

    res.status(200).json({
      message: `Restaurant ${status.toLowerCase()}`,
      restaurant: { id: updated.id, approvalStatus: updated.approvalStatus },
    });
  } catch (error) {
    next(error)
  }
});

// ── Customers: list all ──
router.get("/admin/customers", async (req, res, next) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      include: { _count: { select: { orders: true } } },
      orderBy: { createdAt: "desc" },
    });

    const formatted = customers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      orderCount: c._count.orders,
      createdAt: c.createdAt,
    }));

    res.status(200).json({
      message: "Customers fetched successfully",
      customers: formatted,
    });
  } catch (error) {
    next(error)
  }
});

// ── Orders: list all (latest 100) ──
router.get("/admin/orders", async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        customer: { select: { name: true } },
        restaurant: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = orders.map((o) => ({
      id: o.id,
      customer: o.customer.name,
      restaurant: o.restaurant.name,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt,
    }));

    res.status(200).json({
      message: "Orders fetched successfully",
      orders: formatted,
    });
  } catch (error) {
    next(error)
  }
});

// ── Payments: list all (latest 100) ──
router.get("/admin/payments", async (req, res, next) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = payments.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      reference: p.reference,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      provider: p.provider,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    }));

    res.status(200).json({
      message: "Payments fetched successfully",
      payments: formatted,
    });
  } catch (error) {
    next(error)
  }
});

// ── Campuses: super admin only ──
router.get("/admin/campuses", superAdminMiddleware, async (req, res, next) => {
  try {
    const campuses = await prisma.campus.findMany({
      include: { _count: { select: { restaurants: true, riders: true } } },
      orderBy: { createdAt: "asc" },
    });

    const formatted = campuses.map((c) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      restaurantCount: c._count.restaurants,
      riderCount: c._count.riders,
      createdAt: c.createdAt,
    }));

    res.status(200).json({
      message: "Campuses fetched successfully",
      campuses: formatted,
    });
  } catch (error) {
    next(error)
  }
});

router.post("/admin/campuses", superAdminMiddleware, async (req, res, next) => {
  try {
    const { name, address } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Campus name is required" });
    }

    const campus = await prisma.campus.create({
      data: { name: name.trim(), address: address?.trim() || null },
    });

    res.status(201).json({
      message: "Campus created successfully",
      campus,
    });
  } catch (error) {
    next(error)
  }
});

router.post("/admin/campuses/:id/admins", superAdminMiddleware, async (req, res, next) => {
  try {
    const campusId = Number(req.params.id);
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const campus = await prisma.campus.findUnique({ where: { id: campusId } });
    if (!campus) {
      return res.status(404).json({ message: "Campus not found" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: "ADMIN", campusId },
    });

    res.status(201).json({
      message: "School admin created successfully",
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        campusId: admin.campusId,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    next(error)
  }
});

export default router;
