import { api } from "./api";

// Paystack's inline SDK is only needed at checkout. Loading it from index.html
// made every page — including login and the rider dashboard — pay for a
// parser-blocking third-party script and its cookie. This loads it on demand
// and shares one promise so two quick taps can't inject the tag twice.
let scriptPromise = null;

export function loadPaystack() {
  if (typeof window !== "undefined" && window.PaystackPop) {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.paystack.co/v2/inline.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      // Allow a later retry instead of caching the failure forever.
      scriptPromise = null;
      reject(new Error("Payment system is unavailable. Please try again."));
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

// Refuse to charge when the browser's public key and the server's secret key
// come from different Paystack modes. A mismatch takes the money but leaves the
// server unable to verify it ("transaction not found").
export async function checkPaystackMode() {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "";
  const clientMode = publicKey.startsWith("pk_live_")
    ? "live"
    : publicKey.startsWith("pk_test_")
      ? "test"
      : null;

  let serverMode = null;
  try {
    const data = await api.get("/payments/mode", { auth: false });
    serverMode = data?.mode || null;
  } catch {
    return { ok: false, message: "Payment system is unavailable. Please try again." };
  }

  if (!clientMode || !serverMode) {
    return { ok: false, message: "Payments are not configured correctly. Please contact support." };
  }
  if (clientMode !== serverMode) {
    return {
      ok: false,
      message: `Payments are misconfigured: this app uses a ${clientMode} Paystack key while the server is in ${serverMode} mode. No charge was made. Please contact support.`,
    };
  }
  return { ok: true };
}
