import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
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

  // Android 8+ requires a channel before any foreground notification can show.
  await PushNotifications.createChannel({
    id: "chowzilla",
    name: "Orders & updates",
    description: "Order status, delivery and review notifications",
    importance: 5, // MAX — heads-up banner
    visibility: 1, // PUBLIC — also on the lock screen
  });

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
}
