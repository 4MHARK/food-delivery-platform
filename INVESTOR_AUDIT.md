# Investor-Ready Cleanup Audit — ChowZilla Food Delivery Platform

**Audited**: 2026-08-10 | **Branch**: `project-recovery` | **Last commit**: `36ab5b0`

---

## ISSUE INDEX

| ID | Type | Severity | Title | Fix Time |
|----|------|----------|-------|-----------|
order payments, 2 separate files
| S01 | SECURITY | P0 | JWT tokens exposed in URL query parameters (SSE) | 15 min |(Done)
| S02 | SECURITY | P0 | Weak JWT secret | 5 min |(Done)
| S03 | SECURITY | P1 | Server returns raw error messages to clients | 15 min |(Done)
| S04 | SECURITY | P1 | No rate limiting on any endpoint | 30 min |(Done)
| S05 | SECURITY | P1 | No security headers (no helmet) | 5 min |(Done)
| B01 | BACKEND | P1 | Missing global error-handling middleware | 15 min |(Done)
| B02 | BACKEND | P1 | No input validation library — all manual checks | 2+ hr |(Done)
| B03 | BACKEND | P2 | `console.error` littered across all route files | 15 min |(Done)
| B04 | BACKEND | P2 | No structured logging (no Morgan/Winston) | 15 min |(Done)
| F01 | FRONTEND | P0 | `PaystackPop` accessed as unchecked global — runtime crash risk | 15 min |(Done)
| F02 | FRONTEND | P1 | Tax label says 7.5% but calculation uses 1.5% | 5 min |(Done)
| F03 | FRONTEND | P1 | Payment verification fetch has no `.catch()` — silent failure | 10 min |(Done)
| F04 | FRONTEND | P1 | Hardcoded fake 4.5-star rating on all restaurant cards | 15 min |(Done)
| F05 | FRONTEND | P1 | Hardcoded fake "20-30 min" delivery time on all restaurants | 10 min |(Done)
| F06 | FRONTEND | P1 | Dead "Forgot Password?" link on Login page | 5 min |(Done)
| F07 | FRONTEND | P1 | Dead Google/Apple social login buttons (Login + Signup) | 5 min |(Later)
| F08 | FRONTEND | P2 | Array index used as React `key` in 4 `.map()` calls | 10 min |(Done)
| F09 | FRONTEND | P2 | `console.log(error)` left in Login and Signup | 2 min |(Done)
| F10 | FRONTEND | P2 | Unused `import React` in 3 files (React 19 JSX transform) | 2 min |(Done)
| F11 | FRONTEND | P2 | `App.css` — 100% unused Vite boilerplate (never imported) | 2 min |(Done)
| F12 | FRONTEND | P2 | `hero.png` — unused asset, never referenced | 2 min |(Done)
| F13 | FRONTEND | P2 | Hardcoded filter categories not derived from DB data | 30 min |(Done)
| F14 | FRONTEND | P3 | Favorites page is a dead stub (static empty state) | 1 hr |(Done)
| F15 | FRONTEND | P3 | Profile page: 3 of 4 tabs are "coming soon" placeholders | 2+ hr |(Done)
| F16 | FRONTEND | P3 | Admin dashboard: 4 of 6 sections are "coming soon" | 2+ hr |(Later)
| F17 | FRONTEND | P3 | No shared API client — ~35 raw `fetch()` calls copy-pasted | 2+ hr |(Done)
| F18 | FRONTEND | P3 | No `utils/` or `hooks/` directory — logic embedded in pages | 2+ hr |(Done)
| FS01 | FULL-STACK | P1 | Client calculates fees client-side for display; server recalculates — mismatch risk | 15 min |(Done)
| FS02 | FULL-STACK | P1 | No `.env.example` files anywhere | 10 min |(Done)
| FS03 | FULL-STACK | P2 | `User.phone` vs `Rider.phone` — duplicated phone field | 30 min |(Done)
| FS04 | FULL-STACK | P2 | Order status polling (30s) instead of SSE on owner dashboard | 1 hr |(Done)
| D01 | DATABASE | P2 | No indexes on foreign key columns — query perf risk at scale | 30 min |(Done)
| D02 | DATABASE | P2 | Schema drift — current schema diverged from last migration | 1 hr |(Done)
| D03 | DATABASE | P3 | No seed data file for development/demo | 30 min |(Done)
| DV01 | DEVOPS | P1 | `client/.env.production` missing `VITE_PAYSTACK_PUBLIC_KEY` | 5 min |(Done)
| DV02 | DEVOPS | P2 | `server/.env` contains live DB credentials + Paystack secret on disk (properly gitignored, not committed) | 5 min |(Done)
| DV03 | DEVOPS | P3 | No test framework configured anywhere | 2+ hr |(Deferred)

---

---

## DETAILED ISSUES

---

### S01 [SECURITY] [P0] JWT tokens exposed in URL query parameters (SSE)

- **Files**: `client/src/pages/Orders.jsx:51`, `OrderDetail.jsx:92`, `RiderDashboard.jsx:357`; `server/src/routes/sse.routes.js:14`
- **Why it is a problem**: `EventSource` can't set HTTP headers, so the JWT is passed as `?token=...` in the URL. Tokens in URLs are logged by proxies, CDNs, and server access logs. They appear in browser history and can leak via `Referer` headers. A leaked JWT means full account takeover.
- **User impact**: If a token leaks (e.g., via server logs), an attacker can impersonate any user — place orders, view personal data, access admin panel.
- **Investor demo risk**: **High** — a security-conscious investor will flag this immediately. Tokens in URLs is a well-known anti-pattern.
- **What needs to change**: Replace query-param auth with a short-lived token exchange. The SSE endpoint should accept a one-time code that the client exchanges for a session-bound SSE connection. Or use a cookie-based approach with `withCredentials`. Minimum fix: generate a single-use SSE ticket token (`crypto.randomUUID()`) stored server-side, exchange the real JWT for it before opening the EventSource.
- **Estimated fix time**: 15 min (ticket-token approach)
- **What I need to understand**: JWT security best practices, EventSource limitations, token exchange pattern, `crypto.randomUUID()`, server-side session storage for SSE tickets

