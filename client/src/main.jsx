import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import * as Sentry from "@sentry/react";
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { purgeNativeServiceWorker } from './lib/pwa'

// Runs only inside the native Android app, where it tears down any service
// worker an APK built before the PWA work had registered in the WebView.
// A no-op on the web. Fire-and-forget: it must never block startup.
purgeNativeServiceWorker()

// Initialize Sentry BEFORE React renders.
// Note `import.meta.env`, not `process.env` — Vite statically replaces these
// references at build time, and only `VITE_`-prefixed vars reach the bundle.
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,

  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      // Replays rebuild the real DOM, and this app renders customers' delivery
      // addresses, names and phone numbers. Sentry masks these by default — the
      // previous `false` values turned that protection off, which would have
      // shipped customer PII to a third party. Leave the masking on.
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Distributed tracing. The API is a different origin from the app, and the
  // browser SDK only attaches sentry-trace/baggage headers to SAME-origin
  // requests when this is unset — so without it the frontend transaction never
  // links to the backend one. Entries are substring-matched (case-insensitive),
  // so the bare API URL covers any path under it.
  tracePropagationTargets: ["localhost", import.meta.env.VITE_API_URL].filter(Boolean),
});

createRoot(document.getElementById('root'), {
  // React 19 routes errors that escape every ErrorBoundary through these root
  // options. The boundary below only reports what it actually catches (via
  // componentDidCatch), so it deliberately does NOT handle onCaughtError —
  // Sentry.reactErrorHandler() captures those too, and wiring both would
  // double-report every caught error.
  onUncaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
