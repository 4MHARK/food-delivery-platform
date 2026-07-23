import express from "express";
import jwt from "jsonwebtoken";
import { bus } from "../services/events.js";

const router = express.Router();

router.get("/events", (req, res) => {
  // Auth: try Authorization header first, then query param (EventSource can't set headers)
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (req.query.token) {
    token = req.query.token;
  } else {
    return res.status(401).json({ message: "Authentication required" });
  }

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
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

export default router;
