# PROJECT.md — Project Status & Progress Log

## Project: ChowZilla

A food delivery platform where customers order from restaurants. Built with React + Express + PostgreSQL as a full-stack learning project with real-world shipping standards.

---

## Current State (as of 2026-07-21)

**Phase:** Payment system complete. Rider system next.

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
| User auth | POST /users (signup, returns JWT), POST /users/login, GET+PUT /users/profile |
| JWT middleware | Verifies Bearer token, attaches user to request |
| Owner middleware | Role enforcement — blocks CUSTOMER from owner actions |
| Rider middleware | Role enforcement — blocks non-RIDER from rider actions |
| Restaurant API | Full CRUD: GET all, GET/:id, POST (owner), PUT/:id (owner) |
| MenuItem API | Full CRUD: GET by restaurant, POST (owner), PUT/:id (owner), DELETE/:id (owner) |
| Order API | POST /orders/checkout, GET all (customer), GET/:id (customer+owner), PUT/:id/status (owner) |
| Restaurant orders | GET /restaurants/:id/orders — owner views orders for their restaurant |
| Fee calculator | Backend-owned pricing: subtotal, deliveryFee (₦400), serviceFee (₦200), tax (1.5%), totalAmount |
| Payment model | Created alongside order: PAYSTACK provider, unique reference, PENDING/SUCCESS/FAILED status |
| Paystack service | verifyPayment() — server-to-server verification via Paystack API |
| Payment verify | POST /payments/verify — verifies reference with Paystack, atomically updates payment→SUCCESS + order→PENDING_RESTAURANT_CONFIRMATION |
| Rider routes | POST /riders/register, GET /riders/me, PUT /riders/me |
| Rider model | Separate table: vehicleType, licensePlate, licenseNumber, phone, isAvailable, isVerified |

### Frontend — Customer

| Feature | Details |
|---------|---------|
| Signup | Role selector (Customer/Owner/Rider), auto-login after signup, role-based redirect |
| Login | Email/password, JWT stored, role-based redirect |
| Restaurant list | Real data, search bar, category filters, skeleton loading, error/empty states, responsive card grid |
| Restaurant detail | Hero image, restaurant info, category-filtered menu, add-to-cart with +/- controls |
| Cart (CartContext) | Shared state persisted to localStorage, survives navigation and refresh |
| Cart page | Items grouped by restaurant, fee breakdown matching backend (₦400 delivery, ₦200 service, 1.5% tax), Paystack popup integration |
| Paystack payment | Inline popup after checkout, onSuccess verifies via backend, onClose navigates to order for later payment |
| Order history | Real data from GET /orders, status badges, skeleton/error/empty states, auto-polling every 20s with browser notifications |
| Order detail | Status timeline, items breakdown, correct fee breakdown (subtotal/delivery/service/tax/total), auto-polling every 15s with browser notifications on status change |
| Browser notifications | Permission requested on order pages, notification on status changes |
| Profile | View/edit personal info, tab switching |
| Protected routes | ProtectedRoute + OwnerRoute + RiderRoute components, role-based access |
| Desktop navigation | Top navbar with nav links, cart icon with badge, user dropdown |
| Mobile navigation | Bottom nav bar, hamburger menu |
| Logout | Clears context + localStorage, redirects to /login |

### Frontend — Owner

| Feature | Details |
|---------|---------|
| OwnerRoute | Restricts access to OWNER role only |
| Dashboard | Restaurant list, create restaurant form, stats cards |
| Manage Restaurant | Edit restaurant info, full menu CRUD, toast notifications |
| Orders tab | New orders (PENDING_RESTAURANT_CONFIRMATION), active (PREPARING, OUT_FOR_DELIVERY), past (DELIVERED, CANCELLED) |
| Order actions | Accept (→ PREPARING), Decline (→ CANCELLED), status dropdown |
| Notification polling | Every 30s checks for new orders, browser notification + toast on new order, auto-updates order list |

### Frontend — Rider

| Feature | Details |
|---------|---------|
| Signup | Two-step: user account → rider profile (vehicle type, license, phone) |
| RiderRoute | Restricts access to RIDER role only |

### Infrastructure

| Feature | Details |
|---------|---------|
| Deployment | Frontend on Vercel, backend on Render, PostgreSQL on Supabase |
| CORS | Dynamic origin via CLIENT_URL env var, localhost fallback |
| SPA routing | vercel.json with rewrite rule — all paths → index.html |
| JWT expiry | Token decoded on init, expired tokens cleared from localStorage |

### Database Schema (current)

| Model | Key fields |
|-------|-----------|
| User | id, name, email, password, role (CUSTOMER/OWNER/RIDER) |
| Restaurant | id, name, description, phone, imageUrl, address, ownerId |
| MenuItem | id, name, description, price, category, isAvailable, restaurantId |
| Order | id, status, subtotal, deliveryFee, serviceFee, tax, totalAmount, deliveryAddress, paidAt, paymentReference, customerId, restaurantId |
| OrderItem | id, quantity, unitPrice, totalPrice, orderId, menuItemId |
| Payment | id, orderId, provider, reference, amount, currency, status, paidAt, gatewayResponse |
| Rider | id, userId, vehicleType, licensePlate, licenseNumber, phone, isAvailable, isVerified |

