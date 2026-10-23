import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { enablePush } from "../lib/push";

const DISMISS_KEY = "chowzilla-pwa-prompts-dismissed";

const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

// Add to Home Screen only exists in Safari on iOS. Chrome/Firefox/Edge on iOS
// are WebKit wrappers without that menu item, so never show those steps there.
const isIOSSafari = () =>
  isIOS() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)")?.matches === true ||
    window.navigator.standalone === true);

const notificationPermission = () =>
  typeof Notification !== "undefined" ? Notification.permission : "unsupported";

function wasDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export default function PwaPrompts() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [permission, setPermission] = useState(notificationPermission);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [enabling, setEnabling] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // private mode may block storage; dismissing for this render is enough
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setMessage("Install couldn't start. Use your browser's menu instead.");
    }
  };

  const handleEnable = async () => {
    setEnabling(true);
    setMessage("");
    const ok = await enablePush();
    const next = notificationPermission();
    setPermission(next);
    setEnabling(false);

    if (ok) setMessage("Notifications enabled.");
    else if (next === "denied") {
      setMessage("Notifications are blocked. Enable them for ChowZilla in your browser settings.");
    } else if (next === "unsupported") {
      setMessage("This browser doesn't support notifications.");
    } else {
      setMessage("Couldn't enable notifications. Please try again.");
    }
  };

  // Never cover Paystack's inline checkout on the cart page.
  if (dismissed || pathname === "/cart") return null;

  // iOS cannot receive web push until the PWA is installed from Safari.
  const iosNeedsInstall = isIOSSafari() && !installed;
  const iosUninstalled = isIOS() && !installed;
  const canInstall = Boolean(deferredPrompt) && !installed;
  const canAsk =
    isAuthenticated && permission === "default" && !iosUninstalled;
  const denied =
    isAuthenticated && permission === "denied" && !iosUninstalled;

  if (!iosNeedsInstall && !canInstall && !canAsk && !denied) return null;

  return (
    <div
      role="region"
      aria-label="App setup"
      className="fixed inset-x-3 bottom-20 z-[90] md:inset-x-auto md:right-4 md:bottom-4 md:w-[390px]"
    >
      <div className="rounded-2xl bg-slate-900 px-4 py-4 text-white shadow-xl">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden text-2xl leading-none text-amber-400">
            {iosNeedsInstall ? "install_mobile" : canAsk ? "notifications_active" : "storefront"}
          </span>

          <div className="min-w-0 flex-1">
            {iosNeedsInstall ? (
              <>
                <p className="text-sm font-bold">Install ChowZilla for notifications</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  iPhone notifications only work after adding ChowZilla to your Home Screen.
                </p>
                <ol className="mt-2 list-decimal space-y-0.5 pl-4 text-xs leading-relaxed text-slate-300">
                  <li>Tap the <span className="font-semibold text-white">Share</span> button in Safari.</li>
                  <li>Choose <span className="font-semibold text-white">Add to Home Screen</span>.</li>
                  <li>Open ChowZilla from the new Home Screen icon.</li>
                  <li>
                    {isAuthenticated
                      ? "Tap Enable notifications."
                      : "Log in, then tap Enable notifications."}
                  </li>
                </ol>
                <p className="mt-2 text-[10px] text-slate-500">Requires iOS 16.4 or later.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold">
                  {canAsk
                    ? "Turn on ChowZilla alerts"
                    : denied
                      ? "Notifications are blocked"
                      : "Install ChowZilla"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {canAsk
                    ? "Get order and delivery updates even when the app is closed."
                    : denied
                      ? "Enable notifications for this site in your browser settings, then reload."
                      : "Install the app for a faster, full-screen experience."}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {canInstall && (
                    <button
                      type="button"
                      onClick={handleInstall}
                      className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-600 active:scale-95"
                    >
                      Install app
                    </button>
                  )}
                  {canAsk && (
                    <button
                      type="button"
                      onClick={handleEnable}
                      disabled={enabling}
                      className="rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-amber-600 disabled:bg-amber-300 active:scale-95"
                    >
                      {enabling ? "Enabling..." : "Enable notifications"}
                    </button>
                  )}
                </div>

                {message && <p className="mt-2 text-xs text-amber-300">{message}</p>}
              </>
            )}
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <span className="material-symbols-outlined block h-5 w-5 overflow-hidden text-lg leading-5">close</span>
          </button>
        </div>
      </div>
    </div>
  );
}
