import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

// List the current customer's favorited restaurants
router.get("/favorites", authMiddleware, async (req, res, next) => {
  try {
    const favorites = await prisma.customerFavorite.findMany({
      where: { userId: req.user.id },
      include: {
        restaurant: {
          include: { owner: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({
      message: "Favorites fetched successfully",
      favorites: favorites.map((f) => f.restaurant),
    });
  } catch (error) {
    next(error);
  }
});

// Add a restaurant to favorites (idempotent)
router.post("/restaurants/:id/favorite", authMiddleware, async (req, res, next) => {
  try {
    const restaurantId = Number(req.params.id);
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) {
      return res.status(404).json({ message: "restaurant not found" });
    }
    await prisma.customerFavorite.upsert({
      where: { userId_restaurantId: { userId: req.user.id, restaurantId } },
      create: { userId: req.user.id, restaurantId },
      update: {},
    });
    res.status(200).json({ message: "Added to favorites" });
  } catch (error) {
    next(error);
  }
});

// Remove a restaurant from favorites (idempotent)
router.delete("/restaurants/:id/favorite", authMiddleware, async (req, res, next) => {
  try {
    const restaurantId = Number(req.params.id);
    await prisma.customerFavorite.deleteMany({
      where: { userId: req.user.id, restaurantId },
    });
    res.status(200).json({ message: "Removed from favorites" });
  } catch (error) {
    next(error);
  }
});

export default router;
