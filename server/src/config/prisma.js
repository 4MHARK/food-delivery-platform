import { PrismaClient } from "@prisma/client";
import { withTransientRetry, MAX_ATTEMPTS } from "../utils/prisma-retry.js";

const base = new PrismaClient();

// Wrap every model operation so a brief Supabase pooler outage (P1001/P1002 /
// "Can't reach database server") is retried before surfacing to the route.
const prisma = base.$extends({
  query: {
    $allOperations({ args, query }) {
      return withTransientRetry(() => query(args), {
        onRetry: ({ attempt, delayMs, error }) => {
          console.warn(
            `[prisma] transient connection error (${error?.code || "unknown"}) — ` +
            `retry ${attempt}/${MAX_ATTEMPTS} in ${delayMs}ms`
          );
        },
      });
    },
  },
});

export default prisma;
