# Stabilize & harden the platform before production

## Summary

Recovery/stabilization branch that closes out the investor-audit backlog. Security hardening, centralized error handling, zod input validation, and structured logging across the backend — plus the money-path and trust fixes on the frontend: real (verified-only) restaurant & rider reviews, email-based password reset, and corrected delivery-fee / tax display.

21 commits · 40 files · +3,194 / −456

## What's included

### Security (S01–S05)
- JWT moved out of SSE URL query params
- Strong `JWT_SECRET`
- Generic error responses — raw errors no longer leak to clients
- Rate limiting on sensitive endpoints
- `helmet` security headers

### Backend (B01–B04)
- Global error-handling middleware (async handlers forward via `next()`)
- zod validation on all write endpoints
- Structured logging (morgan request logging + leveled logger), replacing `console.error` litter
- Idempotent checkout (client-generated `idempotencyKey` for retry safety)

### Frontend (F01–F08)
- Guard `PaystackPop` global before use (F01)
- Tax rate corrected to 7.5% client + server (F02)
- Payment verification now has `.catch()` (F03)
- **Real ratings** — hardcoded 4.5★ replaced with verified-customer restaurant & rider reviews: one per user per target, DB-aggregated `avgRating` / `reviewCount` (F04)
- Real delivery fee shown instead of fake "20–30 min" (F05)
- **Password reset** via email (Resend): forgot-password → hashed, expiring token → reset (F06)
- Stable React keys — order-item `id` instead of array index (F08)

## ⚠️ Migration

Deploy must run `npx prisma migrate deploy` before serving traffic. Three migrations:
- `20260814115417_sync_schema` — DeliveryStatus rewrite, `RejectedOrder`, `Order.idempotencyKey`, `Rider.matricNumber`, `User.phone`
- `20260815152612_add_reviews` — `RestaurantReview` + `RiderReview`
- `20260817140631_add_password_reset` — `User.resetTokenHash` / `resetTokenExpiresAt`

## Test

1. Sign up → browse restaurants (real avg rating + delivery fee) → checkout (7.5% tax)
2. Complete an order → rate the restaurant and rider from the order detail
3. Log out → "Forgot password" → reset via email link → sign in with new password
4. Owner dashboard: accept/reject orders · rider: accept → deliver · admin overview

## Deferred / follow-up

- **F07** — Google/Apple social login buttons still dead (deferred)
- **F09–F18** — `console.log` cleanup, unused imports/assets, shared API client, favorites/profile/admin stubs
