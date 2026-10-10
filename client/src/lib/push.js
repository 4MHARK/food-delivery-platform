import { api } from "./api";
import { Capacitor } from "@capacitor/core";

// Convert a base64url VAPID key into a Uint8Array for PushManager.subscribe().
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Attach-only. The service worker is registered exactly once, on cold load, by
// ServiceWorkerManager (src/components/ServiceWorkerManager.jsx). Push must
// never register it — there is one registration path, and the Capacitor WebView
// never gets one.
async function getReadyRegistration() {
  // Native uses FCM via nativePush.js.
  if (Capacitor.isNativePlatform()) return null;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

  // navigator.serviceWorker.ready never settles when nothing will ever register
  // (unsupported browser, private mode, a registration that failed), which would
  // hang this forever. Cap the wait and bail.
  //
  // `ready` rather than getRegistration(): the latter can return a registration
  // that is still installing, and pushManager.subscribe() on one throws
  // InvalidStateError.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(() => resolve(null), 10_000)),
  ]);
}

// Request permission, subscribe, and save the subscription on the server.
// Safe to call on every login; no-op where unsupported.
export async function registerPush() {
  const registration = await getReadyRegistration();
  if (!registration) return;

  try {
    const { publicKey } = await api.get("/push/public-key", { auth: false });

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await api.post("/push/subscribe", { subscription });
  } catch (error) {
    console.error("Push registration failed:", error);
  }
}

// Remove the subscription (called on logout). The local unsubscribe always runs;
// the server-side delete is best-effort (the token may already be cleared).
export async function unregisterPush() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = registration && (await registration.pushManager.getSubscription());
    if (!subscription) return;

    await api.post("/push/unsubscribe", { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  } catch (error) {
    console.error("Push unregister failed:", error);
  }
}
