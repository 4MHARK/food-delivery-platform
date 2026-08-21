import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import riderMiddleware from "../middleware/rider.middleware.js";
import { validate } from "../middleware/validate.js";
import { riderRegisterSchema, riderUpdateSchema } from "../validation/schemas.js";

const router = express.Router();

// Register a rider profile
router.post("/riders/register", authMiddleware, validate(riderRegisterSchema), async (req, res, next) => {
  try {
    const { vehicleType, licensePlate, licenseNumber, matricNumber, phone } = req.body;

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

    // Check for duplicate license number (only if provided)
    if (licenseNumber) {
      const duplicateLicense = await prisma.rider.findUnique({
        where: { licenseNumber },
      });
      if (duplicateLicense) {
        return res.status(400).json({
          message: "This license number is already registered",
        });
      }
    }

    // Check for duplicate matric number (only if provided)
    if (matricNumber) {
      const duplicateMatric = await prisma.rider.findUnique({
        where: { matricNumber },
      });
      if (duplicateMatric) {
        return res.status(400).json({
          message: "This matriculation number is already registered",
        });
      }
    }

    const rider = await prisma.rider.create({
      data: {
        userId: req.user.id,
        vehicleType,
        licensePlate: licensePlate || null,
        licenseNumber: licenseNumber || null,
        matricNumber: matricNumber || null,
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
   next(error)
  }
});

// Get the current rider's profile
router.get("/riders/me", authMiddleware, riderMiddleware, async (req, res, next) => {
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        _count: { select: { reviews: true } },
      },
    });

    if (!rider) {
      return res.status(404).json({
        message: "Rider profile not found. Please register first.",
      });
    }

    const agg = await prisma.riderReview.aggregate({
      where: { riderId: rider.id },
      _avg: { rating: true },
    });

    res.status(200).json({
      message: "Rider profile fetched successfully",
      rider: {
        ...rider,
        reviewCount: rider._count.reviews,
        avgRating: agg._avg.rating != null ? Math.round(agg._avg.rating * 10) / 10 : null,
      },
    });
  } catch (error) {
   next(error)
  }
});

// Update rider profile
router.put("/riders/me", authMiddleware, riderMiddleware, validate(riderUpdateSchema), async (req, res, next) => {
  try {
    const { vehicleType, licensePlate, licenseNumber, matricNumber, phone, isAvailable } = req.body;

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

    // If matricNumber is being changed, check uniqueness
    if (matricNumber && matricNumber !== rider.matricNumber) {
      const duplicateMatric = await prisma.rider.findUnique({
        where: { matricNumber },
      });
      if (duplicateMatric) {
        return res.status(400).json({
          message: "This matriculation number is already registered",
        });
      }
    }

    const updated = await prisma.rider.update({
      where: { userId: req.user.id },
      data: {
        ...(vehicleType !== undefined && { vehicleType }),
        ...(licensePlate !== undefined && { licensePlate }),
        ...(licenseNumber !== undefined && { licenseNumber }),
        ...(matricNumber !== undefined && { matricNumber }),
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
   next(error)
  }
});

export default router;
