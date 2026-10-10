import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

const DISMISS_KEY = "cz-install-prompt-dismissed";

// iPadOS reports itself as "MacIntel" but is touch-capable — the only reliable
// way to tell it apart from a real Mac.
function isIos() {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

// Add to Home Screen only exists in Safari on iOS. Chrome/Firefox/Edge on iOS
// are WebKit wrappers without that menu item, so don't hint there — it would
// send people looking for a button that isn't there.
function isIosSafari() {
  return isIos() && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

// Offers to install the app. Two paths, because the platforms differ:
//   Android/Chrome — fires `beforeinstallprompt`, so we can show a real button.
//   iOS Safari     — fires nothing, so the only option is to describe the
//                    Share -> Add to Home Screen steps.
//
// This is not cosmetic on iOS: Web Push only works once the PWA has been added
// to the Home Screen (and only on iOS 16.4+), so without this hint iPhone users
// never get delivery notifications.
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false; // private mode
    }
  });

  // Derived rather than state: this is a pure function of the user agent and
  // never changes for the page's lifetime, so it needs no effect.
  const showIosHint =
    !dismissed && !Capacitor.isNativePlatform() && !isStandalone() && isIosSafari();

  useEffect(() => {
    if (dismissed) return;
    if (Capacitor.isNativePlatform()) return; // already installed as a real app
    if (isStandalone()) return; // already launched from the home screen

    const onBeforeInstall = (event) => {
      // Suppress Chrome's own mini-infobar so we control when and where this
      // appears, rather than it ambushing someone mid-checkout.
      event.preventDefault();
      setDeferred(event);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [dismissed]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Private mode — dismissing just won't persist.
    }
    setDismissed(true);
  };

  if (dismissed || (!deferred && !showIosHint)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[90] rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg md:left-auto md:right-4 md:w-96">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-2xl text-amber-500">install_mobile</span>

        <div className="flex-1 text-sm">
          <p className="font-semibold">Install ChowZilla</p>
          {showIosHint ? (
            <p className="mt-1 text-slate-300">
              Tap <span className="font-medium text-white">Share</span>, then{" "}
              <span className="font-medium text-white">Add to Home Screen</span>. You need this to
              get delivery notifications on iPhone.
            </p>
          ) : (
            <p className="mt-1 text-slate-300">Faster launch, and delivery notifications.</p>
          )}
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-slate-400 transition-colors hover:text-white"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>
      </div>

      {deferred && (
        <button
          type="button"
          onClick={async () => {
            deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
          }}
          className="mt-3 w-full rounded-full bg-amber-500 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
        >
          Install app
        </button>
      )}
    </div>
  );
}
