import rateLimit, { ipKeyGenerator } from "express-rate-limit";

// Real client IP: Cloudflare puts it in cf-connecting-ip; falls back to req.ip.
// ipKeyGenerator normalizes IPv6 to a /56 bucket so a single address cannot
// mint unlimited rate-limit keys (and satisfies express-rate-limit's guard).
const clientIp = (req) =>
  ipKeyGenerator(req.headers["cf-connecting-ip"] || req.ip);

// Load-test bypass: only active while LOADTEST_KEY is set on the server.
// Paystack webhooks are server-to-server retries; rate-limiting them would
// cause failed deliveries and repeated retry storms.
const skip = (req) =>
  req.path === "/payments/webhook" ||
  (!!process.env.LOADTEST_KEY &&
    req.headers["x-loadtest-key"] === process.env.LOADTEST_KEY);

const base = { standardHeaders: true, legacyHeaders: false, skip };

// Failed attempts only, per email: stops password guessing on one account
// without locking out a whole campus behind one IP.
export const loginLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => String(req.body?.email || "").toLowerCase() || clientIp(req),
  message: { message: "Too many login attempts. Please try again later" },
});

export const registerLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 50,
  keyGenerator: clientIp,
  message: { message: "Too many registration attempts. Please try again later" },
});

// Per user. The route must run authMiddleware first (see step 2).
export const checkoutLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req) => (req.user?.id ? `user-${req.user.id}` : clientIp(req)),
  message: { message: "Too many order attempts. Please try again later" },
});

export const resetLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => String(req.body?.email || "").toLowerCase() || clientIp(req),
  message: { message: "Too many reset requests. Please try again later" },
});

// Blunt flood guard only: many students share one IP.
export const globalLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  limit: 600,
  keyGenerator: clientIp,
  message: { message: "Too many requests. Please try again later" },
});