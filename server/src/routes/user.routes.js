import express from "express";
import prisma from "../config/prisma.js";

const router = express.Router();

router.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany();

    res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch users",
      error: error.message,
    });
  }
});

router.post("/users", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required",
      });
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password,
      },
    });

    res.status(201).json({
      message: "User created successfully",
      user: newUser,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create user",
      error: error.message,
    });
  }
});

export default router;