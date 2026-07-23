import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import riderMiddleware from "../middleware/rider.middleware.js";

const router = express.Router();

// Register a rider profile
router.post("/riders/register", authMiddleware, async (req, res) => {
  try {
    const { vehicleType, licensePlate, licenseNumber, matricNumber, phone } = req.body;

    // ── Validation ──

    // vehicleType and phone are always required
    if (!vehicleType || !phone) {
      return res.status(400).json({
        message: "vehicleType and phone are required",
      });
    }

    // Must provide either driver's license OR matric number (not both, not neither)
    const hasLicense = licensePlate || licenseNumber;
    const hasMatric = !!matricNumber;

    if (!hasLicense && !hasMatric) {
      return res.status(400).json({
        message: "Provide either a driver's license (plate + number) or a matriculation number",
      });
    }

    if (hasLicense && hasMatric) {
      return res.status(400).json({
        message: "Provide either a driver's license OR a matriculation number, not both",
      });
    }

    // License path: both plate and number required
    if (hasLicense && (!licensePlate || !licenseNumber)) {
      return res.status(400).json({
        message: "Both license plate and license number are required for license registration",
      });
    }

    // Format validations
    if (licensePlate && !/^[A-Za-z0-9]{2,15}$/.test(licensePlate.replace(/\s/g, ""))) {
      return res.status(400).json({
        message: "License plate must be 2-15 alphanumeric characters",
      });
    }

    if (licenseNumber && !/^[A-Za-z0-9][-A-Za-z0-9]{4,20}$/.test(licenseNumber)) {
      return res.status(400).json({
        message: "License number must be 5-20 characters (letters, numbers, hyphens)",
      });
    }

    if (matricNumber && !/^[A-Za-z0-9/-]{5,20}$/.test(matricNumber)) {
      return res.status(400).json({
        message: "Matric number must be 5-20 alphanumeric characters",
      });
    }

    // Phone: must be 10-15 digits, optionally starting with +
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      return res.status(400).json({
        message: "Phone number must be 10-15 digits",
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
    console.error("PUT /riders/me error:", error);
    res.status(500).json({
      message: error.message || "Server error",
    });
  }
});

export default router;
