import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";
import ownerMiddleware from "../middleware/owner.middleware.js";
import optionalAuthMiddleware from "../middleware/optional-auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { menuItemSchema, inventoryUpdateSchema } from "../validation/schemas.js";
import { cacheGet, cacheSet, cacheClear } from "../services/cache.js";
import { serializeMenuItem, announceMenuUpdate } from "../services/inventory.js";
import { computeOpenStatus } from "../services/hours.js";

const router = express.Router();

// Fetch all distinct menu-item categories (powers the browse filter pills)
router.get("/categories", async (req, res, next) => {
  try {
    const cached = cacheGet("categories");
    if (cached) return res.status(200).json(cached);

    const categories = await prisma.menuItem.findMany({
      where: { restaurant: { approvalStatus: "APPROVED" } },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    const body = {
      message: "Categories fetched successfully",
      categories: categories.map((c) => c.category),
    };
    cacheSet("categories", body);
    res.status(200).json(body);
  } catch (error) {
    next(error);
  }
});

router.post("/restaurants/:id/menu-items", authMiddleware, ownerMiddleware, validate(menuItemSchema), async (req, res, next) => {
  try {
    const { name, description, imageUrl, price, category, stockQuantity } = req.body;
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!restaurant) {
      return res.status(404).json({
        message: "restaurant not found",
      });
    }
    if (restaurant.ownerId !== req.user.id) {
      return res.status(403).json({
        message: "You can only edit your restaurant",
      });
    }
    const newMenu = await prisma.menuItem.create({
      data: {
        name,
        description,
        imageUrl,
        price,
        category,
        stockQuantity: stockQuantity ?? null,
        restaurantId: Number(req.params.id),
      },
      include: {
        restaurant: {
          include: {
            owner: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
    cacheClear();
    announceMenuUpdate(Number(req.params.id));
    res.status(201).json({
      message: " Menu created successfully",
      menu: newMenu,
    });
  } catch (error) {
   next(error)
  }
});

router.get("/restaurants/:id/menu-items", optionalAuthMiddleware, async (req, res, next) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id) },
      select: { id: true, ownerId: true, approvalStatus: true },
    });
    if (!restaurant) {
      return res.status(404).json({
        message: "restaurant not found",
      });
    }

    const isOwner = req.user?.id === restaurant.ownerId;
    const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(req.user?.role);

    // Unapproved menus are visible only to their owner or an admin.
    if (!isOwner && !isAdmin && restaurant.approvalStatus !== "APPROVED") {
      return res.status(404).json({
        message: "restaurant not found",
      });
    }

    // Owners and admins need unavailable items so they can re-enable them; the
    // public menu only shows items that can actually be ordered.
    const includeUnavailable = isOwner || isAdmin;
    const cacheKey = includeUnavailable ? null : `menu:${restaurant.id}`;

    if (cacheKey) {
      const cached = cacheGet(cacheKey);
      if (cached) return res.status(200).json(cached);
    }

    const menuItems = await prisma.menuItem.findMany({
      where: {
        restaurantId: restaurant.id,
        ...(includeUnavailable ? {} : { isAvailable: true }),
      },
    });
    const body = {
      message: "Menu-item fetched successfully",
      menuItems: menuItems.map(serializeMenuItem),
    };
    if (cacheKey) cacheSet(cacheKey, body);
    res.status(200).json(body);
  } catch (error) {
  next(error)
  }
});

