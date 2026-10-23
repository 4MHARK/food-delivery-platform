import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import ownerMiddleware from "../middleware/owner.middleware.js";
import { validate } from "../middleware/validate.js";
import { restaurantSchema, restaurantHoursSchema, bankDetailsSchema } from "../validation/schemas.js";
import { createTransferRecipient } from "../services/paystack.js";
import { cacheGet, cacheSet, cacheClear } from "../services/cache.js";
import { computeOpenStatus } from "../services/hours.js";
import { notify } from "../services/events.js";
import { PUBLIC_RESTAURANT_SELECT } from "../utils/selects.js";

const router = express.Router();

// Attach avgRating / reviewCount to restaurant records (single groupBy — no N+1)
async function attachRatings(restaurants) {
  const ids = restaurants.map((r) => r.id);
  const agg = await prisma.restaurantReview.groupBy({
    by: ["restaurantId"],
    where: { restaurantId: { in: ids } },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const map = new Map(agg.map((a) => [a.restaurantId, a]));
  return restaurants.map((r) => {
    const a = map.get(r.id);
    return {
      ...r,
      avgRating: a?._avg.rating != null ? Math.round(a._avg.rating * 10) / 10 : null,
      reviewCount: a ? a._count._all : 0,
    };
  });
}

//Fetch all restaurants
router.get("/restaurants", async (req, res, next) => {
  try {
    const { category } = req.query;
    const cacheKey = category ? `restaurants:${category}` : "restaurants";

    const cached = cacheGet(cacheKey);
    if (cached) return res.status(200).json(cached);

    // Only approved restaurants are visible to customers.
    const where = {
      approvalStatus: "APPROVED",
      ...(category ? { menuItems: { some: { category } } } : {}),
    };
    const restaurants = await prisma.restaurant.findMany({
      where,
      select: PUBLIC_RESTAURANT_SELECT,
    });
    const withRatings = await attachRatings(restaurants);
    const body = {
      message: "Restaurants fetched successfully",
      restaurants: withRatings.map((restaurant) => ({
        ...restaurant,
        ...computeOpenStatus(restaurant),
      })),
    };
    cacheSet(cacheKey, body);
    res.status(200).json(body);
  } catch (error) {
    next(error)
  }
});

//fetched 1 restaurant with ID
router.get("/restaurants/:id", async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id), approvalStatus: "APPROVED" },
   select: PUBLIC_RESTAURANT_SELECT,
    });

    if (!restaurant) {
      return res.status(404).json({
        message: "restaurant not found",
      });
    }

    const withRatings = (await attachRatings([restaurant]))[0];
    res.status(200).json({
      message: "Restaurants fetched successfully",
      restaurant: { ...withRatings, ...computeOpenStatus(withRatings) },
    });
  } catch (error) {
    next(error)
  }
});

// Get the current owner's restaurant (or null)
router.get("/my-restaurant", authMiddleware, async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findFirst({
      where: { ownerId: req.user.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        hours: { orderBy: { dayOfWeek: "asc" } },
      },
    });
    res.status(200).json({
      restaurant: restaurant ? { ...restaurant, ...computeOpenStatus(restaurant) } : null,
    });
  } catch (error) {
    next(error)
  }
});

// creates a new restaurant
router.post(
  "/restaurants",
  authMiddleware,
  ownerMiddleware,
  validate(restaurantSchema),
  async (req, res, next) => {
    try {
      const {
        name,
        description,
        address,
        phone,
        imageUrl,
        lat,
        lng,
      } = req.body;

      // Enforce 1 restaurant per owner
      const existing = await prisma.restaurant.findFirst({
        where: { ownerId: req.user.id },
      });

      if (existing) {
        return res.status(400).json({
          message:
            "You already have a restaurant. Each owner can only have one restaurant.",
        });
      }

      // Find the default campus
     const campus = await prisma.campus.findFirst({ orderBy: { id: "asc" } });

      if (!campus) {
        return res.status(500).json({
          message: "Default campus not found. Run the migration first.",
        });
      }

      // Create the restaurant
      const newRestaurant = await prisma.restaurant.create({
        data: {
          name,
          description,
          address,
          phone,
          imageUrl,
          lat: lat ?? null,
          lng: lng ?? null,
          ownerId: req.user.id,
          campusId: campus.id,
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      cacheClear();

      return res.status(201).json({
        message: "restaurant created successfully",
        restaurant: newRestaurant,
      });
    } catch (error) {
      next(error);
    }
  }
);
//Updates restaurants per ID
router.put("/restaurants/:id", authMiddleware, ownerMiddleware, validate(restaurantSchema), async (req, res, next) => {
  try {
    const { name, description, address, phone, imageUrl, lat, lng } = req.body;
    const restaurant = await prisma.restaurant.findUnique({
      where: {
        id: Number(req.params.id),
      },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "restaurant not found" });
    }
    if (restaurant.ownerId !== req.user.id) {
      return res.status(403).json({
        message: "You can only edit your restaurant",
      });
    }
    const update = await prisma.restaurant.update({
      where: { id: Number(req.params.id) },
      data: {
        name, description, address, phone, imageUrl,
        // Preserve existing coordinates when the edit form omits them; save
        // them when the owner sets a location (or clicks "Use my location").
        ...(lat !== undefined && { lat }),
        ...(lng !== undefined && { lng }),
      },
      include: {
        owner: {
          select: {
            id: true, name: true, email: true
          }
        }
      }
    });

    cacheClear();
    res.status(200).json({
      message: "restaurant updated successfully",
      update
    });

  } catch (error) {
    next(error)
  }
});

// Toggle the manual "accepting orders" switch (owner)
router.put("/restaurants/:id/availability", authMiddleware, ownerMiddleware, async (req, res, next) => {
  try {
    const { isOpen } = req.body;
    if (typeof isOpen !== "boolean") {
      return res.status(400).json({ message: "isOpen must be true or false" });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, ownerId: true },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "restaurant not found" });
    }
    if (restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your restaurant" });
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { isOpen },
      select: { id: true, isOpen: true },
    });

    cacheClear();
    notify("restaurant:updated", ["*"], { restaurantId: updated.id });

    const withHours = await prisma.restaurant.findUnique({
      where: { id: restaurant.id },
      select: {
        isOpen: true,
        hours: {
          select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
        },
      },
    });

    res.status(200).json({
      message: updated.isOpen ? "Restaurant is accepting orders" : "Restaurant is closed",
      isOpen: updated.isOpen,
      isOpenNow: computeOpenStatus(withHours).isOpenNow,
    });
  } catch (error) {
    next(error);
  }
});

