import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import riderMiddleware from "../middleware/rider.middleware.js";

const router = express.Router();

// Register a rider profile
router.post("/riders/register", authMiddleware, async (req, res) => {
  try {
    const { vehicleType, licensePlate, licenseNumber, phone } = req.body;

    if (!vehicleType || !licensePlate || !licenseNumber || !phone) {
      return res.status(400).json({
        message: "vehicleType, licensePlate, licenseNumber, and phone are required",
      });
    }

    // Only RIDER role users can register a rider profile
    if (req.user.role !== "RIDER") {
      return res.status(403).json({
        message: "Only users with the RIDER role can register a rider profile",
      });
    }

    // Check if user already has a rider profile
    const existing = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (existing) {
      return res.status(400).json({
        message: "You already have a rider profile",
      });
    }

    // Check for duplicate license number
    const duplicateLicense = await prisma.rider.findUnique({
      where: { licenseNumber },
    });

    if (duplicateLicense) {
      return res.status(400).json({
        message: "This license number is already registered",
      });
    }

    const rider = await prisma.rider.create({
      data: {
        userId: req.user.id,
        vehicleType,
        licensePlate,
        licenseNumber,
        phone,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({
      message: "Rider profile created successfully",
      rider,
    });
  } catch (error) {
    console.error("POST /riders/register error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

// Get the current rider's profile
router.get("/riders/me", authMiddleware, riderMiddleware, async (req, res) => {
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!rider) {
      return res.status(404).json({
        message: "Rider profile not found. Please register first.",
      });
    }

    res.status(200).json({
      message: "Rider profile fetched successfully",
      rider,
    });
  } catch (error) {
    console.error("GET /riders/me error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

// Update rider profile
router.put("/riders/me", authMiddleware, riderMiddleware, async (req, res) => {
  try {
    const { vehicleType, licensePlate, licenseNumber, phone, isAvailable } = req.body;

    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({
        message: "Rider profile not found. Please register first.",
      });
    }

    // If licenseNumber is being changed, check uniqueness
    if (licenseNumber && licenseNumber !== rider.licenseNumber) {
      const duplicateLicense = await prisma.rider.findUnique({
        where: { licenseNumber },
      });
      if (duplicateLicense) {
        return res.status(400).json({
          message: "This license number is already registered",
        });
      }
    }

    const updated = await prisma.rider.update({
      where: { userId: req.user.id },
      data: {
        ...(vehicleType !== undefined && { vehicleType }),
        ...(licensePlate !== undefined && { licensePlate }),
        ...(licenseNumber !== undefined && { licenseNumber }),
        ...(phone !== undefined && { phone }),
        ...(isAvailable !== undefined && { isAvailable }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(200).json({
      message: "Rider profile updated successfully",
      rider: updated,
    });
  } catch (error) {
    console.error("PUT /riders/me error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

export default router;
