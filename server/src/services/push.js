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
    : userIds.includes("riders")
    ? await prisma.pushSubscription.findMany({ where: { user: { role: "RIDER" } } })
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

// One message set per transition; each role (customer / owner / rider) gets its
// own title+body. A role omitted from the set simply receives no push for that
// transition. riderIds may hold real user ids or the literal "riders" (all riders).
const STATUS_MESSAGES = {
  PENDING_RESTAURANT_CONFIRMATION: {
    customer: { title: "Payment received", body: "Your order is on its way to the restaurant." },
    owner: { title: "New order 🛎️", body: "You have a new paid order to confirm." },
  },
  ACCEPTED: {
    customer: { title: "Order confirmed", body: "The restaurant accepted your order." },
  },
  PREPARING: {
    customer: { title: "Preparing your food 👨‍🍳", body: "The kitchen has started your order." },
  },
  READY_FOR_PICKUP: {
    customer: { title: "Order ready 🍱", body: "Your food is ready and waiting for a rider." },
    rider: { title: "New order available 🛵", body: "A new order is ready for pickup." },
  },
  OUT_FOR_DELIVERY: {
    customer: { title: "Out for delivery 🛵", body: "Your rider is on the way with your food." },
    owner: { title: "Out for delivery", body: "Your order has been picked up by a rider." },
  },
  DELIVERED: {
    customer: { title: "Delivered 🎉", body: "Your order has been delivered. Enjoy!" },
    owner: { title: "Order delivered", body: "Your order has been delivered to the customer." },
  },
  CANCELLED: {
    customer: { title: "Order cancelled", body: "Your order has been cancelled." },
    owner: { title: "Order cancelled", body: "An order has been cancelled." },
    rider: { title: "Order cancelled", body: "An order you were assigned has been cancelled." },
  },
  BAGGED: {
    customer: { title: "Order picked up 🛵", body: "Your rider has picked up your food." },
    owner: { title: "Order picked up", body: "A rider has picked up your order." },
  },
  FAILED: {
    customer: { title: "Delivery issue", body: "Your delivery hit a snag — we're reassigning a rider." },
    owner: { title: "Delivery failed", body: "The rider reported a problem — reassign the order." },
  },
};

// Mirror the SSE listener: the same bus event also fires web + native push.
export function startPushListener() {
  bus.on("order:updated", (recipientIds, data) => {
    const { status, customerId, ownerId, riderIds, orderId } = data || {};
    const messages = STATUS_MESSAGES[status];
    if (!messages) return;

    const jobs = [];
    if (customerId && messages.customer) jobs.push([[customerId], messages.customer]);
    if (ownerId && messages.owner) jobs.push([[ownerId], messages.owner]);
    if (riderIds && messages.rider) jobs.push([riderIds, messages.rider]);

    jobs.forEach(([ids, msg]) => {
      const payload = { ...msg, url: orderId ? `/orders/${orderId}` : "/orders" };
      sendPushToUsers(ids, payload).catch((e) => console.error("[push]", e));
      sendFcmToUsers(ids, payload).catch((e) => console.error("[fcm]", e));
    });
  });

  bus.on("review:created", (recipientIds) => {
    const payload = { title: "New review ⭐", body: "You received a new review.", url: "/" };
    sendPushToUsers(recipientIds, payload).catch((e) => console.error("[push]", e));
    sendFcmToUsers(recipientIds, payload).catch((e) => console.error("[fcm]", e));
  });
}
