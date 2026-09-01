// Tiny in-memory TTL cache for hot reads (restaurant list, menu, categories).
//
// Why in-memory? We run a single Render instance, so a process-local Map is
// shared by every request on that instance — no external service needed.
// Limits: it resets on cold start and is NOT shared across multiple instances.
// When we scale out, reimplement these 3 functions against Redis (e.g. Upstash
// free tier) and nothing else in the app needs to change.

const store = new Map(); // key -> { value, expiresAt }

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    store.delete(key); // lazy cleanup on read
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs = 30_000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheClear() {
  store.clear();
}
