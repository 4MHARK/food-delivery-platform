import express from "express";
import authMiddleware from "../middleware/auth.middleware.js";
import { saveSubscription, deleteSubscription } from "../services/push.js";
import { saveFcmToken, deleteFcmToken } from "../services/fcm.js";

const router = express.Router();

// The VAPID public key the browser needs to create a subscription (not secret).
router.get("/push/public-key", (req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(503).json({ message: "Push notifications are not configured" });
  }
  res.status(200).json({ publicKey });
});

// Save the caller's push subscription (one per device, upserted by endpoint).
router.post("/push/subscribe", authMiddleware, async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ message: "Invalid push subscription" });
    }
    await saveSubscription(req.user.id, subscription);
    res.status(200).json({ message: "Subscribed to push notifications" });
  } catch (error) {
    next(error);
  }
});

// Remove a subscription (logout or permission revoked).
router.post("/push/unsubscribe", authMiddleware, async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ message: "Endpoint is required" });
    await deleteSubscription(req.user.id, endpoint);
    res.status(200).json({ message: "Unsubscribed from push notifications" });
  } catch (error) {
    next(error);
  }
});

// Save the caller's FCM device token (native app). Upserted by token so a reinstall
// or re-login just reassigns the same device row instead of duplicating it.
router.post("/push/register-token", authMiddleware, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });
    await saveFcmToken(req.user.id, token);
    res.status(200).json({ message: "Push token registered" });
  } catch (error) {
    next(error);
  }
});

// Remove an FCM token (logout or app reinstall).
router.post("/push/unregister-token", authMiddleware, async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });
    await deleteFcmToken(req.user.id, token);
    res.status(200).json({ message: "Push token removed" });
  } catch (error) {
    next(error);
  }
});

export default router;
