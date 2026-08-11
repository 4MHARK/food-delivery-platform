import express from "express";
import { bus } from "../services/events.js";
import { createTicket, consumeTicket} from "../services/sseTickets.js"
import authMiddleware from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/events", (req, res) => {
const ticket = req.query.ticket;
if(!ticket){
  return res.status(401).json({message: "Ticket required"})
}
const userId = consumeTicket(ticket);
if(!userId){
  return res.status(400).json({message: "Invalid or expired ticket"})
}

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send an initial comment to flush headers
  res.write(":connected\n\n");

  // Handler: called whenever an event fires
  const handler = (recipientIds) => {
    // recipientIds is an array of userIds, or ["*"] for broadcast
    if (recipientIds.includes("*") || recipientIds.includes(userId)) {
      res.write("data: refresh\n\n");
    }
  };

  // Subscribe to all relevant events
  bus.on("delivery:updated", handler);
  bus.on("order:updated", handler);
  bus.on("order:accepted", handler);

  // Keep-alive ping every 30s to prevent proxy timeouts
  const keepAlive = setInterval(() => {
    res.write(":ping\n\n");
  }, 30000);

  // Cleanup on disconnect
  req.on("close", () => {
    clearInterval(keepAlive);
    bus.off("delivery:updated", handler);
    bus.off("order:updated", handler);
    bus.off("order:accepted", handler);
  });
});

router.post("/sseTicket",authMiddleware, async (req, res) =>{
  try{
    const userId = req.user.id;
    const ticket = createTicket(userId);
    res.status(200).json({ticket})
  }catch{
    res.status(500).json({
      message: "Failed to create ticket"
    })
  }
})

export default router;
