import express from "express"
import userRoutes from "./user.routes.js"
const router = express.Router();
router.get("/health", (req, res) =>{
    res.status(200).json({
        message: "API is Healthy"
    })
})
router.use(userRoutes);
export default router; 