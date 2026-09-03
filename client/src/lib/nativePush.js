import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";
import { api } from "./api";

// Register for native push (FCM) on Android/iOS. No-op in the browser, where
// web push (push.js) handles notifications instead.
export async function registerNativePush() {
  if (!Capacitor.isNativePlatform()) return;

  // Listeners go FIRST — the FCM token event can fire as soon as register()
  // resolves, and a listener attached after that would miss it (the server would
  // never learn the token, so no push could ever arrive).
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

  // Foreground: FCM hands the message to us instead of the system tray, so we
  // display it ourselves as a local notification. (Background shows via the tray.)
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    LocalNotifications.schedule({
      notifications: [
        {
          title: notification.title || "ChowZilla",
          body: notification.body || "",
          channelId: "chowzilla",
          id: new Date().getTime(),
          schedule: { at: new Date(Date.now() + 1) },
        },
      ],
    });
  });

  // Android 8+ requires a channel before any foreground notification can show.
  try {
    await PushNotifications.createChannel({
      id: "chowzilla",
      name: "Orders & updates",
      description: "Order status, delivery and review notifications",
      importance: 5, // MAX — heads-up banner
      visibility: 1, // PUBLIC — also on the lock screen
    });
  } catch (error) {
    console.error("Notification channel creation failed:", error);
  }

  try {
    await PushNotifications.requestPermissions();
    await PushNotifications.register();
  } catch (error) {
    console.error("Native push setup failed:", error);
  }
}
