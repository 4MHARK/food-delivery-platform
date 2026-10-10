// ChowZilla service worker.
//
// Two jobs share this one file:
//   1. Offline app shell — precache the build output, and answer deep-link
//      navigations with index.html (mirroring the vercel.json rewrite).
//   2. Web push — show notifications, focus/navigate on click.
//
// It deliberately does NOT cache API data. Menus, prices and order state must
// always be live, so no runtime caching route is registered: Workbox's router
// finds no match for the cross-origin calls in src/lib/api.js and the browser
// performs them normally. Adding such a route later would be the whole
// difference between "installable shell" and "customers see yesterday's prices".

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";

// Capacitor guard — layer 2 of 2.
//
// The native Android build bundles this same dist/ and serves it from
// http://localhost inside a WebView. A precaching worker there would hand back
// the previous release's JS after an APK update, so if one somehow gets
// registered in that context it tears itself down rather than installing a
// precache. Layer 1 (never registering in the first place) is in src/lib/pwa.js.
const isCapacitorOrigin =
  self.location.protocol === "http:" && self.location.hostname === "localhost";

if (isCapacitorOrigin) {
  self.addEventListener("activate", (event) => event.waitUntil(self.registration.unregister()));
} else {
  cleanupOutdatedCaches();
  precacheAndRoute(self.__WB_MANIFEST);

  // Deep links (/orders/42) cold-boot offline: a navigation that misses the
  // precache is answered with the shell, and BrowserRouter renders the route
  // from the URL. The URL is never rewritten, so this covers the whole route
  // table without listing routes. Note `navigateFallback` is a generateSW-only
  // option — with injectManifest the route has to be authored by hand, as here.
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL("/index.html"), {
      denylist: [/^\/api\//, /^\/push\//, /^\/payments\//],
    }),
  );

  clientsClaim();

  // registerType is "prompt", so a new worker waits until the page asks. Never
  // skipWaiting automatically: this app runs a Paystack inline checkout, and a
  // forced reload between openIframe() and its onSuccess callback destroys the
  // iframe after the order was already created server-side — money moves, the
  // UI never says so.
  self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  });

  // ── Web push ──────────────────────────────────────────────────────────────

  // A missing or malformed payload must not stop the notification appearing —
  // the user would just get silence.
  function readPayload(event) {
    if (!event.data) return {};
    try {
      return event.data.json();
    } catch {
      return {};
    }
  }

  self.addEventListener("push", (event) => {
    const data = readPayload(event);

    const options = {
      body: data.body || "You have a new update from ChowZilla.",
      // Raster, not the SVG favicon as before: Android Chrome silently ignores
      // SVG notification icons.
      icon: "/pwa-192x192.png",
      data: { url: data.url || "/" },
    };

    event.waitUntil(self.registration.showNotification(data.title || "ChowZilla", options));
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = (event.notification.data && event.notification.data.url) || "/";

    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      }),
    );
  });
}
