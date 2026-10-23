import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import riderMiddleware from "../middleware/rider.middleware.js";
import { validate } from "../middleware/validate.js";
import { riderRegisterSchema, riderUpdateSchema, bankDetailsSchema } from "../validation/schemas.js";
import { createTransferRecipient } from "../services/paystack.js";

const router = express.Router();

// Payout accounts are often registered in a different name order or include
// extra middle names. Flag only when there is no shared name token at all.
const nameTokens = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

const accountNameDoesNotMatch = (profileName, accountName) => {
  if (!accountName) return false;
  const profile = new Set(nameTokens(profileName));
  return !nameTokens(accountName).some((token) => profile.has(token));
};

// Register a rider profile
router.post("/riders/register", authMiddleware, validate(riderRegisterSchema), async (req, res, next) => {
  try {
    const { vehicleType, licensePlate, licenseNumber, matricNumber, phone, photo } = req.body;

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

    // The rider picks a campus; fall back to the first one only when the
    // client omits it (older clients). Without this, every rider landed in
    // campus #1 and could never see orders from their own campus.
    const { campusId } = req.body;
    const campus = campusId
      ? await prisma.campus.findUnique({ where: { id: Number(campusId) } })
      : await prisma.campus.findFirst({ orderBy: { id: "asc" } });

    if (!campus) {
      return res.status(400).json({ message: "Select a valid campus" });
    }

    const rider = await prisma.rider.create({
      data: {
        userId: req.user.id,
        vehicleType,
        licensePlate: licensePlate || null,
        licenseNumber: licenseNumber || null,
        matricNumber: matricNumber || null,
        photoUrl: photo,
        campusId: campus.id,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
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
          select: { id: true, name: true, email: true, phone: true },
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
    const { vehicleType, licensePlate, licenseNumber, matricNumber, phone, isAvailable, photo, campusId } = req.body;

    const rider = await prisma.rider.findUnique({
      where: { userId: req.user.id },
    });

    if (!rider) {
      return res.status(404).json({
        message: "Rider profile not found. Please register first.",
      });
    }

    // Validate the resulting identification method, not just the fields that
    // were sent — switching between license and matric requires clearing the
    // other one in the same request.
    const nextLicensePlate = licensePlate !== undefined ? licensePlate : rider.licensePlate;
    const nextLicenseNumber = licenseNumber !== undefined ? licenseNumber : rider.licenseNumber;
    const nextMatricNumber = matricNumber !== undefined ? matricNumber : rider.matricNumber;
    const hasLicense = Boolean(nextLicensePlate || nextLicenseNumber);
    const hasMatric = Boolean(nextMatricNumber);

    if (hasLicense && hasMatric) {
      return res.status(400).json({
        message: "Choose either a driver's license or a matric number, not both.",
      });
    }
    if (hasLicense && (!nextLicensePlate || !nextLicenseNumber)) {
      return res.status(400).json({
        message: "Both the license plate and license number are required.",
      });
    }
    if (!hasLicense && !hasMatric) {
      return res.status(400).json({
        message: "Provide a driver's license or a matric number.",
      });
    }

    let campus = null;
    if (campusId !== undefined) {
      campus = await prisma.campus.findUnique({ where: { id: Number(campusId) } });
      if (!campus) {
        return res.status(400).json({ message: "Select a valid campus" });
      }
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
        ...(photo !== undefined && { photoUrl: photo }),
        ...(campus && { campusId: campus.id }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, phone: true },
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

    const accountName = recipient.accountName || rider.user.name;
    const nameMismatch = recipient.accountName
      ? accountNameDoesNotMatch(rider.user.name, recipient.accountName)
      : false;

    const updated = await prisma.rider.update({
      where: { userId: req.user.id },
      data: {
        bankName: bankName || null,
        bankCode,
        accountNumber,
        accountName,
        recipientCode: recipient.recipientCode,
      },
    });

    res.status(200).json({
      message: "Bank details saved",
      nameMismatch,
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
      // Hide failed attempts that were replaced by a retry.
      where: { type: "RIDER", order: { delivery: { riderId: rider.id } }, supersededBy: null },
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
