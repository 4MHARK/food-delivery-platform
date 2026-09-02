import { PushNotifications } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { api } from "./api";

// Register for native push (FCM) on Android/iOS. No-op in the browser, where
// web push (push.js) handles notifications instead.
export async function registerNativePush() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await PushNotifications.requestPermissions();
    await PushNotifications.register();
  } catch (error) {
    console.error("Native push setup failed:", error);
  }

  // The FCM token arrives asynchronously via the 'registration' event.
  PushNotifications.addListener("registration", async (token) => {
    try {
      await api.post("/push/register-token", { token: token.value });
    } catch (error) {
      console.error("Failed to save push token:", error);
    }
  });

  PushNotifications.addListener("registrationError", (error) => {
    console.error("Push registration error:", error);
  });
}