**Order statuses:** PENDING_PAYMENT → PENDING_RESTAURANT_CONFIRMATION → PREPARING → OUT_FOR_DELIVERY → DELIVERED / CANCELLED

---

## 🟡 In Progress

| Feature | Status |
|---------|--------|
| Delivery model + tracking | Schema designed, routes next |
| Rider dashboard | Accept/reject deliveries, update status |

---

## ❌ Not Started

| Feature | Priority | Target |
|---------|----------|--------|
| Favorites page (real functionality) | 🟡 | v2 |
| 404 page | 🟢 | v2 |
| Seed data for development | 🟢 | v2 |
| Restaurant search by name | 🟡 | v2 |
| Ratings + reviews | 🟢 | v2 |

---

## 🗺️ Roadmap — v2 & v3 (Future)

### v2 — Location, Delivery & Riders

| Feature | Details |
|---------|---------|
| Restaurant coordinates | latitude, longitude on Restaurant model |
| Distance-based delivery tiers | 0-500m=₦300, 501m-1km=₦500, etc. |
| Rider dashboard | View available deliveries, accept, update status |
| Delivery tracking | Customer sees rider info + delivery status |
| Live tracking | Socket.IO for real-time rider location |

### v3 — Wallet, Reviews & Polish

| Feature | Details |
|---------|---------|
| Wallet model | User wallet balance, deposits, withdrawals |
| Paystack refunds | Auto-refund on restaurant decline |
| Ratings + reviews | After delivery, rate restaurant |
| Restaurant hours | Open/close times, filter available |
| Money in kobo | Migrate money fields from Decimal to Int (kobo) |

---

## Known Bugs

*None currently.*

---

## Progress Log

| Date | What was done |
|------|--------------|
| 2026-07-21 | Rider system started: RIDER role added to UserRole enum, Rider model added (vehicleType, licensePlate, licenseNumber, phone, isAvailable, isVerified), rider middleware, rider routes (POST /riders/register, GET/PUT /riders/me), RiderSignup page (two-step: account → profile), Signup page updated with RIDER role option, RiderRoute component |
| 2026-07-21 | Polling + notifications: restaurant dashboard polls every 30s for new orders with browser notification + toast, OrderDetail polls every 15s for status changes with auto-update + notification, Orders list polls every 20s with auto-update + notification, toast stays 10s + click to dismiss |
| 2026-07-21 | Payment flow fixed: handleAcceptOrder sends PREPARING (not invalid CONFIRMED), pendingOrders filter changed to PENDING_RESTAURANT_CONFIRMATION, ACTIVE_STATUSES updated to PREPARING + OUT_FOR_DELIVERY only |
| 2026-07-21 | Paystack payment integration complete: paystack.js service (verifyPayment), POST /payments/verify (amount validation, atomic Prisma transaction), Paystack inline script in index.html, Cart.jsx checkout flow (checkout → popup → verify → navigate), env vars for keys |
| 2026-07-21 | Order breakdown fixed in OrderDetail: subtotal now shows order.subtotal (was showing totalAmount), delivery fee shows actual charge (was hardcoded "Free"), service fee line added, tax commented out |
| 2026-07-21 | Status values aligned frontend↔backend: PENDING_PAYMENT, PENDING_RESTAURANT_CONFIRMATION, PREPARING, OUT_FOR_DELIVERY, DELIVERED, CANCELLED across all 3 pages. Fallback defaults updated. |
| 2026-07-21 | Field names aligned: order.total→order.totalAmount, item.price→item.unitPrice on order items across Orders.jsx, OrderDetail.jsx, ManageRestaurant.jsx. Stale Prisma client on Render fixed by redeploy. |
| 2026-07-20 | Payment schema: OrderStatus rewritten, Payment model added, Order fees (subtotal/deliveryFee/serviceFee/tax/totalAmount), OrderItem price freezing. Fee calculator service. Checkout endpoint: validates items, backend-owned pricing, creates Order + Payment. Cart fee breakdown UI. |
| 2026-07-19 | Production CORS, SPA rewrites, Render/Supabase deployment. Auth routing fix. JWT expiry validation. |
| 2026-07-18 | Shared AppLayout extracted (~1,450 lines removed). Orders tab on ManageRestaurant. Owner dashboard + restaurant management. Order detail page. CartContext + Cart page. Restaurant detail page. |
| 2026-07-17 | Order model + CRUD API built and tested. 4 endpoints with auth and ownership checks. |
| 2026-07-13 | MenuItem model + CRUD API built and tested. |
| 2026-07-10 | Restaurant model + CRUD API built and tested. |
| 2026-07-04 | Auth system complete: Login, Signup, Profile, AuthContext, ProtectedRoute. |
| 2026-06-28 | Signup page connected to backend. CORS enabled. |
| 2026-06-22 | Auth page with animations added. |
| 2026-06-15 | Client app set up. JWT auth middleware. User registration/login with bcrypt. Express server. Backend initialized. |
