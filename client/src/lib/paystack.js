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
