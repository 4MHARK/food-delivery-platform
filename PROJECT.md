# PROJECT.md — Project Status & Progress Log

## Project: ChowZilla

A food delivery platform where customers order from restaurants. Built with React + Express + PostgreSQL as a full-stack learning project with real-world shipping standards.

---

## Current State (as of 2026-07-20)

**Phase:** Payment system — checkout built, Paystack integration next.

## Deployment

| Service | URL |
|---------|-----|
| Frontend (Vercel) | https://food-delivery-platform-gamma.vercel.app |
| Backend (Render) | https://food-delivery-platform-jux3.onrender.com |
| Database (Supabase) | PostgreSQL (session pooler) |

---

## ✅ Completed

### Backend

| Feature | Details |
|---------|---------|
| Server | Express 5 on port 5000, CORS, JSON parsing |
| Database | PostgreSQL via Prisma, full schema with 6 models |
| User auth | POST /users (signup, now returns JWT), POST /users/login, GET+PUT /users/profile |
| JWT middleware | Verifies Bearer token, attaches user to request |
| Owner middleware | Role enforcement — blocks CUSTOMER from owner actions |
| Restaurant API | Full CRUD: GET all, GET/:id, POST (owner), PUT/:id (owner) |
| MenuItem API | Full CRUD: GET by restaurant, POST (owner), PUT/:id (owner), DELETE/:id (owner) |
| Order API | POST /orders/checkout, GET all (customer), GET/:id (customer+owner), PUT/:id/status (owner) |
| Restaurant orders | GET /restaurants/:id/orders — owner views orders for their restaurant |
| Fee calculator | Backend-owned pricing: subtotal, deliveryFee, serviceFee, tax (7.5%), totalAmount |
| Payment model | Created alongside order: PAYSTACK provider, unique reference, PENDING/SUCCESS/FAILED status |

### Frontend — Customer

| Feature | Details |
|---------|---------|
| Signup | Role selector (Customer/Owner), auto-login after signup, role-based redirect |
| Login | Email/password, JWT stored, role-based redirect (OWNER → /dashboard, CUSTOMER → /restaurants) |
| Restaurant list | Real data, search bar, category filters, skeleton loading, error/empty states, responsive card grid |
| Restaurant detail | Hero image, restaurant info, category-filtered menu, add-to-cart with +/- controls |
| Cart (CartContext) | Shared state persisted to localStorage, survives navigation and refresh |
| Cart page | Items grouped by restaurant, fee breakdown (subtotal, delivery, service, tax, total), checkout via /orders/checkout |
| Order history | Real data from GET /orders, status badges with color coding, skeleton/error/empty states |
| Order detail | Status timeline (desktop horizontal, mobile vertical), items breakdown, price summary, delivery address |
| Profile | View/edit personal info, tab switching |
| Protected routes | ProtectedRoute + OwnerRoute components, role-based access |
| Desktop navigation | Top navbar with nav links, cart icon with badge, user dropdown (profile, orders, logout) |
| Mobile navigation | Bottom nav bar, hamburger menu with slide-down panel |
| Logout | Clears context + localStorage, redirects to /login |
| Branding | "ChowZilla" name, amber-500 color scheme, Material Symbols icons |

### Frontend — Owner

| Feature | Details |
|---------|---------|
| OwnerRoute | Restricts access to OWNER role only |
| Dashboard | Restaurant list, create restaurant form (name, description, address, phone, image), stats cards |
| Manage Restaurant | Edit restaurant info, full menu CRUD (add, edit, delete items), toast notifications, Orders tab (view + status update dropdown), tab navigation |
| Shared Layout | AppLayout component extracted — header, mobile nav, user dropdown, cart. All 8 pages refactored. ~1,450 lines removed. |

### Infrastructure

| Feature | Details |
|---------|---------|
| Deployment | Frontend on Vercel, backend on Render, PostgreSQL on Supabase |
| CORS | Dynamic origin via CLIENT_URL env var, localhost fallback |
| SPA routing | vercel.json with rewrite rule — all paths → index.html |
| Auth routing fix | HomeRedirect checks isAuthenticated before role — guests see login, not restaurants |
| JWT expiry | Token decoded on init, expired tokens cleared from localStorage |

### Database Schema (v1 — current)

| Model | Key fields |
|-------|-----------|
| User | id, name, email, password, role (CUSTOMER/OWNER) |
| Restaurant | id, name, description, phone, imageUrl, address, ownerId |
| MenuItem | id, name, description, price, category, isAvailable, restaurantId |
| Order | id, status, subtotal, deliveryFee, serviceFee, tax, totalAmount, deliveryAddress, paidAt, paymentReference, customerId, restaurantId |
| OrderItem | id, quantity, unitPrice, totalPrice, orderId, menuItemId (prices frozen at order time) |
| Payment | id, orderId, provider, reference, amount, currency, status, paidAt, gatewayResponse |

**Order statuses:** PENDING_PAYMENT → PENDING_RESTAURANT_CONFIRMATION → PREPARING → OUT_FOR_DELIVERY → DELIVERED / CANCELLED

---

## 🟡 In Progress

| Feature | Status |
|---------|--------|
| Paystack card payment integration | Next — gateway init + webhook + verify |

---

## ❌ Not Started

