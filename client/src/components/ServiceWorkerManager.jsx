import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useRegisterSW } from "virtual:pwa-register/react";

// The single place that registers the service worker, and the only UI that
// offers an update. Mounted from App.jsx inside <BrowserRouter> (it needs
// useLocation) and only when src/lib/pwa.js says a worker is allowed here.
//
// registerType is "prompt" in vite.config.js, so a new worker installs and then
// WAITS. That is deliberate — see the /cart guard below.
export default function ServiceWorkerManager() {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Poll for a new deploy hourly while the tab stays open.
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000);
    },
    onRegisterError(error) {
      console.error("Service worker registration failed:", error);
    },
  });

  // Never offer a reload on the cart screen. Paystack's inline iframe is live
  // there, and a reload between openIframe() and its onSuccess callback destroys
  // it — after /orders/checkout has already run server-side on an idempotency
  // key that is now spent. The customer would be charged with no confirmation.
  if (!needRefresh || dismissed || pathname === "/cart") return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[100] flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg md:inset-x-auto md:right-4 md:w-96"
    >
      <span className="flex-1">A new version of ChowZilla is ready.</span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="shrink-0 rounded-full bg-amber-500 px-4 py-1.5 font-semibold text-slate-950 transition-colors hover:bg-amber-600"
      >
        Refresh
      </button>
      <button
        type="button"
        // Deliberately NOT updateServiceWorker(false): that still posts
        // SKIP_WAITING, activating the new worker under a page still running
        // the old JS — the mixed-bundle state where a lazy chunk 404s. Leaving
        // it waiting lets it activate once every tab closes.
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-full px-3 py-1.5 text-slate-300 transition-colors hover:text-white"
      >
        Later
      </button>
    </div>
  );
}
