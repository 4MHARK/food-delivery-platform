import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { reviewSchema } from "../validation/schemas.js";
import { notify } from "../services/events.js";

const router = express.Router();

// ── Restaurant reviews ──

// List reviews for a restaurant (public)
router.get("/restaurants/:id/reviews", async (req, res, next) => {
  try {
    const restaurantId = Number(req.params.id);

    const reviews = await prisma.restaurantReview.findMany({
      where: { restaurantId },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Reviews fetched successfully",
      reviews,
    });
  } catch (error) {
    next(error);
  }
});

// Create / update the caller's review for a restaurant (verified customers only)
router.post("/restaurants/:id/reviews", authMiddleware, validate(reviewSchema), async (req, res, next) => {
  try {
    const restaurantId = Number(req.params.id);
    const { rating, comment } = req.body;

    // Eligibility: the caller must have a DELIVERED order from this restaurant
    const eligible = await prisma.order.findFirst({
      where: {
        customerId: req.user.id,
        restaurantId,
        status: "DELIVERED",
      },
    });

    if (!eligible) {
      return res.status(403).json({
        message: "You can only review a restaurant after completing an order there.",
      });
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { ownerId: true },
    });

    const review = await prisma.restaurantReview.upsert({
      where: {
        authorId_restaurantId: {
          authorId: req.user.id,
          restaurantId,
        },
      },
      create: {
        rating,
        comment: comment || null,
        authorId: req.user.id,
        restaurantId,
      },
      update: {
        rating,
        comment: comment || null,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    if (restaurant?.ownerId) {
      notify("review:created", [restaurant.ownerId]);
    }

    res.status(200).json({
      message: "Review saved successfully",
      review,
    });
  } catch (error) {
    next(error);
  }
});

// ── Rider reviews ──

// List reviews for a rider (public)
router.get("/riders/:id/reviews", async (req, res, next) => {
  try {
    const riderId = Number(req.params.id);

    const reviews = await prisma.riderReview.findMany({
      where: { riderId },
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Reviews fetched successfully",
      reviews,
    });
  } catch (error) {
    next(error);
  }
});

// Create / update the caller's review for a rider (verified customers only)
router.post("/riders/:id/reviews", authMiddleware, validate(reviewSchema), async (req, res, next) => {
  try {
    const riderId = Number(req.params.id);
    const { rating, comment } = req.body;

    // Eligibility: the caller must have been the customer of a DELIVERED delivery by this rider
    const eligible = await prisma.delivery.findFirst({
      where: {
        riderId,
        status: "DELIVERED",
        order: {
          customerId: req.user.id,
        },
      },
    });

    if (!eligible) {
      return res.status(403).json({
        message: "You can only review a rider after they complete one of your deliveries.",
      });
    }

    const rider = await prisma.rider.findUnique({
      where: { id: riderId },
      select: { userId: true },
    });

    const review = await prisma.riderReview.upsert({
      where: {
        authorId_riderId: {
          authorId: req.user.id,
          riderId,
        },
      },
      create: {
        rating,
        comment: comment || null,
        authorId: req.user.id,
        riderId,
      },
      update: {
        rating,
        comment: comment || null,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    if (rider?.userId) {
      notify("review:created", [rider.userId]);
    }

    res.status(200).json({
      message: "Review saved successfully",
      review,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
