import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import ownerMiddleware from "../middleware/owner.middleware.js";
import { validate } from "../middleware/validate.js";
import { restaurantSchema, bankDetailsSchema } from "../validation/schemas.js";
import { createTransferRecipient } from "../services/paystack.js";

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
    // Only approved restaurants are visible to customers.
    const where = {
      approvalStatus: "APPROVED",
      ...(category ? { menuItems: { some: { category } } } : {}),
    };
    const restaurants = await prisma.restaurant.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    res.status(200).json({
      message: "Restaurants fetched successfully",
      restaurants: await attachRatings(restaurants),
    });
  } catch (error) {
  next(error)
  }
});

//fetched 1 restaurant with ID
router.get("/restaurants/:id", async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id), approvalStatus: "APPROVED" },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!restaurant) {
      return res.status(404).json({
        message: "restaurant not found",
      });
    }

    res.status(200).json({
      message: "Restaurants fetched successfully",
      restaurant: (await attachRatings([restaurant]))[0],
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
      include: { owner: { select: { id: true, name: true, email: true } } },
    });
    res.status(200).json({ restaurant: restaurant || null });
  } catch (error) {
  next(error)
  }
});

// creates a new restaurant
router.post("/restaurants", authMiddleware, ownerMiddleware, validate(restaurantSchema), async (req, res, next) => {
  try {
    const { name, description, address, phone, imageUrl } = req.body;

    // Enforce 1 restaurant per owner
    const existing = await prisma.restaurant.findFirst({ where: { ownerId: req.user.id } });
    if (existing) {
      return res.status(400).json({ message: "You already have a restaurant. Each owner can only have one restaurant." });
    }

    // Default new restaurants to the Main Campus (explicit campus picker is a follow-up).
    const campus = await prisma.campus.findFirst({ where: { name: "Main Campus" } });
    if (!campus) {
      return res.status(500).json({ message: "Default campus not found. Run the migration first." });
    }

    const newRestaurant = await prisma.restaurant.create({
      data: {
        name,
        description,
        address,
        phone,
        imageUrl,
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

    res.status(201).json({
      message: "restaurant created successfully",
      restaurant: newRestaurant,
    });
  } catch (error) {
  next(error)
  }
});

//Updates restaurants per ID
router.put("/restaurants/:id", authMiddleware, ownerMiddleware, validate(restaurantSchema), async (req, res, next) => {
  try {
     const { name, description, address, phone, imageUrl } = req.body;
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
      data: { name, description, address, phone, imageUrl },
      include:{
        owner:{
          select:{
            id: true, name: true, email: true 
          }
        }
      }
    });

    res.status(200).json({
      message: "restaurant updated successfully",
      update
    });

  } catch (error) {
  next(error)
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
      where: { type: "RESTAURANT", order: { restaurantId: restaurant.id } },
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
        pending: sum(payouts.filter((p) => p.status === "PENDING")),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
