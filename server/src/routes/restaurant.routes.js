import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import ownerMiddleware from "../middleware/owner.middleware.js";
import { validate } from "../middleware/validate.js";
import { restaurantSchema } from "../validation/schemas.js";

const router = express.Router();
//Fetch all restaurants
router.get("/restaurants", async (req, res, next) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    res.status(200).json({
      message: "Restaurants fetched successfully",
      restaurants,
    });
  } catch (error) {
  next(error)
  }
});

//fetched 1 restaurant with ID
router.get("/restaurants/:id", async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id) },
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
      restaurant,
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

    const newRestaurant = await prisma.restaurant.create({
      data: {
        name,
        description,
        address,
        phone,
        imageUrl,
        ownerId: req.user.id,
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

export default router;