router.put("/menu-items/:id", authMiddleware, ownerMiddleware, validate(menuItemSchema), async (req, res, next) => {
  try {
    const { name, description, price, imageUrl, category, stockQuantity } = req.body;
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: Number(req.params.id) },
      include: { restaurant: true },
    });
    if (!menuItem) {
      return res.status(404).json({
        message: "Menu item not found",
      });
    }
    if (menuItem.restaurant.ownerId !== req.user.id) {
      return res.status(403).json({
        message: " You can only update your menu items",
      });
    }
    const update = await prisma.menuItem.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        description,
        price,
        category,
        imageUrl,
        ...(stockQuantity !== undefined ? { stockQuantity } : {}),
      },
      include: {
        restaurant: {
          include: {
            owner: { 
                select: {id: true, name: true} 
            },
          },
        },
      },
    });
    cacheClear();
    announceMenuUpdate(menuItem.restaurantId);
    res.status(200).json({
      message: "Menu items updated successfully",
      update,
    });
  } catch (error) {
   next(error)
  }
});

// Fast inventory controls from the owner's menu list. Accepts a new stock
// quantity (null = untrack/unlimited) and/or a manual availability toggle.
router.put("/menu-items/:id/inventory", authMiddleware, ownerMiddleware, validate(inventoryUpdateSchema), async (req, res, next) => {
  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true,
        restaurantId: true,
        restaurant: { select: { ownerId: true } },
      },
    });

    if (!menuItem) {
      return res.status(404).json({ message: "Menu item not found" });
    }
    if (menuItem.restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ message: "You can only update your menu items" });
    }

    const { stockQuantity, isAvailable } = req.body;

    const updated = await prisma.menuItem.update({
      where: { id: menuItem.id },
      data: {
        ...(stockQuantity !== undefined ? { stockQuantity } : {}),
        ...(isAvailable !== undefined ? { isAvailable } : {}),
      },
    });

    cacheClear();
    announceMenuUpdate(menuItem.restaurantId);

    res.status(200).json({
      message: "Stock updated",
      item: serializeMenuItem(updated),
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/menu-items/:id", authMiddleware,ownerMiddleware ,async (req, res, next) =>{
    try{
          const menuItem = await prisma.menuItem.findUnique({
        where:{ id: Number(req.params.id)},
          include: {
        restaurant: {
          select: {
            id: true,
            ownerId: true,
          },
        },
      },
    })
    if(!menuItem){
        return res.status(404).json({
            message: "No menu item found"
        })
    }
     if (menuItem.restaurant.ownerId !== req.user.id) {
      return res.status(403).json({
        message: "You are not allowed to delete this menu item",
      });
    }
    const deleteMenuItem = await prisma.menuItem.delete({
           where: { id: Number(req.params.id) },
      include: {
        restaurant: {
          include: {
            owner: { 
                select: {id: true, name: true} 
            },
          },
        },
      },
    });
    cacheClear();
    announceMenuUpdate(menuItem.restaurantId);
    res.status(200).json({
      message: "Items deleted successfully",
      deleteMenuItem,
    });
    }catch(error){
     next(error)
    }
})
// Search menu items AND restaurants by name in one query
router.get("/search", async (req, res, next) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      return res.status(400).json({ message: "Search query 'q' is required" });
    }

    const [menuItems, restaurants] = await Promise.all([
      prisma.menuItem.findMany({
        where: {
          isAvailable: true,
          name: { contains: q, mode: "insensitive" },
          restaurant: { approvalStatus: "APPROVED" },
        },
        include: {
          restaurant: {
            select: { id: true, name: true, imageUrl: true, address: true },
          },
        },
        take: 30,
      }),
      prisma.restaurant.findMany({
        where: {
          approvalStatus: "APPROVED",
          name: { contains: q, mode: "insensitive" },
        },
        select: {
          id: true,
          name: true,
          imageUrl: true,
          address: true,
          description: true,
          isOpen: true,
          hours: {
            select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
            orderBy: { dayOfWeek: "asc" },
          },
        },
        take: 10,
      }),
    ]);

    res.status(200).json({
      message: "Search results fetched successfully",
      menuItems: menuItems.map(serializeMenuItem),
      restaurants: restaurants.map((restaurant) => ({
        ...restaurant,
        ...computeOpenStatus(restaurant),
      })),
    });
  } catch (error) {
    next(error);
  }
});
export default router;