---

### S02 [SECURITY] [P0] Weak JWT secret

- **File**: `server/.env:17` — `JWT_SECRET=mh4rk20`
- **Why it is a problem**: 7 characters, lowercase + digits only. Trivially brute-forceable in seconds with a dictionary attack. Anyone who discovers this secret can forge valid JWTs for any user, including admins.
- **User impact**: Complete auth bypass. An attacker can mint admin tokens and access the admin dashboard.
- **Investor demo risk**: **High** — this is the cryptographic backbone of the entire auth system.
- **What needs to change**: Generate a strong secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. Update `.env`. This changes the signing key, so all existing tokens become invalid (users will need to re-login).
- **Estimated fix time**: 5 min
- **What I need to understand**: JWT signing, `crypto.randomBytes()`, why secret length matters for HMAC-SHA256, what happens to existing tokens when the secret changes

---

### S03 [SECURITY] [P1] Server returns raw `error.message` to clients

- **Files**: 24 occurrences across all route files — `server/src/routes/user.routes.js`, `restaurant.routes.js`, `menu-item.routes.js`, `order.routes.js`, `payment.routes.js`, `rider.routes.js`, `delivery.routes.js`, `admin.routes.js`
- **Why it is a problem**: Database errors (connection failures, constraint violations, schema mismatches) can leak table names, column names, and query structure. Stack traces can reveal file paths and internal logic. This is information disclosure — an attacker can map the database structure from error messages.
- **User impact**: In production, a user sees raw technical errors instead of friendly messages. An attacker gains reconnaissance data.
- **Investor demo risk**: **Medium** — visible if an error occurs during the demo. Looks unpolished and insecure.
- **What needs to change**: Replace all `error.message` returns with generic messages. Log the real error server-side (see B03), return `"An unexpected error occurred"` to clients. Build a global error handler (see B01) that does this centrally instead of in every catch block.
- **Estimated fix time**: 15 min (with global error handler)
- **What I need to understand**: Express error-handling middleware, information disclosure in REST APIs, difference between operational errors vs programmer errors, `error.message` vs generic messages

---

### S04 [SECURITY] [P1] No rate limiting on any endpoint

- **Files**: `server/src/app.js` (no rate limiter configured); `server/package.json` (no `express-rate-limit` dependency)
- **Why it is a problem**: The login endpoint (`POST /users/login`) can be brute-forced. The checkout endpoint (`POST /orders/checkout`) can be spammed. SSE connections (`GET /events`) have no connection limit. An attacker can exhaust server resources with minimal effort.
- **User impact**: Account takeover via brute force. Denial of service via connection exhaustion. Fraudulent order spam.
- **Investor demo risk**: **Medium** — won't surface in a normal demo but signals missing production hardening.
- **What needs to change**: Install `express-rate-limit`. Apply global limiter (100 req/15min per IP). Apply stricter limiters on `/users/login` (5 req/15min), `/users` POST (3 req/hr), `/orders/checkout` (10 req/min). Apply connection limit on SSE endpoint.
- **Estimated fix time**: 30 min
- **What I need to understand**: Rate limiting strategies, `express-rate-limit` API, per-route vs global limits, IP-based limiting behind proxies (`X-Forwarded-For`), SSE connection limits

---

### S05 [SECURITY] [P1] No security headers (no helmet)

- **File**: `server/src/app.js` (no helmet); `server/package.json` (no `helmet` dependency)
- **Why it is a problem**: Missing CSP (XSS protection), missing HSTS (downgrade attacks), missing X-Frame-Options (clickjacking), missing X-Content-Type-Options (MIME sniffing). The app is missing basic HTTP security hardening that every production Express app should have.
- **User impact**: Increased vulnerability to XSS, clickjacking, and MITM attacks.
- **Investor demo risk**: **Medium** — invisible in a demo but a red flag in any security review.
- **What needs to change**: Install `helmet`. Add `app.use(helmet())` before all other middleware in `app.js`. Adjust CSP if Paystack inline scripts are blocked.
- **Estimated fix time**: 5 min
- **What I need to understand**: HTTP security headers, what helmet does, CSP directives, how Paystack inline scripts interact with CSP

---

### B01 [BACKEND] [P1] Missing global error-handling middleware

