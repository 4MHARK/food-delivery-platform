// Run The application
import "dotenv/config"
import app from "./app.js"
import logger from "./utils/logger.js"
import { startPushListener } from "./services/push.js"
import { startPayoutVerifier } from "./services/payouts.js"
import { startStaleOrderSweeper } from "./services/inventory.js"
import { startStaleDeliverySweeper } from "./services/deliveryQueue.js"

const PORT = process.env.PORT || 5000

startPushListener();
startPayoutVerifier();
startStaleOrderSweeper();
startStaleDeliverySweeper();

app.listen(PORT, () =>{
    logger.info(`Server is Running on Port ${PORT}`);
})