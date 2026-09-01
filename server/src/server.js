// Run The application
import "dotenv/config"
import app from "./app.js"
import logger from "./utils/logger.js"
import { startPushListener } from "./services/push.js"

const PORT = process.env.PORT || 5000

startPushListener();

app.listen(PORT, () =>{
    logger.info(`Server is Running on Port ${PORT}`);
})