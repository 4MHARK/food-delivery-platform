import { existsSync } from "fs";
import { cert, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import prisma from "../config/prisma.js";

// Configure Firebase Admin lazily — so importing this module is safe before env is ready.
let fcmReady = false;
function ensureFcm() {
  if (fcmReady) return;

  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Hosts like Render: the full service-account JSON is an env var (no file on disk).
    credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else {
    // Local dev: read the gitignored file on disk.
    const serviceAccountPath =
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json";
    if (!existsSync(serviceAccountPath)) {
      console.warn("[fcm] Firebase service account missing — native push disabled");
      return;
    }
    credential = cert(serviceAccountPath);
  }

  initializeApp({ credential });
  fcmReady = true;
}

// Save (or reassign) an FCM device token for a user. One row per device.
export async function saveFcmToken(userId, token) {
  return prisma.pushToken.upsert({
    where: { token },
    update: { userId },
    create: { userId, token },
  });
}

export async function deleteFcmToken(userId, token) {
  return prisma.pushToken.deleteMany({ where: { token, userId } });
}

// Send a native push to specific users, or to everyone for a ["*"] broadcast.
export async function sendFcmToUsers(userIds, payload) {
  ensureFcm();
  if (!fcmReady) return;

  const tokens = userIds.includes("*")
    ? await prisma.pushToken.findMany()
    : userIds.includes("riders")
    ? await prisma.pushToken.findMany({ where: { user: { role: "RIDER" } } })
    : await prisma.pushToken.findMany({ where: { userId: { in: userIds } } });

  if (tokens.length === 0) return;

  const response = await getMessaging().sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title: payload.title, body: payload.body },
    data: { url: payload.url || "/" },
  });

  // Drop tokens FCM reports as invalid so they don't accumulate.
  response.responses.forEach((res, i) => {
    if (res.success) return;
    const code = res.error?.code;
    if (
      [
        "messaging/registration-token-not-registered",
        "messaging/invalid-registration-token",
        "messaging/invalid-argument",
      ].includes(code)
    ) {
      prisma.pushToken.delete({ where: { id: tokens[i].id } }).catch(() => {});
    }
  });
}
