// Service-worker policy for the web/PWA build. Nothing here is React-aware.
import { Capacitor } from "@capacitor/core";

// The single gate for "may a service worker run in this context?".
//
// Three independent reasons to say no. They look redundant and are not: each
// one covers a way the others can fail, and getting this wrong breaks the
// native Android app rather than the website.
export function isServiceWorkerAllowed() {
  // 1. The native Android build bundles this same dist/ and serves it from
  //    http://localhost inside a WebView. A precaching worker there would keep
  //    serving the previous release's JS after an APK update, so the app would
  //    appear not to update. This is layer 1 of 2 — src/sw.js bails on the same
  //    origin too, in case this check is ever bypassed by a stale bundle.
  if (Capacitor.isNativePlatform()) return false;

  // 2. Defence in depth. Capacitor's http://localhost counts as a *secure
  //    context*, so the platform would happily permit registration there —
  //    check 1 is the only thing standing in the way, and one check should not
  //    be load-bearing alone. Production and Vercel previews are https; the
  //    Vite dev server (http://localhost:5173) is not.
  if (location.protocol !== "https:") return false;

  // 3. Never in the dev server. HMR plus a Workbox worker on one origin is a
  //    stale-cache trap.
  if (!import.meta.env.PROD) return false;

  return "serviceWorker" in navigator;
}

// Runs on every native launch. This is not optional tidy-up: Capacitor's
// WebView storage is keyed to the origin and survives app updates, so a worker
// registered by an APK built before the guard above existed would keep
// controlling the app indefinitely — including after the fix ships.
export async function purgeNativeServiceWorker() {
  if (!Capacitor.isNativePlatform()) return;
  if (!("serviceWorker" in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const controlled = Boolean(navigator.serviceWorker.controller);
    if (!registrations.length && !controlled) return;

    await Promise.all(registrations.map((r) => r.unregister()));

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // A controller only detaches on a fresh navigation, so reload once. Guarded
    // by sessionStorage so a failure to detach can't become a reload loop.
    if (controlled && !sessionStorage.getItem("cz-sw-purged")) {
      sessionStorage.setItem("cz-sw-purged", "1");
      location.reload();
    }
  } catch {
    // Best effort — never block native startup over this.
  }
}