- **File**: `server/src/app.js` — no `app.use((err, req, res, next) => {...})` defined
- **Why it is a problem**: Every route file has its own try/catch with ad-hoc error responses. Unhandled promise rejections crash the process (Express 5 doesn't auto-catch async errors). Error response format is inconsistent across route files — some use `{ message }`, others `{ error }`, others `{ message, error }`.
- **User impact**: Users see different error formats depending on which endpoint failed. Some errors may crash the server entirely.
- **Investor demo risk**: **Medium** — inconsistent errors look unpolished. A crash during demo is catastrophic.
- **What needs to change**: Add a 4-argument error middleware at the end of `app.js` that: logs the error, returns a consistent JSON shape, and never leaks `error.message`. Also centralizes the "raw error" fix (S03).
- **Estimated fix time**: 15 min
- **What I need to understand**: Express error-handling middleware signature (4 args), synchronous vs asynchronous error catching in Express 5, consistent error response shapes, error logging (see B03)

---

### B02 [BACKEND] [P1] No input validation library — all manual inline checks

- **Files**: All route files; manual checks like `if (!name) return res.status(400)...` throughout
- **Why it is a problem**: Validation logic is scattered, inconsistent, and easy to miss. No type coercion protection. No max-length checks on strings. No format validation on emails beyond the DB unique constraint. Receiving bad data can cause Prisma errors that leak via S03.
- **User impact**: Users can submit invalid data that causes cryptic errors. Potential for data corruption at the edges.
- **Investor demo risk**: **Low** — unlikely to surface in a demo but signals missing production rigor.
- **What needs to change**: Pick one: `zod` (lightweight, TypeScript-friendly), `joi` (mature), or `express-validator` (Express-native). Create validation schemas per endpoint. Apply as middleware before route handlers. This is a larger refactor — tackle incrementally starting with auth and checkout endpoints.
- **Estimated fix time**: 2+ hr (full coverage); 30 min (auth + checkout only)
- **What I need to understand**: Schema validation vs manual checks, zod schemas, middleware-based validation, how to return consistent validation error responses

---

### B03 [BACKEND] [P2] `console.error` littered across all route files

- **Files**: 20+ `console.error` calls in `server/src/routes/admin.routes.js`, `order.routes.js`, `payment.routes.js`, `delivery.routes.js`, `rider.routes.js`
- **Why it is a problem**: `console.error` writes unstructured text to stdout/stderr. No timestamps, no request context, no log levels. In production, logs are unfilterable. Mixes with startup messages.
- **User impact**: None directly. But debugging production issues becomes much harder.
- **Investor demo risk**: **Low** — invisible to demo viewers.
- **What needs to change**: Install `morgan` for HTTP request logging. Replace `console.error` with a simple logger wrapper that adds timestamps. Or use `pino`/`winston` for structured JSON logging. At minimum, create a `logger.js` utility.
- **Estimated fix time**: 15 min (morgan + basic logger wrapper)
- **What I need to understand**: Logging levels (info/warn/error), Morgan middleware for Express, structured vs unstructured logging, why console.log is insufficient for production

---

### B04 [BACKEND] [P2] No structured logging

- **File**: `server/package.json` (no logging library); cross-cutting concern
- **Why it is a problem**: Related to B03 but broader. No request ID tracking, no log levels, no log aggregation path. In production, you can't trace a request across the stack.
- **User impact**: None directly. Operational blindness.
- **Investor demo risk**: **Low** — invisible.
- **What needs to change**: Install `morgan` for HTTP logs. Add `morgan('short')` or `morgan('combined')` middleware. For structured logs, add `pino-http`.
- **Estimated fix time**: 15 min
- **What I need to understand**: Morgan formats ('dev', 'short', 'combined'), request logging in Express middleware stack, Pino vs Winston trade-offs

---

### F01 [FRONTEND] [P0] `PaystackPop` accessed as unchecked global — runtime crash risk

- **File**: `client/src/pages/Cart.jsx:64`
- **Why it is a problem**: `PaystackPop.setup(...)` is called directly without checking if `PaystackPop` exists. The Paystack script is loaded via a `<script>` tag in `index.html`. If the script fails to load (network issue, ad blocker, Paystack CDN down), the entire checkout flow crashes with `ReferenceError: PaystackPop is not defined`. The user cannot recover.
- **User impact**: User fills their cart, enters delivery address, clicks "Place Order" — and nothing happens, or a white screen. Order is lost. Payment cannot proceed.
- **Investor demo risk**: **High** — checkout is the money path. A crash here during a demo is fatal.
- **What needs to change**: Guard the call: `if (typeof window.PaystackPop === 'undefined') { setError('Payment system unavailable. Please try again.'); return; }`. Also add a script load timeout check on mount. Consider a fallback UI if the script never loads.
- **Estimated fix time**: 15 min
- **What I need to understand**: Third-party script loading reliability, `window` global checks, graceful degradation patterns, Paystack inline popup API

---

### F02 [FRONTEND] [P1] Tax label says 7.5% but calculation uses 1.5%

- **File**: `client/src/pages/Cart.jsx:201-202`
- **Why it is a problem**: The label displays "Tax (7.5%)" but the actual calculation is `Math.round(groupTotal * 0.015)` — 1.5%. Nigerian VAT is 7.5%, but the code computes 1.5%. Either the label is wrong (misleading users) or the calculation is wrong (undercollecting tax). Both client (`Cart.jsx:142`) and server (`server/src/services/feecalculator.js:5`) calculate 1.5%.
- **User impact**: Users see a confusing fee breakdown. If an investor knows Nigerian VAT, this looks like a tax compliance error.
- **Investor demo risk**: **Medium** — visible on the cart/checkout screen during a demo.
- **What needs to change**: Decide the correct tax rate. If 7.5%: change `0.015` → `0.075` on both client AND server. If 1.5%: change the label to "Tax (1.5%)". Update `server/src/services/feecalculator.js` line 5 simultaneously.
- **Estimated fix time**: 5 min
- **What I need to understand**: Nigerian VAT rate (7.5%), difference between display label and calculation, why server and client must agree

---

### F03 [FRONTEND] [P1] Payment verification fetch has no `.catch()` — silent failure

- **File**: `client/src/pages/Cart.jsx:72`
- **Why it is a problem**: After Paystack returns success (user's card was charged), the app calls `POST /payments/verify` to confirm. This fetch has no `.catch()`. If the verification API is down, the user is still redirected to the order page with `navigate(\`/orders/${order.id}\`)`. The payment is charged but the order stays `PENDING_PAYMENT` — the restaurant never sees it.
- **User impact**: User pays, gets redirected, sees their order — but the restaurant never confirms. Money taken, no food delivered. This is a revenue-critical bug.
- **Investor demo risk**: **High** — silent payment failures are the worst kind of bug. Hard to notice, catastrophic consequences.
- **What needs to change**: Add `.catch()` that surfaces an error to the user. Add a retry mechanism. Add a "payment is being verified" interstitial state. Do not redirect until verification succeeds.
- **Estimated fix time**: 10 min (basic catch + error display); 30 min (retry + proper UX)
- **What I need to understand**: Payment verification flow, Promise error handling, async/await vs .then/.catch, retry patterns for idempotent API calls

---

### F04 [FRONTEND] [P1] Hardcoded fake 4.5-star rating on all restaurant cards

- **Files**: `client/src/pages/RestaurantList.jsx:185`, `RestaurantDetail.jsx:121`
- **Why it is a problem**: Every restaurant shows ⭐4.5 regardless of actual data. No rating field exists in the Restaurant model. An investor or user will notice immediately — it makes the app look fake.
- **User impact**: Users can't distinguish good restaurants from bad ones. Trust erodes when every result is 4.5.
- **Investor demo risk**: **High** — this screams "unfinished product." Obvious in the first 10 seconds of a demo.
- **What needs to change**: Remove the hardcoded rating display entirely, OR add a `rating` field to the Restaurant model and implement actual ratings. For the demo: simply hide the rating until it's real. Showing nothing is better than showing fake data.
- **Estimated fix time**: 15 min (hide the rating UI)
- **What I need to understand**: Conditional rendering in React, when to hide features vs show placeholders, database schema changes for new fields

---

### F05 [FRONTEND] [P1] Hardcoded fake "20-30 min" delivery time on all restaurants

- **Files**: `client/src/pages/RestaurantList.jsx:177`, `RestaurantDetail.jsx:123`
- **Why it is a problem**: Same as F04 — fake data on every restaurant. The app has actual delivery tracking with real statuses, but the pre-order estimate is hardcoded.
- **User impact**: Users see the same estimate for every restaurant regardless of distance, preparation time, or restaurant load. Misleading.
- **Investor demo risk**: **Medium** — less damaging than fake ratings but still looks like placeholder data.
- **What needs to change**: Remove the hardcoded estimate. Either replace with the restaurant's own prep-time estimate (if added to DB), or hide it. "Delivery fees from ₦400" is more honest than fake times.
- **Estimated fix time**: 10 min
- **What I need to understand**: When to show estimates vs leave them out, honest UI patterns

---

### F06 [FRONTEND] [P1] Dead "Forgot Password?" link on Login page

- **File**: `client/src/pages/Login.jsx:168-171`
- **Why it is a problem**: `<a href="#">Forgot Password?</a>` — clicking it does nothing except scroll to the top of the page. There is no password reset flow implemented anywhere in the backend. This is a broken promise to the user.
- **User impact**: User who forgets their password has no recovery path. They're locked out permanently unless they create a new account.
- **Investor demo risk**: **Medium** — an investor clicking around will notice it does nothing. Shows incomplete auth flow.
- **What needs to change**: Two options: (1) Implement password reset (backend: generate reset token, send email; frontend: reset form). (2) Hide the link entirely until the flow exists. For the demo, hiding is the pragmatic fix.
- **Estimated fix time**: 5 min (hide the link); 2+ hr (full password reset flow)
- **What I need to understand**: Password reset flow: token generation, email sending (SendGrid/Mailgun/etc.), reset token expiry, bcrypt comparison on reset

---

### F07 [FRONTEND] [P1] Dead Google/Apple social login buttons (Login + Signup)

- **Files**: `client/src/pages/Login.jsx:209-224`, `client/src/pages/Signup.jsx:352-368`
- **Why it is a problem**: Social login buttons are rendered with no `onClick` handlers. They're purely decorative. This is a broken promise and makes the auth pages look unfinished.
- **User impact**: Users try to use social login (common expectation in 2026) and nothing happens. Frustration, bounce.
- **Investor demo risk**: **High** — very visible on the first screen of the app (login). An investor clicking "Google" and getting nothing is a bad first impression.
- **What needs to change**: Hide the social login buttons entirely. Remove the "or continue with" divider too. They can return when OAuth is implemented.
- **Estimated fix time**: 5 min
- **What I need to understand**: When to hide features vs show disabled/coming-soon states, OAuth flow overview (for future implementation)

---

### F08 [FRONTEND] [P2] Array index used as React `key` in 4 `.map()` calls

- **Files**: `Orders.jsx:195`, `OrderDetail.jsx:491`, `ManageRestaurant.jsx:801`, `ManageRestaurant.jsx:864`
- **Why it is a problem**: Using `key={idx}` means React identifies list items by their position. If items reorder, are filtered, or new items are inserted at the top, React reuses the wrong DOM nodes — causing visual glitches (wrong item content in the wrong row) and lost component state.
- **User impact**: Intermittent UI glitches when order items shift. Hard to reproduce, confusing for users.
- **Investor demo risk**: **Low** — unlikely to trigger in a short demo unless orders are rapidly updated.
- **What needs to change**: Replace `key={idx}` with stable unique identifiers. For order items: `key={item.id}`. For menu items: `key={item.id}`. Every mapped array element that has an `id` field should use it.
- **Estimated fix time**: 10 min
- **What I need to understand**: React reconciliation and the `key` prop, why index-as-key causes bugs, stable vs unstable keys

---

### F09 [FRONTEND] [P2] `console.log(error)` left in Login and Signup

- **Files**: `client/src/pages/Login.jsx:76`, `Signup.jsx:94`
- **Why it is a problem**: Debug logging in production. In a real error scenario, the full error object (potentially containing the user's input) is dumped to the browser console. Unprofessional in a demo if someone opens DevTools.
- **User impact**: Minor — user doesn't see it unless they open DevTools.
- **Investor demo risk**: **Low** — unlikely unless the investor opens DevTools during an error.
- **What needs to change**: Remove both `console.log(error)` calls. If error logging is needed for debugging, use `console.error` with a meaningful context string, not the raw error object.
- **Estimated fix time**: 2 min
- **What I need to understand**: console.log vs console.error, debugging in production builds, when to keep vs remove dev logging

---

### F10 [FRONTEND] [P2] Unused `import React` in 3 files (React 19 JSX transform)

- **Files**: `Login.jsx:1`, `Signup.jsx:1`, `Profile.jsx:1`
- **Why it is a problem**: React 19 uses automatic JSX transform — `import React from "react"` is unnecessary. These imports add noise and slightly increase bundle size (tree-shaking should remove it, but it's untidy).
- **User impact**: None.
- **Investor demo risk**: **Low** — invisible.
- **What needs to change**: Remove `React` from the import statements: `import { useState, useEffect } from "react"`.
- **Estimated fix time**: 2 min
- **What I need to understand**: Automatic JSX transform in React 17+, why `import React` was needed historically, tree-shaking

---

### F11 [FRONTEND] [P2] `App.css` — 100% unused Vite boilerplate

- **File**: `client/src/App.css` (entire file, not imported anywhere)
- **Why it is a problem**: Dead code in the repo. Contains Vite/React scaffolding CSS (`.counter`, `.hero`, logo styles, `#docs`). Never imported by `App.jsx` or `main.jsx`. Adds confusion — a developer might try to add styles here thinking they'll apply.
- **User impact**: None.
- **Investor demo risk**: **Low** — but an investor reading the code will see leftover scaffolding.
- **What needs to change**: Delete the file.
- **Estimated fix time**: 2 min
- **What I need to understand**: How CSS imports work in Vite, recognizing scaffolding vs custom code

---

### F12 [FRONTEND] [P2] `hero.png` — unused asset, never referenced

- **File**: `client/src/assets/hero.png` (present on disk, never imported in any JSX/HTML/CSS)
- **Why it is a problem**: Dead asset taking up repo space. Likely leftover from initial scaffolding or an abandoned feature.
- **User impact**: None.
- **Investor demo risk**: **Low** — invisible.
- **What needs to change**: Delete the file. Confirm no references exist (`grep -r "hero.png" client/src/` returns empty).
- **Estimated fix time**: 2 min
- **What I need to understand**: Asset management in Vite, how to audit unused files

---

### F13 [FRONTEND] [P2] Hardcoded filter categories not derived from DB data

- **File**: `client/src/pages/RestaurantList.jsx:5` — `const FILTERS = ["All", "Pizza", "Burger", "Nigerian", "Drinks"]`
- **Why it is a problem**: The filter pills are hardcoded strings. They don't reflect the actual `category` values stored in `MenuItem.category`. A restaurant could have "Seafood" or "Desserts" items but users can't filter by them. Conversely, "Pizza" may show zero results if no restaurant has pizza items.
- **User impact**: Users can't filter by actual available categories. Empty filter results are confusing.
- **Investor demo risk**: **Medium** — clicking a filter that shows zero results looks broken.
- **What needs to change**: Derive filters dynamically from `MenuItem.category` values. Add a `GET /categories` endpoint or include a `_count` of items per category in the restaurant list response. Until then, at least verify the hardcoded list matches actual data.
- **Estimated fix time**: 30 min (dynamic categories endpoint + frontend)
- **What I need to understand**: Dynamic filter patterns, `prisma.groupBy` or `distinct` queries, derived UI state from API data

---

### F14 [FRONTEND] [P3] Favorites page is a dead stub

- **File**: `client/src/pages/Favorites.jsx` (entire page)
- **Why it is a problem**: The page shows a static "No favorites yet" empty state. There's no way to add favorites, no favorites table in the database, no API endpoint. The page exists but does nothing.
- **User impact**: Users who navigate to Favorites see a dead end. Broken expectation.
- **Investor demo risk**: **Medium** — navigating to Favorites during a demo shows nothing useful.
- **What needs to change**: For the demo: add a route redirect from `/favorites` to `/restaurants`, or show a more honest "Coming soon" with a CTA to browse restaurants. Long-term: implement favorites as a `CustomerFavorite` join table with API endpoints.
- **Estimated fix time**: 1 hr (minimal favorites CRUD); 5 min (redirect)
- **What I need to understand**: Many-to-many relationships in Prisma, optimistic UI updates for favorites, when to redirect vs show empty states

---

### F15 [FRONTEND] [P3] Profile page: 3 of 4 tabs are placeholders

- **File**: `client/src/pages/Profile.jsx:387-415`
- **Why it is a problem**: Order History, Payment Methods, and Favorites tabs all show "coming soon" static content. Only "Personal info" tab works.
- **User impact**: Users click tabs expecting functionality and see dead ends.
- **Investor demo risk**: **Medium** — clicking through tabs reveals unfinished features.
- **What needs to change**: Short-term: either link tabs to actual working pages (Order History → `/orders`), or hide non-functional tabs. Long-term: implement each tab's content.
- **Estimated fix time**: 2+ hr (full implementation); 15 min (hide non-functional tabs)
- **What I need to understand**: Tab-based navigation patterns, when to link out vs inline content

---

### F16 [FRONTEND] [P3] Admin dashboard: 4 of 6 sections are "Coming Soon"

- **File**: `client/src/pages/AdminDashboard.jsx:407`
- **Why it is a problem**: Restaurants, Customers, Orders, and Payments sections are all placeholders. Only Overview and Riders work. An admin user sees mostly empty panels.
- **User impact**: Admin cannot manage the platform through the dashboard.
- **Investor demo risk**: **Medium** — if the demo shows admin features, these dead sections are visible.
- **What needs to change**: Short-term: make each section functional with basic list views. The data already exists (restaurants, users, orders, payments tables). Long-term: full CRUD admin panels.
- **Estimated fix time**: 2+ hr (basic lists for all 4 sections); 30 min (quick list for Orders and Restaurants only)
- **What I need to understand**: Admin panel design patterns, Prisma queries for list views, pagination patterns

---

### F17 [FRONTEND] [P3] No shared API client — ~35 raw `fetch()` calls copy-pasted

- **Files**: All page components in `client/src/pages/`
- **Why it is a problem**: Every page manually constructs fetch calls: `${import.meta.env.VITE_API_URL}/path`, `Authorization: Bearer ${token}`, `Content-Type: application/json`. Token is read from `localStorage.getItem("token")` individually in each file. Error handling is inconsistent. Changing the API base URL or auth header format requires editing 10+ files. This is technical debt, not a demo-breaking issue.
- **User impact**: None directly. But inconsistent error handling (some pages show errors, others swallow them) means users have unpredictable experiences.
- **Investor demo risk**: **Low** — invisible to demo viewers.
- **What needs to change**: Create `client/src/utils/api.js` with a thin fetch wrapper that handles: base URL, auth header injection, JSON parsing, and consistent error responses. Replace inline fetches incrementally. This is architecture work, not a quick fix — prioritize after the demo.
- **Estimated fix time**: 2+ hr
- **What I need to understand**: API client abstraction patterns, fetch wrapper design, DRY principle applied to network calls, token management centralization

---

### F18 [FRONTEND] [P3] No `utils/` or `hooks/` directory — logic embedded in pages

- **Files**: Entire `client/src/` structure
- **Why it is a problem**: JWT decoding logic lives inside `AuthContext.jsx`. Fee calculation logic is duplicated in `Cart.jsx`. Notification permission requests are copy-pasted across 3 files. No custom hooks (`useOrders`, `useRestaurant`, etc.) exist. Pages are large (RiderDashboard is likely 600+ lines). This makes the codebase harder to maintain but doesn't affect the demo.
- **User impact**: None directly.
- **Investor demo risk**: **Low** — invisible.
- **What needs to change**: Extract reusable logic into custom hooks (`useApi`, `useSSE`, `useNotifications`). Extract utility functions (`formatCurrency`, `decodeJWT`). This is a post-demo refactor.
- **Estimated fix time**: 2+ hr
- **What I need to understand**: Custom React hooks, separation of concerns, extracting business logic from components

---

### FS01 [FULL-STACK] [P1] Client calculates fees for display; mismatch risk with server

- **Files**: `client/src/pages/Cart.jsx:140-143` (client); `server/src/services/feecalculator.js` (server)
- **Why it is a problem**: The cart page displays an estimated total (`estDelivery = 400`, `estService = 200`, `estTax = Math.round(groupTotal * 0.015)`) calculated client-side. The actual order total is computed server-side in `feecalculator.js`. If these ever diverge (e.g., server changes to dynamic delivery fees based on distance), the user sees a different price at checkout than what they agreed to in the cart.
- **User impact**: Price surprise at checkout. "You said ₦3,000 but charged ₦3,500." Trust erodes, cart abandonment increases.
- **Investor demo risk**: **Medium** — visible in the cart screen during a demo if someone looks closely.
- **What needs to change**: Return fee breakdown from the server as part of the checkout response (it already does), and display the server's calculation, not the client's estimate. Or add a `POST /orders/estimate` endpoint that returns server-computed fees without creating an order.
- **Estimated fix time**: 15 min (display server-computed fees from checkout response)
- **What I need to understand**: Client vs server fee calculation, why server is the source of truth for money, API response usage in UI

---

### FS02 [FULL-STACK] [P1] No `.env.example` files anywhere

- **Files**: `server/.env.example` (missing), `client/.env.example` (missing)
- **Why it is a problem**: New developers don't know what environment variables are required. The app won't start without guessing the right variable names. This is a basic open-source/professional standard that's missing.
- **User impact**: None (affects developers only).
- **Investor demo risk**: **Medium** — signals lack of developer documentation. An investor doing technical due diligence will note this.
- **What needs to change**: Create `server/.env.example` with placeholder values. Create `client/.env.example` with placeholder values. Document each variable. Add a note to CLAUDE.md.
- **Estimated fix time**: 10 min
- **What I need to understand**: .env.example conventions, what placeholder values look like, documentation standards

---

### FS03 [FULL-STACK] [P2] `User.phone` vs `Rider.phone` — duplicated phone field

- **Files**: `server/prisma/schema.prisma` (User model, Rider model); `client/src/pages/Signup.jsx` (collects phone on registration)
- **Why it is a problem**: The `User` model has an optional `phone` field, and the `Rider` model has its own required `phone` field. If a user updates their phone number in Profile, does the Rider phone update? They can diverge. This is a data integrity smell.
- **User impact**: Rider's contact phone may be stale or different from their account phone.
- **Investor demo risk**: **Low** — unlikely to surface.
- **What needs to change**: Decide: is `Rider.phone` the rider's contact number (distinct from account phone) or a duplicate? If duplicate, remove `Rider.phone` and use `User.phone`. If distinct, document why. Add a sync mechanism or remove the duplication.
- **Estimated fix time**: 30 min
- **What I need to understand**: Database normalization, data deduplication, when duplication is intentional vs accidental

---

### FS04 [FULL-STACK] [P2] Order status polling (30s) instead of SSE on owner dashboard

- **File**: `client/src/pages/ManageRestaurant.jsx:132`
- **Why it is a problem**: The owner dashboard polls `GET /restaurants/:id/orders` every 30 seconds for new orders. Meanwhile, the customer and rider dashboards use SSE for real-time updates. This is inconsistent — the owner gets delayed notifications (up to 30s) while other roles get instant updates. The SSE infrastructure already exists.
- **User impact**: Restaurant owner sees new orders up to 30 seconds late. In food delivery, 30 seconds matters for acceptance time.
- **Investor demo risk**: **Medium** — if comparing the owner dashboard to the customer/rider experience, the polling delay is noticeable.
- **What needs to change**: Replace the 30s polling interval with an SSE connection, reusing the same `/events` endpoint. The SSE `notify("order:updated")` already fires when orders change. Or keep polling but reduce to 5s.
- **Estimated fix time**: 1 hr (SSE conversion); 5 min (reduce polling interval)
- **What I need to understand**: SSE vs polling trade-offs, EventSource API, how the existing SSE notification system works

---

### D01 [DATABASE] [P2] No indexes on foreign key columns

- **File**: `server/prisma/schema.prisma` (no `@@index` declarations)
- **Why it is a problem**: Foreign key columns (`Order.customerId`, `Order.restaurantId`, `Delivery.riderId`, `OrderItem.orderId`, `OrderItem.menuItemId`, `MenuItem.restaurantId`, `Restaurant.ownerId`) have no explicit indexes. PostgreSQL creates implicit indexes for `@unique` constraints but NOT for plain foreign keys. Queries like "get all orders for a customer" or "get all menu items for a restaurant" will sequentially scan at scale.
- **User impact**: Slow page loads as the database grows. Currently negligible (small dataset), but becomes critical at hundreds of orders.
- **Investor demo risk**: **Low** — won't surface with demo-scale data.
- **What needs to change**: Add `@@index([customerId])`, `@@index([restaurantId])`, `@@index([riderId])`, `@@index([orderId])` to the relevant models. Create a migration or use `prisma db push`.
- **Estimated fix time**: 30 min
- **What I need to understand**: Database indexes and query performance, Prisma `@@index` syntax, when indexes matter vs when they're premature optimization

---

### D02 [DATABASE] [P2] Schema drift — current schema diverged from last migration

- **File**: `server/prisma/schema.prisma` vs `server/prisma/migrations/`
- **Why it is a problem**: The last migration (#8: `20260723172104_add_rider_and_delivery`) created DeliveryStatus as `ASSIGNED/PICKED_UP/IN_TRANSIT/DELIVERED/FAILED`. The current schema has `ZILLA_ON_IT/AT_KITCHEN/BAGGED/MOVING/CLOSE_BY/DELIVERED/FAILED`. These changes were applied via `prisma db push`, which doesn't create migration files. Running `prisma migrate dev` in the future may generate a reset migration or fail. The migration history is unreliable.
- **User impact**: None directly. Operational risk during deployment.
- **Investor demo risk**: **Low** — invisible to demo viewers.
- **What needs to change**: Generate a new migration that captures the current schema state: `npx prisma migrate dev --name sync_current_schema`. This creates a migration with the correct enums and fields. Ensure no data loss.
- **Estimated fix time**: 1 hr (generate + verify migration)
- **What I need to understand**: Prisma migration workflow, `prisma db push` vs `prisma migrate dev`, schema drift and how to resolve it

---

### D03 [DATABASE] [P3] No seed data file for development/demo

- **File**: Missing — no `server/prisma/seed.js`
- **Why it is a problem**: Setting up a development or demo environment requires manually creating restaurants, menu items, and users. This makes onboarding slow and demos brittle. A seed file with realistic sample data makes the app instantly demonstrable.
- **User impact**: None (developer experience issue).
- **Investor demo risk**: **Medium** — an investor demo without data looks empty. Seed data makes the app feel alive.
- **What needs to change**: Create `server/prisma/seed.js` with: 2-3 sample restaurants, 5-10 menu items per restaurant, 1 test customer, 1 test owner, 1 test rider. Add `"prisma": { "seed": "node prisma/seed.js" }` to `server/package.json`. Use realistic Nigerian restaurant names and dishes.
- **Estimated fix time**: 30 min
- **What I need to understand**: Prisma seed configuration, creating related records in seed files, bcrypt hashing in seeds, realistic demo data

---

### DV01 [DEVOPS] [P1] `client/.env.production` missing `VITE_PAYSTACK_PUBLIC_KEY`

- **File**: `client/.env.production`
- **Why it is a problem**: The production build environment file contains only `VITE_API_URL`. The Paystack public key is missing. When building for production (`vite build`), the Paystack key will be `undefined`, and the payment flow will fail.
- **User impact**: In production, payments don't work. This is a silent deployment killer.
- **Investor demo risk**: **High** — if the demo uses a production build, checkout is completely broken.
- **What needs to change**: Add `VITE_PAYSTACK_PUBLIC_KEY=pk_live_...` (or the test key if using test mode) to `.env.production`. Ensure both `.env` and `.env.production` have the same required keys.
- **Estimated fix time**: 5 min
- **What I need to understand**: Vite environment variable modes, `.env` vs `.env.production` vs `.env.development`, VITE_ prefix requirement

---

### DV02 [DEVOPS] [P2] `server/.env` contains live DB credentials + Paystack secret on disk (properly gitignored)

- **File**: `server/.env`
- **Why it is a problem**: The file is properly gitignored (verified: not committed), but it contains live Supabase database credentials and a Paystack secret key. Anyone with filesystem access to the server can read these. This is standard practice for development, but worth noting in an audit.
- **User impact**: None unless the server is compromised.
- **Investor demo risk**: **Low** — standard practice, properly gitignored.
- **What needs to change**: Ensure these are test/demo credentials, not production credentials. Rotate keys if the repo has ever been public or shared. Consider using a secrets manager in production (environment variables set at the deployment platform level).
- **Estimated fix time**: 5 min (verify test keys only; rotate if needed)
- **What I need to understand**: Environment variable management, secret rotation, difference between test and live API keys

---

### DV03 [DEVOPS] [P3] No test framework configured anywhere

- **Files**: Both `package.json` files (no test scripts)
- **Why it is a problem**: Zero test coverage. No unit tests, no integration tests, no E2E tests. Every change is deployed blind. Payment flows, auth, and delivery state machines are untested.
- **User impact**: Bugs reach production undetected.
- **Investor demo risk**: **Low** — invisible to demo viewers, but a red flag in technical due diligence.
- **What needs to change**: Add Vitest (client) + Vitest or Jest (server) for unit tests. Add Supertest for API integration tests. Start with the 3 money-path tests: checkout, payment verification, delivery state machine.
- **Estimated fix time**: 2+ hr (minimal critical-path tests only)
- **What I need to understand**: Test framework setup (Vitest), API testing with Supertest, test-driven development basics, what to test first

---

---

## PRIORITY ACTIONS

---

### 1. FIX FIRST TODAY (Top 5 — stop the bleeding)

| # | ID | Issue | Why First |
|---|----|-------|-----------|
| 1 | **F01** | PaystackPop unchecked global → checkout crash | **Money path. If checkout breaks, there is no product.** 15 min fix. |
| 2 | **F03** | Payment verify fetch has no `.catch()` | **Silent payment failures. User pays, order lost.** 10 min fix. |
| 3 | **F02** | Tax label says 7.5%, calculates 1.5% | **Visible on cart. Looks like a compliance error.** 5 min fix. |
| 4 | **S01** | JWT tokens in SSE URL query params | **Token leak = account takeover. Security investor will flag.** 15 min fix. |
| 5 | **F04** | Fake 4.5-star rating on every restaurant | **First thing an investor sees. Screams "fake data."** 15 min fix. |

**Total estimated time: 1 hour. These fix the most embarrassing / dangerous issues.**

---

### 2. FIX NEXT (Next 5 — polish the demo)

| # | ID | Issue | Why Next |
|---|----|-------|----------|
| 6 | **F07** | Dead Google/Apple social buttons | **Very visible on login/signup. Broken promise.** 5 min fix. |
| 7 | **F06** | Dead "Forgot Password?" link | **Visible on login. Broken auth flow.** 5 min fix. |
| 8 | **S03** | Raw error messages to clients | **Unprofessional if an error occurs during demo.** 15 min fix (with B01). |
| 9 | **B01** | Missing global error handler | **Prevents crash during demo. Fixes inconsistent errors.** 15 min fix. |
| 10 | **FS02** | No `.env.example` files | **Basic professionalism. New devs can't onboard.** 10 min fix. |

**Total estimated time: 50 minutes. These remove the most visible "unfinished" signals.**

---

### 3. IGNORE FOR NOW (Post-investor — technical debt that doesn't block a demo)

| ID | Issue | Reason to Defer |
|----|-------|------------------|
| B02 | No input validation library | Existing manual validation works adequately for demo-scale traffic |
| B03 | `console.error` everywhere | Invisible to users; fix as part of B04 (logging overhaul) |
| B04 | No structured logging | Invisible; implement when moving to production |
| F08 | Index-as-key in `.map()` | Won't surface in a short demo unless order lists change rapidly |
| F09 | `console.log(error)` in Login/Signup | Invisible unless DevTools is open during an error |
| F10 | Unused `import React` | Invisible; lint fix |
| F11 | Dead `App.css` | Delete in 2 min whenever convenient |
| F12 | Unused `hero.png` | Delete in 2 min whenever convenient |
| F13 | Hardcoded filter categories | Works for demo if demo data matches filters |
| F14 | Favorites stub | Not on the critical demo path |
| F15 | Profile tabs placeholder | Not on the critical demo path |
| F16 | Admin "coming soon" sections | Not on the critical demo path |
| F17 | No shared API client | Architecture work; no user-facing impact |
| F18 | No `utils/` or `hooks/` | Architecture work; no user-facing impact |
| FS03 | Duplicate phone fields | Low risk; doesn't affect demo |
| FS04 | Polling instead of SSE | 30s delay is fine for a demo |
| D01 | Missing FK indexes | Won't matter at demo scale |
| D02 | Schema drift | Won't affect a demo; fix before next deploy |
| D03 | No seed data | Create ad-hoc demo data manually |
| DV03 | No tests | Won't affect a demo; critical for production |
| S04 | No rate limiting | Won't matter for a demo behind a single user |
| S05 | No security headers | Won't surface in a demo; add before production |
| DV02 | Live creds on disk | Properly gitignored; standard dev practice |

---

### Summary

| Category | P0 | P1 | P2 | P3 | Total |
|----------|----|----|----|----|-------|
| FRONTEND | 1 | 6 | 6 | 5 | 18 |
| BACKEND | 0 | 2 | 2 | 0 | 4 |
| FULL-STACK | 0 | 2 | 2 | 0 | 4 |
| SECURITY | 2 | 3 | 0 | 0 | 5 |
| DATABASE | 0 | 0 | 2 | 1 | 3 |
| DEVOPS | 0 | 1 | 1 | 1 | 3 |
| **TOTAL** | **3** | **14** | **13** | **7** | **37** |

**Time to fix all P0 + critical P1 (FIX FIRST TODAY + FIX NEXT): ~2 hours.**


riders should place picture at sign up as mandatory