// Replace the weekly schedule (owner). An empty array means "always open".
router.put("/restaurants/:id/hours", authMiddleware, ownerMiddleware, validate(restaurantHoursSchema), async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, ownerId: true },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "restaurant not found" });
    }
    if (restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your restaurant" });
    }

    const { hours } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.restaurantHours.deleteMany({ where: { restaurantId: restaurant.id } });
      if (hours.length > 0) {
        await tx.restaurantHours.createMany({
          data: hours.map((day) => ({
            restaurantId: restaurant.id,
            dayOfWeek: day.dayOfWeek,
            openTime: day.isClosed ? null : day.openTime,
            closeTime: day.isClosed ? null : day.closeTime,
            isClosed: day.isClosed,
          })),
        });
      }
    });

    cacheClear();
    notify("restaurant:updated", ["*"], { restaurantId: restaurant.id });

    const saved = await prisma.restaurantHours.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { dayOfWeek: "asc" },
    });

    const restaurantState = await prisma.restaurant.findUnique({
      where: { id: restaurant.id },
      select: { isOpen: true },
    });

    res.status(200).json({
      message: "Opening hours saved",
      hours: saved,
      isOpenNow: computeOpenStatus({ isOpen: restaurantState.isOpen, hours: saved }).isOpenNow,
    });
  } catch (error) {
    next(error);
  }
});

// Save the owner's bank account (creates a Paystack transfer recipient)
router.put("/restaurants/:id/bank", authMiddleware, ownerMiddleware, validate(bankDetailsSchema), async (req, res, next) => {
  try {
    const { accountNumber, bankCode, bankName } = req.body;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id) },
      include: { owner: { select: { name: true } } },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your restaurant" });
    }

    const recipient = await createTransferRecipient({
      name: restaurant.owner.name,
      accountNumber,
      bankCode,
    });

    if (!recipient.ok) {
      return res.status(400).json({ message: recipient.message || "Invalid bank details" });
    }

    const updated = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: {
        bankName: bankName || null,
        bankCode,
        accountNumber,
        accountName: recipient.accountName || restaurant.owner.name,
        recipientCode: recipient.recipientCode,
      },
    });

    res.status(200).json({
      message: "Bank details saved",
      restaurant: {
        id: updated.id,
        bankName: updated.bankName,
        accountNumber: updated.accountNumber,
        accountName: updated.accountName,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Owner's payout history + earnings summary
router.get("/restaurants/:id/payouts", authMiddleware, ownerMiddleware, async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id) },
    });

    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }
    if (restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: "You can only view your restaurant's payouts" });
    }

    const payouts = await prisma.payout.findMany({
      // Superseded rows are old failed attempts replaced by a retry — hide them
      // so the history and summary don't double-count the same order.
      where: { type: "RESTAURANT", order: { restaurantId: restaurant.id }, supersededBy: null },
      include: { order: { select: { id: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });

    const sum = (rows) => rows.reduce((acc, p) => acc + Number(p.amount), 0);

    res.status(200).json({
      message: "Payouts fetched successfully",
      payouts: payouts.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt,
      })),
      summary: {
        totalEarned: sum(payouts),
        paidOut: sum(payouts.filter((p) => p.status === "SUCCESS")),
        // A reversed transfer came back to us, so it is still owed, not paid.
        pending: sum(payouts.filter((p) => p.status === "PENDING" || p.status === "REVERSED")),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
