import { useEffect } from "react";

// Requests notification permission once (no-op if unsupported, granted, or denied).
export function useNotificationPermission(enabled = true) {
  useEffect(() => {
    if (enabled && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [enabled]);
}

// Fire a notification only if permission is granted. No-op otherwise.
export function notify(title, options = {}) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, options);
  }
}
