import express from "express";
import prisma from "../config/prisma.js";
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();
router.post("/restaurants/:id/menu-items", authMiddleware, async (req, res) => {
  try {
    const { name, description, imageUrl, price, category } = req.body;
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
    res.status(201).json({
      message: " Menu created sucesfully",
      menu: newMenu,
    });
  } catch (error) {
    res.status(500).json({
      message: " Server error",
      error: error.message,
    });
  }
});

router.get("/restaurants/:id/menu-items", async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!restaurant) {
      return res.status(404).json({
        message: "restaurant not found",
      });
    }
    const restaurantId = Number(req.params.id);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        restaurantId,
      },
    });
    if (menuItems.length === 0) {
      return res.status(404).json({
        message: "Menu-item not found",
      });
    }
    res.status(200).json({
      message: "Menu-item fetched successfully",
      menuItems,
    });
  } catch (error) {
    res.status(500).json({
      message: "Does not exist",
      error: error.message,
    });
  }
});

router.put("/menu-items/:id", authMiddleware, async (req, res) => {
  try {
    const { name, description, price, imageUrl, category } = req.body;
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
      data: { name, description, price, category, imageUrl },
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
    res.status(200).json({
      message: "Menu items updated succesfully",
      update,
    });
  } catch (error) {
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
});

router.delete("/menu-items/:id", authMiddleware, async (req, res) =>{
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
    res.status(200).json({
      message: "Items deleted successfully",
      deleteMenuItem,
    });
    }catch(error){
        res.status(500).json({
            message: "Server error",
            error: error.message
        })
    }
})
export default router;
