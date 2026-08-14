// Create the application
import cors from "cors";
import express, { json } from "express"
import helmet from "helmet";
import indexRoutes from "./routes/index.js"
import { globalLimiter } from "./middleware/rate-limiter.js";
const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
}));

app.use(express.json())
app.set('trust proxy', 1)
app.get("/", (req, res) =>{
    res.json({
        message: "Welcome to the Food Delivery API"
    })
})
app.use(globalLimiter)
app.use(indexRoutes)
app.use((err, req, res, next) =>{
    console.error(err)
    const status= err.status || 500
    const message = err.status ? err.message: "Unexpected error occured"
    res.status(status).json({message})
})

export default app;