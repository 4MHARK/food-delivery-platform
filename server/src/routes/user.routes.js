import express from "express";
import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"
import crypto from "crypto";
import authMiddleware from "../middleware/auth.middleware.js";
import { loginLimiter, registerLimiter, resetLimiter } from "../middleware/rate-limiter.js";
import { validate } from "../middleware/validate.js";
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "../validation/schemas.js";
import logger from "../utils/logger.js";
import { sendPasswordResetEmail } from "../services/mailer.js";


// Create a express app that only handles Routes
const router = express.Router();

router.get("/users", authMiddleware, async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
   next(error)
  }
});

router.post("/users", registerLimiter, validate(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password, role, phone } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "User with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        ...(phone && { phone }),
      },
    });

    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role, campusId: newUser.campusId },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "User created successfully",
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        campusId: newUser.campusId,
        phone: newUser.phone,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
   next(error)
  }
});

router.post("/users/login", loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }
     const token = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      campusId: user.campusId
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d"
    }
  )

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        campusId: user.campusId,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });

  } catch (error) {
  next(error)
  }
});

router.get("/users/profile", authMiddleware, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: req.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    return res.status(200).json({
      message: "Profile fetched successfully",
      user,
    });
  } catch (error) {
  next(error)
  }
});

router.put("/users/profile", authMiddleware, async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    // Check if email is already taken by another user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.id !== req.user.id) {
      return res.status(409).json({
        message: "Email is already in use by another account",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        email,
        ...(phone !== undefined && { phone }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
   next(error)
  }
});
router.post("/users/forgot-password", resetLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Generate a one-time token; store only its hash + expiry (never the raw token)
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt },
      });

      const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);

      // Fallback for local testing — the raw token is only ever logged, never returned to the client
      logger.info(`Password reset link for ${user.email}: ${resetUrl}`);
    } else {
      // Burn comparable time to when a user IS found, so timing doesn't reveal account existence
      await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10);
    }

    // Always the same response — do not reveal whether the email exists
    res.status(200).json({
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    next(error)
  }
});

router.post("/users/reset-password", resetLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        message: "This reset link is invalid or has expired. Please request a new one.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    res.status(200).json({
      message: "Password reset successfully. You can now log in.",
    });
  } catch (error) {
    next(error)
  }
});
export default router;