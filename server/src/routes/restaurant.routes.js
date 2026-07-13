import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import ownerMiddleware from "../middleware/owner.middleware.js";

const router = express.Router();
//Fetch all restaurants
router.get("/restaurants", async (req, res) => {
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    res.status(200).json({
      message: "Restaurants fetched succesfully",
      restaurants,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch restaurants",
      error: error.message,
    });
  }
});

//fetched 1 restaurant with ID
router.get("/restaurants/:id", async (req, res) => {
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
      message: "Restaurants fetched succesfully",
      restaurant,
    });
  } catch (error) {
    res.status(500).json({
      message: "Does not exist",
      error: error.message,
    });
  }
});

// creates a new restaurant
router.post("/restaurants", authMiddleware,ownerMiddleware ,async (req, res) => {
  try {
    const { name, description, address, phone, imageUrl } = req.body;
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
      message: "restaurant created succesfully",
      restaurant: newRestaurant,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server Error",
      error: error.message,
    });
  }
});

//Updates restaurants per ID
router.put("/restaurants/:id", authMiddleware, ownerMiddleware, async (req, res) => {
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
      message: "restaurant updated succesfully",
      update
    });

  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
});

export default router;
