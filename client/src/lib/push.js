import { api } from "./api";

// Convert a base64url VAPID key into a Uint8Array for PushManager.subscribe().
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Register the service worker, request permission, subscribe, and save the
// subscription on the server. Safe to call on every login; no-op where unsupported.
export async function registerPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const { publicKey } = await api.get("/push/public-key", { auth: false });

    const registration = await navigator.serviceWorker.register("/sw.js");

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
