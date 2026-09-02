// Create the application
import cors from "cors";
import express, { json } from "express"
import helmet from "helmet";
import morgan from "morgan";
import indexRoutes from "./routes/index.js"
import { globalLimiter } from "./middleware/rate-limiter.js";
import logger from "./utils/logger.js";
const app = express();
app.use(helmet());
app.use(morgan("dev"));
app.use(cors({
  origin: [
    process.env.CLIENT_URL,      // deployed web app
    "http://localhost:5173",     // local web dev (Vite)
    "http://localhost",          // Capacitor Android (androidScheme http)
    "https://localhost",         // Capacitor Android (androidScheme https)
    "capacitor://localhost",     // Capacitor iOS
  ].filter(Boolean),
}));

// Rider profile photos are sent as base64 data URLs, so raise the default
// 100kb body limit to leave comfortable headroom for a resized image.
app.use(express.json({ limit: "2mb" }))
app.set('trust proxy', 1)
app.get("/", (req, res) =>{
    res.json({
        message: "Welcome to the Food Delivery API"
    })
})
app.use(globalLimiter)
app.use(indexRoutes)
app.use((err, req, res, next) =>{
    logger.error(`${req.method} ${req.originalUrl} —`, err)
    const status= err.status || 500
    const message = err.status ? err.message: "Unexpected error occured"
    res.status(status).json({message})
})

export default app;