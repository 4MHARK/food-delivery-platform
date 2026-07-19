// Create the application
import cors from "cors";
import express, { json } from "express"
import indexRoutes from "./routes/index.js"
const app = express();
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
}));

app.use(express.json())
app.get("/", (req, res) =>{
    res.json({
        message: "Welcome to the Food Delivery API"
    })
})
app.use(indexRoutes)

export default app;