// Loaded via `node --import ./src/instrument.js` (see package.json scripts) so
// Sentry patches http/express/prisma BEFORE anything else imports them. Sentry
// instruments by wrapping modules as they load, so importing this file late
// (or not at all) produces zero data with no error to warn you.
//
// dotenv is loaded here — not only in server.js — because this file now runs
// FIRST, so process.env.SENTRY_DSN would otherwise still be undefined when we
// read it a few lines down.
import "dotenv/config";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",

  integrations: [
    // expressIntegration() is already on by default; naming it explicitly lets
    // us pass shouldHandleError. This app throws deliberate 4xx errors
    // (validation, auth, ownership guards) through its error middleware —
    // that's expected control flow, not breakage, so only 5xx reaches Sentry.
    Sentry.expressIntegration({
      shouldHandleError(error) {
        const status = error?.status ?? error?.statusCode ?? 500;
        return status >= 500;
      },
    }),
    // Prisma spans need no setup: prismaIntegration() is auto-added whenever
    // tracing is enabled.
    nodeProfilingIntegration(),
  ],

  // Fine locally, but in production this multiplies straight into your quota —
  // so it scales down there unless you override it.
  tracesSampleRate: Number(
    process.env.SENTRY_TRACES_SAMPLE_RATE ?? (isProduction ? 0.2 : 1),
  ),

  // Continuous profiling (Sentry v10+). `profilesSampleRate` was removed in v10
  // and is SILENTLY IGNORED if you pass it — these two replace it.
  profileSessionSampleRate: 1,
  // Defaults to 'manual', which needs explicit startProfiler()/stopProfiler()
  // calls. 'trace' instead follows each sampled transaction.
  profileLifecycle: "trace",
});
