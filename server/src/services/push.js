import webPush from "web-push";
import prisma from "../config/prisma.js";
import { bus } from "./events.js";
import { sendFcmToUsers } from "./fcm.js";

// Configure VAPID once, lazily — so importing this module is safe before env is ready.
let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[push] VAPID keys missing — web push disabled");
    return;
  }
  // `subject` is just metadata identifying the server to the push service.
  webPush.setVapidDetails("mailto:support@chowzilla.app", publicKey, privateKey);
  vapidReady = true;
}

// Save (or reassign) a browser's push subscription for a user. One row per device.
export async function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription;
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
}

export async function deleteSubscription(userId, endpoint) {
  return prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
}

// Send a push to specific users, or to everyone for a ["*"] broadcast.
export async function sendPushToUsers(userIds, payload) {
  ensureVapid();
  if (!vapidReady) return;

  const subs = userIds.includes("*")
    ? await prisma.pushSubscription.findMany()
    : await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });

  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map((sub) =>
      webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        body
      )
    )
  );

  // Drop endpoints the push service reports as gone (404/410) so they don't accumulate.
  results.forEach((r, i) => {
    if (r.status === "rejected" && [404, 410].includes(r.reason?.statusCode)) {
      prisma.pushSubscription.delete({ where: { id: subs[i].id } }).catch(() => {});
    }
  });
}

const EVENT_MESSAGES = {
  "order:updated": { title: "Order update", body: "Your order status has changed." },
  "order:accepted": { title: "Order accepted", body: "The restaurant accepted your order." },
  "delivery:updated": { title: "Delivery update", body: "Your delivery status has changed." },
  "review:created": { title: "New review ⭐", body: "You received a new review." },
};

// Mirror the SSE listener: the same bus events also fire a web push.
export function startPushListener() {
  for (const [event, message] of Object.entries(EVENT_MESSAGES)) {
    bus.on(event, (recipientIds) => {
      const payload = { ...message, url: "/" };
      sendPushToUsers(recipientIds, payload).catch((e) => console.error("[push]", e));
      sendFcmToUsers(recipientIds, payload).catch((e) => console.error("[fcm]", e));
    });
  }
}
