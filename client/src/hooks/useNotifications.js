// Permission is requested from a button (PwaPrompts), never automatically.
export function useNotificationPermission() {}

export async function notify(title, options = {}) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const registration = await navigator.serviceWorker?.ready;
    if (registration) await registration.showNotification(title, options);
  } catch {
    // a notification must never break the page
  }
}
