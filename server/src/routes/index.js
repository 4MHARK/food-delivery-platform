import express from "express"
import userRoutes from "./user.routes.js"
import restaurantRoutes from "./restaurant.routes.js"
import menuRoutes from "./menu-item.routes.js"
import orderRoutes from "./order.routes.js"
import paymentRoutes from "./payment.routes.js"
const router = express.Router();
router.get("/health", (req, res) =>{
    res.status(200).json({
        message: "API is Healthy"
    })
})
router.use(userRoutes);
router.use(restaurantRoutes);
router.use(menuRoutes);
router.use(orderRoutes);
router.use(paymentRoutes);
export default router; 