| Feature | Priority | Target |
|---------|----------|--------|
| Paystack initialize endpoint (POST /orders/:id/pay) | 🔴 Now | v1 |
| Paystack webhook + verify (POST /payments/webhook) | 🔴 Now | v1 |
| Frontend payment redirect + verification screen | 🔴 Now | v1 |
| Favorites page (real functionality) | 🟡 | v1 |
| 404 page | 🟢 | v1 |
| Seed data for development | 🟢 | v1 |

---

## 🗺️ Roadmap — v2 & v3 (Future)

### v2 — Location & Delivery Pricing

| Feature | Details |
|---------|---------|
| Restaurant coordinates | latitude, longitude, formattedAddress on Restaurant model |
| UserLocation model | Multiple saved delivery addresses, default selection, map picker |
| Haversine distance calculation | Backend-calculated straight-line distance |
| Distance-based delivery tiers | 0-500m=₦300, 501m-1km=₦500, 1-2km=₦700, 2-3km=₦900, 3km+=₦1200 |
| Delivery location snapshot on Order | deliveryLat, deliveryLng, distanceMeters frozen at order time |
| Leaflet + OpenStreetMap | Free map for location picker UI |
| Pricing services | Modular: distance.service, delivery-pricing.service, order-pricing.service |

### v3 — Wallet, Riders & Real-Time

| Feature | Details |
|---------|---------|
| Wallet model | User wallet balance, deposits, withdrawals |
| Wallet payment | Pay from wallet balance as alternative to card |
| Rider role | Rider signup, order assignment, delivery tracking |
| Real-time tracking | Socket.IO for live rider location on customer map |
| Push notifications | Order status changes, rider updates |
| Restaurant commission | Commission rate per restaurant, automatic settlement calculation |
| Money in kobo | Migrate all money fields from Decimal to Int (kobo) |
| Pricing metadata | pricingVersion, pricingContext JSON on Order for auditability |

---

## Known Bugs

*None currently.*

---

## Progress Log

| Date | What was done |
|------|--------------|
| 2026-07-20 | Payment schema: Wallet/Transaction removed, OrderStatus rewritten, Payment model added, Order fees (subtotal/deliveryFee/serviceFee/tax/totalAmount), OrderItem price freezing. Fee calculator service (7.5% tax, ₦500 delivery, ₦300 service). Checkout endpoint (POST /orders/checkout): validates items belong to same restaurant, backend-owned pricing, creates Order + Payment. Cart page updated with fee breakdown UI. v2/v3 roadmap documented. |
| 2026-07-19 | Production CORS, SPA rewrites, Render/Supabase deployment. Auth routing fix: unauthenticated users redirected to /login instead of /restaurants. JWT expiry validation on init. |
| 2026-07-18 | Shared AppLayout component extracted — all 8 pages refactored, ~1,450 lines of duplicated header/nav removed. |
| 2026-07-18 | Orders tab added to ManageRestaurant: view all orders, update status via dropdown, loading/error/empty states. GET /users secured with auth middleware. |
| 2026-07-18 | Owner dashboard + restaurant management built. OwnerRoute, create restaurant form, menu CRUD. Role-based redirect after login/signup. |
| 2026-07-18 | Order detail page built with status timeline (desktop horizontal, mobile vertical), items breakdown, price summary. Orders heading renamed to "Order History". |
| 2026-07-18 | CartContext + Cart page built. Shared cart state persisted to localStorage. Checkout flow: add items → cart → delivery address → place order → order history. |
| 2026-07-18 | Restaurant detail page built with hero section, category-filtered menu, add-to-cart with +/- controls, mobile cart bar. |
| 2026-07-18 | Restaurant list page redesigned: desktop top navbar with user dropdown and logout, mobile hamburger menu + bottom nav, skeleton loading, search, filters. |
| 2026-07-18 | Orders and Favorites placeholder pages created. Bottom nav wired across all pages. Auto-login after signup. Signup role selector fixed (Customer/Owner radio buttons). |
| 2026-07-17 | Order model + CRUD API built and tested. 4 endpoints (POST, GET all, GET/:id, PUT status) with auth and ownership checks. 4/4 tests passed. |
| 2026-07-13 | MenuItem model + CRUD API built and tested. 4 endpoints (POST, GET, PUT, DELETE) with auth and ownership checks. 4/4 curl tests passed. |
| 2026-07-10 | Restaurant model + CRUD API built and tested. 4 endpoints (GET all, GET/:id, POST, PUT) with auth and ownership checks. 9/9 curl tests passed. |
| 2026-07-04 | Auth system complete: Login, Signup, Profile with edit/save, AuthContext, ProtectedRoute, PUT endpoint. E2E tested. 4 commits pushed. |
| 2026-06-28 | Signup page connected to backend (commit `a84b914`) |
| 2026-06-28 | CORS enabled for frontend auth requests (commit `38184dc`) |
| 2026-06-22 | Auth page left side with animations added (commit `9934ea0`) |
| 2026-06-15 | Client app set up, basic auth middleware (commit `3b86cec`) |
| 2026-06-15 | JWT login and auth middleware setup (commit `1af4239`) |
| 2026-06-15 | User registration and login routes with bcrypt (commit `4fe1bf0`) |
| 2026-06-15 | User creation endpoint with Prisma (commit `4d6d0fd`) |
| 2026-06-15 | Backend folder structure prepared (commit `0afd21e`) |
| 2026-06-15 | Express server and initial API route (commit `fea6b59`) |
| 2026-06-15 | Backend project initialized (commit `c16f275`) |
