import express from "express";
import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import authMiddleware from "../middleware/auth.middleware.js";
import adminMiddleware from "../middleware/admin.middleware.js";
import superAdminMiddleware from "../middleware/superAdmin.middleware.js";
import { validate } from "../middleware/validate.js";
import { adminRegisterSchema } from "../validation/schemas.js";
import { settleOrderPayouts } from "../services/payouts.js";

const router = express.Router();

// Build a 14-day daily series (zero-filled) for trend charts.
function buildDailySeries(since, rows, getDate, getValue) {
  const days = [];
  const buckets = {};
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    buckets[key] = 0;
    days.push(key);
  }
  for (const row of rows) {
    const d = getDate(row);
    if (!d) continue;
    const dt = new Date(d);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (key in buckets) buckets[key] += getValue(row);
  }
  return days.map((key) => ({ date: key, value: buckets[key] }));
}

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
    const isSuperAdmin = req.user.role === "SUPER_ADMIN";
    const campusId = req.user.campusId;

    // School admins see only their campus; super admins see the whole platform.
    const ridersWhere = isSuperAdmin ? {} : { campusId };
    const restaurantsWhere = isSuperAdmin ? {} : { campusId };
    const ordersWhere = isSuperAdmin ? {} : { restaurant: { campusId } };
    // Customers have no direct campus link, so a school's "users" are the
    // customers who have ordered from that campus's restaurants.
    const usersWhere = isSuperAdmin
      ? {}
      : { role: "CUSTOMER", orders: { some: { restaurant: { campusId } } } };

    const [totalUsers, totalOrders, totalRiders, totalRestaurants, recentOrders] =
      await Promise.all([
        prisma.user.count({ where: usersWhere }),
        prisma.order.count({ where: ordersWhere }),
        prisma.rider.count({ where: ridersWhere }),
        prisma.restaurant.count({ where: restaurantsWhere }),
        prisma.order.findMany({
          where: ordersWhere,
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

// ── Analytics (campus-scoped metrics + trends) ──
router.get("/admin/analytics", async (req, res, next) => {
  try {
    const isSuperAdmin = req.user.role === "SUPER_ADMIN";
    const campusId = req.user.campusId;

    const ordersWhere = isSuperAdmin ? {} : { restaurant: { campusId } };
    const paymentsWhere = isSuperAdmin ? {} : { order: { restaurant: { campusId } } };
    const ridersWhere = isSuperAdmin ? {} : { campusId };
    const customersWhere = isSuperAdmin
      ? { role: "CUSTOMER" }
      : { role: "CUSTOMER", orders: { some: { restaurant: { campusId } } } };
    const deliveriesWhere = {
      status: "DELIVERED",
      pickedUpAt: { not: null },
      deliveredAt: { not: null },
      ...(isSuperAdmin ? {} : { order: { restaurant: { campusId } } }),
    };

    const since = new Date();
    since.setDate(since.getDate() - 13);
    since.setHours(0, 0, 0, 0);

    const [orders, riders, payments, deliveries, customers] = await Promise.all([
      prisma.order.findMany({
        where: ordersWhere,
        select: {
          id: true,
          status: true,
          totalAmount: true,
          serviceFee: true,
          createdAt: true,
          restaurant: { select: { name: true } },
        },
      }),
      prisma.rider.findMany({
        where: ridersWhere,
        select: {
          id: true,
          user: { select: { name: true } },
          deliveries: { select: { status: true } },
        },
      }),
      prisma.payment.findMany({
        where: paymentsWhere,
        select: { status: true },
      }),
      prisma.delivery.findMany({
        where: deliveriesWhere,
        select: { pickedUpAt: true, deliveredAt: true },
      }),
      prisma.user.findMany({
        where: customersWhere,
        select: { createdAt: true },
      }),
    ]);

    // Revenue = GMV: total value of every order placed (all statuses).
    const revenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

    // Platform fees = the serviceFee (5% of subtotal) collected on delivered
    // orders. This is what the platform keeps — it never leaves the balance.
    const serviceFee = orders
      .filter((o) => o.status === "DELIVERED")
      .reduce((sum, o) => sum + Number(o.serviceFee), 0);

    const completed = orders.filter((o) => o.status === "DELIVERED").length;
    const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
    const pending = orders.length - completed - cancelled;

    const avgDeliveryMs = deliveries.length
      ? deliveries.reduce((sum, d) => sum + (new Date(d.deliveredAt) - new Date(d.pickedUpAt)), 0) / deliveries.length
      : 0;

    const successPayments = payments.filter((p) => p.status === "SUCCESS").length;
    const failedPayments = payments.filter((p) => p.status === "FAILED").length;
    const settledPayments = successPayments + failedPayments;
    const paymentSuccessRate = settledPayments === 0 ? 0 : Math.round((successPayments / settledPayments) * 100);

    // Top restaurants by order count (derived from the scoped orders).
    const byRestaurant = {};
    orders.forEach((o) => {
      const name = o.restaurant.name;
      if (!byRestaurant[name]) byRestaurant[name] = { name, orders: 0, revenue: 0 };
      byRestaurant[name].orders += 1;
      byRestaurant[name].revenue += Number(o.totalAmount);
    });
    const topRestaurants = Object.values(byRestaurant)
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);

    const topRiders = riders
      .map((r) => ({ name: r.user.name, completed: r.deliveries.filter((d) => d.status === "DELIVERED").length }))
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 5);

    const recentOrders = orders.filter((o) => new Date(o.createdAt) >= since);
    const orderTrend = buildDailySeries(since, recentOrders, (o) => o.createdAt, () => 1);
    const revenueTrend = buildDailySeries(since, recentOrders, (o) => o.createdAt, (o) => Number(o.totalAmount));
    const userTrend = buildDailySeries(since, customers, (c) => c.createdAt, () => 1);

    res.status(200).json({
      revenue,
      serviceFee,
      orderBreakdown: { completed, cancelled, pending },
      avgDeliveryTimeMinutes: Math.round(avgDeliveryMs / 60000),
      paymentSuccessRate,
      topRestaurants,
      topRiders,
      trends: {
        orders: orderTrend,
        revenue: revenueTrend,
        users: userTrend,
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
    // School admins see only customers who have ordered from their campus.
    const where =
      req.user.role === "SUPER_ADMIN"
        ? { role: "CUSTOMER" }
        : { role: "CUSTOMER", orders: { some: { restaurant: { campusId: req.user.campusId } } } };

    const customers = await prisma.user.findMany({
      where,
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
    // School admins see only orders placed at their campus's restaurants.
    const where =
      req.user.role === "SUPER_ADMIN" ? {} : { restaurant: { campusId: req.user.campusId } };

    const orders = await prisma.order.findMany({
      where,
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
    // School admins see only payments for their campus's orders.
    const where =
      req.user.role === "SUPER_ADMIN"
        ? {}
        : { order: { restaurant: { campusId: req.user.campusId } } };

    const payments = await prisma.payment.findMany({
      where,
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

// ── Payouts: list all (latest 100) ──
router.get("/admin/payouts", async (req, res, next) => {
  try {
    // School admins see only payouts for their campus's orders.
    const where =
      req.user.role === "SUPER_ADMIN"
        ? {}
        : { order: { restaurant: { campusId: req.user.campusId } } };

    const payouts = await prisma.payout.findMany({
      where,
      include: {
        order: {
          select: {
            id: true,
            restaurant: { select: { name: true } },
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const formatted = payouts.map((p) => ({
      id: p.id,
      orderId: p.orderId,
      type: p.type,
      amount: Number(p.amount),
      status: p.status,
      reference: p.reference,
      restaurant: p.order.restaurant.name,
      customer: p.order.customer.name,
      createdAt: p.createdAt,
    }));

    res.status(200).json({
      message: "Payouts fetched successfully",
      payouts: formatted,
    });
  } catch (error) {
    next(error)
  }
});

// ── Payout reconciliation: backfill any DELIVERED order with no payout rows ──
// Also the safety net for a crash between "delivered" and "payout created".
// For each order it settles to whatever bank the restaurant/rider has linked
// *now* — so old orders pay out once they add their bank details.
router.post("/admin/payouts/reconcile", async (req, res, next) => {
  try {
    const where = {
      status: "DELIVERED",
      payouts: { none: {} },
      ...(req.user.role === "SUPER_ADMIN" ? {} : { restaurant: { campusId: req.user.campusId } }),
    };

    const orders = await prisma.order.findMany({
      where,
      select: { id: true },
    });

    const processed = [];
    for (const order of orders) {
      await settleOrderPayouts(order.id);
      processed.push(order.id);
    }

    res.status(200).json({
      message: "Payout reconciliation complete",
      processed: processed.length,
      orderIds: processed,
    });
  } catch (error) {
    next(error)
  }
});

// ── Manual payouts: unpaid balances grouped per recipient ──
// Groups PENDING + FAILED payouts by the person owed (restaurant or rider),
// with their *current* bank details and a total. The admin pays each person
// manually from their own bank app, then marks them paid via /mark-paid.
router.get("/admin/payouts/unpaid", async (req, res, next) => {
  try {
    const campusWhere =
      req.user.role === "SUPER_ADMIN"
        ? {}
        : { order: { restaurant: { campusId: req.user.campusId } } };

    const payouts = await prisma.payout.findMany({
      where: { ...campusWhere, status: { in: ["PENDING", "FAILED"] } },
      include: {
        order: {
          select: {
            restaurant: {
              select: { id: true, name: true, bankName: true, accountNumber: true, accountName: true },
            },
            delivery: {
              select: {
                rider: {
                  select: { id: true, user: { select: { name: true } }, bankName: true, accountNumber: true, accountName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const groups = new Map();
    for (const p of payouts) {
      const isRestaurant = p.type === "RESTAURANT";
      const recipient = isRestaurant ? p.order.restaurant : p.order.delivery?.rider;
      const key = `${p.type}-${recipient?.id ?? "unknown"}`;
      const existing = groups.get(key);

      if (existing) {
        existing.total += Number(p.amount);
        existing.deliveries += 1;
        existing.payoutIds.push(p.id);
      } else {
        groups.set(key, {
          type: p.type,
          name: isRestaurant ? recipient?.name : recipient?.user?.name,
          bankName: recipient?.bankName || null,
          accountNumber: recipient?.accountNumber || null,
          accountName: recipient?.accountName || null,
          total: Number(p.amount),
          deliveries: 1,
          payoutIds: [p.id],
        });
      }
    }

    const unpaid = Array.from(groups.values()).sort(
      (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
    );

    res.status(200).json({ unpaid });
  } catch (error) {
    next(error);
  }
});

// Mark unpaid payouts as paid manually (the admin sent the money from their own
// bank). Body: { payoutIds: number[] }. Only flips PENDING/FAILED rows.
router.post("/admin/payouts/mark-paid", async (req, res, next) => {
  try {
    const { payoutIds } = req.body;
    if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
      return res.status(400).json({ message: "payoutIds is required" });
    }

    const ids = payoutIds.map((id) => Number(id)).filter((n) => Number.isInteger(n));
    const campusWhere =
      req.user.role === "SUPER_ADMIN"
        ? {}
        : { order: { restaurant: { campusId: req.user.campusId } } };

    const result = await prisma.payout.updateMany({
      where: { id: { in: ids }, status: { in: ["PENDING", "FAILED"] }, ...campusWhere },
      data: {
        status: "SUCCESS",
        gatewayResponse: {
          method: "manual",
          paidBy: req.user.name,
          paidAt: new Date().toISOString(),
        },
      },
    });

    res.status(200).json({ message: "Payouts marked as paid", count: result.count });
  } catch (error) {
    next(error);
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
