import express from "express";
import prisma from "../config/prisma.js";

const router = express.Router();

// Public: the customer address picker needs the campus landmark directory
// before it can place an order. Landmark names/coordinates are not sensitive.
router.get("/campuses/:campusId/landmarks", async (req, res, next) => {
  try {
    const campusId = Number(req.params.campusId);
    if (!Number.isInteger(campusId) || campusId <= 0) {
      return res.status(400).json({ message: "Invalid campus id" });
    }

    const campus = await prisma.campus.findUnique({
      where: { id: campusId },
      select: { id: true, name: true },
    });

    if (!campus) {
      return res.status(404).json({ message: "Campus not found" });
    }

    const landmarks = await prisma.campusLandmark.findMany({
      where: { campusId, isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        aliases: true,
        lat: true,
        lng: true,
        sortOrder: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    res.status(200).json({ campus, landmarks });
  } catch (error) {
    next(error);
  }
});

export default router;
