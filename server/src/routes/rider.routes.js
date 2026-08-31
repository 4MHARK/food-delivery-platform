import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import riderMiddleware from "../middleware/rider.middleware.js";
import { validate } from "../middleware/validate.js";
import { riderRegisterSchema, riderUpdateSchema, bankDetailsSchema } from "../validation/schemas.js";
import { createTransferRecipient } from "../services/paystack.js";

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

    // Store the rider's contact number on the User record (single source of truth)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { phone },
    });

    // Default new riders to the Main Campus (explicit campus picker is a follow-up).
    const campus = await prisma.campus.findFirst({ where: { name: "Main Campus" } });
    if (!campus) {
      return res.status(500).json({ message: "Default campus not found. Run the migration first." });
    }

    const rider = await prisma.rider.create({
      data: {
        userId: req.user.id,
        vehicleType,
        licensePlate: licensePlate || null,
        licenseNumber: licenseNumber || null,
        matricNumber: matricNumber || null,
        campusId: campus.id,
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

    // Phone lives on the User record now — sync it there if provided
    if (phone !== undefined) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { phone },
      });
    }

    const updated = await prisma.rider.update({
      where: { userId: req.user.id },
      data: {
        ...(vehicleType !== undefined && { vehicleType }),
        ...(licensePlate !== undefined && { licensePlate }),
        ...(licenseNumber !== undefined && { licenseNumber }),
        ...(matricNumber !== undefined && { matricNumber }),
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

// Save the rider's bank account (creates a Paystack transfer recipient)
router.put("/riders/me/bank", authMiddleware, riderMiddleware, validate(bankDetailsSchema), async (req, res, next) => {
  try {
    const { accountNumber, bankCode, bankName } = req.body;

    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
      include: { user: { select: { name: true } } },
    });

    if (!rider) {
      return res.status(404).json({ message: "Rider profile not found. Please register first." });
    }

    const recipient = await createTransferRecipient({
      name: rider.user.name,
      accountNumber,
      bankCode,
    });

    if (!recipient.ok) {
      return res.status(400).json({ message: recipient.message || "Invalid bank details" });
    }

    const updated = await prisma.rider.update({
      where: { userId: req.user.id },
      data: {
        bankName: bankName || null,
        bankCode,
        accountNumber,
        accountName: recipient.accountName || rider.user.name,
        recipientCode: recipient.recipientCode,
      },
    });

    res.status(200).json({
      message: "Bank details saved",
      rider: {
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

// Rider's payout history
router.get("/riders/payouts", authMiddleware, riderMiddleware, async (req, res, next) => {
  try {
    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({ message: "Rider profile not found. Please register first." });
    }

    const payouts = await prisma.payout.findMany({
      where: { type: "RIDER", order: { delivery: { riderId: rider.id } } },
      include: { order: { select: { id: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      message: "Payouts fetched successfully",
      payouts: payouts.map((p) => ({
        id: p.id,
        orderId: p.orderId,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
