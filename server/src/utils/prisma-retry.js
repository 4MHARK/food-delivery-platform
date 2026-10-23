// Retry Prisma operations when the TCP connection to the database could not be
// established. P1001/P1002 happen before the query reaches Postgres, so
// retrying is safe even for writes. We deliberately do NOT retry P1017 (server
// closed the connection), because that can happen after a write committed.
const RETRYABLE_CODES = new Set(["P1001", "P1002"]);
const RETRYABLE_MESSAGE =
  /can't reach database server|connection refused|connect ECONNREFUSED/i;

export const MAX_ATTEMPTS = 3;

export function isTransientConnectionError(error) {
  if (!error) return false;
  if (RETRYABLE_CODES.has(error.code)) return true;
  return RETRYABLE_MESSAGE.test(error.message || "");
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function withTransientRetry(operation, { onRetry } = {}) {
  let attempt = 0;

  while (true) {
    attempt += 1;
    try {
      return await operation();
    } catch (error) {
      if (!isTransientConnectionError(error) || attempt >= MAX_ATTEMPTS) {
        throw error;
      }

      const delayMs = 250 * 2 ** (attempt - 1); // 250ms, then 500ms
      if (onRetry) onRetry({ attempt, delayMs, error });
      await wait(delayMs);
    }
  }
}
