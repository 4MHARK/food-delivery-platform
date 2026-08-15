# ChowZilla Food Delivery Platform — Codebase Inventory

**Generated**: 2026-08-10
**Branch**: `project-recovery`
**Last commit**: `36ab5b0` — feat: admin dashboard with rider verification, admin signup with invite code

---

## Table of Contents

1. [Frontend Routes](#1-frontend-routes)
2. [Frontend Components](#2-frontend-components)
3. [Frontend Contexts](#3-frontend-contexts)
4. [Backend Routes — Complete Endpoint Map](#4-backend-routes--complete-endpoint-map)
5. [Backend Middleware](#5-backend-middleware)
6. [Backend Services](#6-backend-services)
7. [Database Models](#7-database-models)
8. [localStorage Usage](#8-localstorage-usage)
9. [Hardcoded / Mock Data](#9-hardcoded--mock-data)
10. [API Calls — Client fetch() Inventory](#10-api-calls--client-fetch-inventory)
11. [Obvious Errors & Issues](#11-obvious-errors--issues)
12. [Dependencies](#12-dependencies)
13. [Environment Variables](#13-environment-variables)
14. [Server Configuration & Entry Points](#14-server-configuration--entry-points)
15. [Client Directory Structure](#15-client-directory-structure)
16. [Server Directory Structure](#16-server-directory-structure)

---

## 1. Frontend Routes

**File**: `client/src/App.jsx`
**Router**: React Router DOM 7, `BrowserRouter`

| # | Path | Component | Guard | Purpose |
|---|------|-----------|-------|---------|
| 1 | `/` | `HomeRedirect` | None | Smart redirect by role: unauthenticated → `/login`; ADMIN → `/admin`; OWNER → `/dashboard`; RIDER → `/rider`; else → `/restaurants` |
| 2 | `/signup` | `Signup` | Public | User registration (CUSTOMER / OWNER / RIDER) |
| 3 | `/login` | `Login` | Public | User login |
| 4 | `/admin/register` | `AdminSignup` | Public | Admin registration with invite code |
| 5 | `/restaurants` | `RestaurantList` | Public | Browse all restaurants with search + category filters |
| 6 | `/restaurants/:id` | `RestaurantDetail` | Public | Single restaurant page with menu + cart controls |
| 7 | `/cart` | `Cart` | `ProtectedRoute` | Cart review + Paystack checkout flow |
| 8 | `/orders` | `Orders` | `ProtectedRoute` | Customer order history with SSE live updates |
| 9 | `/orders/:id` | `OrderDetail` | `ProtectedRoute` | Order status timeline + delivery tracker |
| 10 | `/favorites` | `Favorites` | `ProtectedRoute` | **Stub** — static empty state, no data fetching |
| 11 | `/profile` | `Profile` | `ProtectedRoute` | User profile; only "Personal Info" tab works, 3 others are "coming soon" |
| 12 | `/dashboard` | `ManageRestaurant` | `OwnerRoute` | Owner: restaurant CRUD, menu CRUD, order management (accept/cancel/status) |
| 13 | `/rider` | `RiderDashboard` | `RiderRoute` | Rider: registration, availability toggle, available orders, active delivery, history |
| 14 | `/admin` | `AdminDashboard` | `AdminRoute` | Admin: overview stats, rider verification; 4 of 6 sections are "Coming Soon" |

**Route params**: `:id` appears in `/restaurants/:id` (restaurant ID) and `/orders/:id` (order ID).

---

## 2. Frontend Components

**Directory**: `client/src/components/`

| File | Exports | Logic |
|------|---------|-------|
| `ProtectedRoute.jsx` | Default | If `!isAuthenticated`, redirect to `/login`; otherwise render children |
| `OwnerRoute.jsx` | Default | If not authenticated → `/login`; if `user.role !== "OWNER"` → `/restaurants`; else render children |
| `RiderRoute.jsx` | Default | If not authenticated → `/login`; if `user.role !== "RIDER"` → `/restaurants`; else render children |
| `AdminRoute.jsx` | Default | If not authenticated → `/login`; if `user.role !== "ADMIN"` → `/restaurants`; else render children |
| `AppLayout.jsx` | Default + `DEFAULT_NAV`, `OWNER_NAV`, `RIDER_NAV` | Shared layout shell: sticky top header with logo, hamburger menu, back button, desktop nav bar (role-aware), cart icon with item count badge, user dropdown (profile/orders/logout), mobile slide-down menu, fixed mobile bottom nav |

### AppLayout Props

- `children`
- `backTo` / `onBack` — back navigation
- `desktopNavItems` / `bottomNavItems` — navigation arrays
- `showCart` / `showUserDropdown` — visibility toggles
- `extraHeader` — slot for search/filter bars

---

## 3. Frontend Contexts

**Directory**: `client/src/context/`

### AuthContext (`AuthContext.jsx`)

| Export | Type | Description |
|--------|------|-------------|
| `AuthProvider` | Component | Wraps app; manages auth state |
| `useAuth` | Hook | Returns `{ user, token, isAuthenticated, login, logout, updateUser }` |

**Behavior**:
- Token stored in `localStorage` under key `"token"` (plain text JWT)
- User object stored in `localStorage` under key `"user"` (plain text JSON)
- On init: reads token, decodes JWT payload, checks `exp` claim — expired tokens are cleared
- `login(token, user)` → persists both to localStorage + state
- `logout()` → clears both from localStorage + state
- `updateUser(updated)` → merges into state + localStorage

### CartContext (`CartContext.jsx`)

| Export | Type | Description |
|--------|------|-------------|
| `CartProvider` | Component | Wraps app; manages cart state |
| `useCart` | Hook | Returns `{ items, addItem, removeItem, clearItem, clearCart, itemCount, total }` |

**Behavior**:
- Cart items stored in `localStorage` under key `"cart"` (plain text JSON)
- `addItem(menuItem, restaurantId, restaurantName)` → upserts by `menuItemId`, increments quantity if exists
- `removeItem(menuItemId)` → decrements quantity; removes item if quantity reaches 0
- `clearItem(menuItemId)` → removes entirely
- `clearCart()` → empties everything
- Items are grouped by restaurant; mixing restaurants triggers a confirmation

**No shared API client, no `utils/`, no `hooks/` directories exist.** All API calls are inline `fetch()` in page components.

---

## 4. Backend Routes — Complete Endpoint Map

**Base**: Express 5, ES modules. All routes mounted in `server/src/routes/index.js`.

### 4a. Users (`user.routes.js`)

| Method | Path | Middleware | Handler Description |
|--------|------|------------|---------------------|
| GET | `/users` | `authMiddleware` | List all users (`prisma.user.findMany()`, password excluded) |
| POST | `/users` | None | Register: validates name/email/password/role (OWNER/CUSTOMER/RIDER), checks duplicate email, hashes password (bcrypt 10 rounds), creates user, returns JWT |
| POST | `/users/login` | None | Login: validates email+password, finds user, compares bcrypt, returns JWT (1d expiry) |
| GET | `/users/profile` | `authMiddleware` | Get own profile by `req.user.id` |
| PUT | `/users/profile` | `authMiddleware` | Update profile: validates name+email, checks email uniqueness against other users, updates |

**JWT payload**: `{ id, email, role }`

### 4b. Restaurants (`restaurant.routes.js`)

| Method | Path | Middleware | Handler Description |
|--------|------|------------|---------------------|
| GET | `/restaurants` | None | List all restaurants (includes owner name/email) |
| GET | `/restaurants/:id` | None | Get single restaurant (includes owner), 404 if not found |
| GET | `/my-restaurant` | `authMiddleware` | Get current owner's restaurant (`findFirst` by `ownerId`), returns `null` if none |
| POST | `/restaurants` | `authMiddleware`, `ownerMiddleware` | Create restaurant: 1-per-owner limit enforced, validates body fields |
| PUT | `/restaurants/:id` | `authMiddleware`, `ownerMiddleware` | Update restaurant: ownership check (`ownerId !== req.user.id` → 403) |

### 4c. Menu Items (`menu-item.routes.js`)

| Method | Path | Middleware | Handler Description |
|--------|------|------------|---------------------|
| GET | `/restaurants/:id/menu-items` | None | List menu items for a restaurant |
| POST | `/restaurants/:id/menu-items` | `authMiddleware`, `ownerMiddleware` | Create menu item: verifies restaurant exists + requester owns it |
| PUT | `/menu-items/:id` | `authMiddleware`, `ownerMiddleware` | Update menu item: verifies ownership via `menuItem.restaurant.ownerId` |
| DELETE | `/menu-items/:id` | `authMiddleware`, `ownerMiddleware` | Delete menu item: verifies ownership |

### 4d. Orders (`order.routes.js`)

| Method | Path | Middleware | Handler Description |
|--------|------|------------|---------------------|
| POST | `/orders/checkout` | `authMiddleware` | **Checkout**: validates items array + restaurantId + deliveryAddress; verifies restaurant + each menuItem belongs to it; calls `calculateFees()` server-side; creates order (nested `orderItems.create`) + payment record (reference: `CHOW-{timestamp}-{randomHex}`) |
| GET | `/orders` | `authMiddleware` | List current user's orders (by `customerId`), includes orderItems + restaurant, ordered by createdAt desc |
| GET | `/orders/:id` | `authMiddleware` | Get single order with full includes (items, menuItems, restaurant owner, delivery + rider). **3-way auth**: customer, owner of restaurant, or assigned rider |
| GET | `/restaurants/:id/orders` | `authMiddleware` | List orders for a restaurant: manual ownership check |
| PUT | `/orders/:id/status` | `authMiddleware`, `ownerMiddleware` | Update order status: valid values `PENDING_RESTAURANT_CONFIRMATION`, `PREPARING`, `CANCELLED`. Fires SSE `notify("order:updated", [customerId])`. When `PREPARING`: also broadcasts `notify("order:updated", ["*"])` to all riders |

### 4e. Payments (`payment.routes.js`)

| Method | Path | Middleware | Handler Description |
|--------|------|------------|---------------------|
| POST | `/payments/verify` | `authMiddleware` | Verify Paystack payment: validates reference, idempotency check (already SUCCESS = early return), calls Paystack API, compares amount (kobo conversion), uses `prisma.$transaction()` to atomically update payment → SUCCESS and order → `PENDING_RESTAURANT_CONFIRMATION` |

### 4f. Riders (`rider.routes.js`)

| Method | Path | Middleware | Handler Description |
|--------|------|------------|---------------------|
| POST | `/riders/register` | `authMiddleware` | Register rider profile: validates vehicleType + phone; must provide either (licensePlate + licenseNumber) OR matricNumber (not both, not neither); regex format validation; checks `user.role === "RIDER"`; checks duplicate rider profile / licenseNumber / matricNumber |
| GET | `/riders/me` | `authMiddleware`, `riderMiddleware` | Get own rider profile (includes user name/email), 404 if not found |
| PUT | `/riders/me` | `authMiddleware`, `riderMiddleware` | Update rider profile: checks uniqueness of licenseNumber/matricNumber against other riders; supports `isAvailable` toggle; spreads only defined fields |

### 4g. Deliveries (`delivery.routes.js`)

**Delivery State Machine** (`VALID_TRANSITIONS`):
```
ZILLA_ON_IT → AT_KITCHEN | FAILED
AT_KITCHEN  → BAGGED     | FAILED
BAGGED      → MOVING     | FAILED
MOVING      → CLOSE_BY   | FAILED
CLOSE_BY    → DELIVERED  | FAILED
DELIVERED   → (terminal)
FAILED      → (terminal)
```

| Method | Path | Middleware | Handler Description |
|--------|------|------------|---------------------|
| GET | `/riders/available-orders` | `authMiddleware`, `riderMiddleware` | Orders with `status: "PREPARING"` AND `delivery: null` AND not rejected by this rider. Includes items, restaurant, customer. Oldest first |
| POST | `/riders/reject-order/:orderId` | `authMiddleware`, `riderMiddleware` | Reject/skip order: verifies order is PREPARING; uses `prisma.rejectedOrder.upsert()` for idempotency |
| POST | `/deliveries/:orderId/accept` | `authMiddleware`, `riderMiddleware` | Accept order: checks rider `isAvailable` + `isVerified`; `prisma.$transaction()` guards against active delivery / stale FAILED cleanup; creates delivery (ZILLA_ON_IT); updates order → OUT_FOR_DELIVERY; fires SSE `notify("order:accepted", [customerId])` |
| PUT | `/deliveries/:id/status` | `authMiddleware`, `riderMiddleware` | Update delivery status: `prisma.$transaction()` validates state transition; sets `pickedUpAt` (BAGGED) / `deliveredAt` (DELIVERED) / `failureReason` (FAILED); on FAILED: resets order → PREPARING; on DELIVERED: order → DELIVERED; fires SSE `notify("delivery:updated", [customerId])` |
| GET | `/riders/my-deliveries` | `authMiddleware`, `riderMiddleware` | Rider's own deliveries with order/items/restaurant/customer includes |
| GET | `/riders/stats` | `authMiddleware`, `riderMiddleware` | Stats: `totalDeliveries`, `totalEarnings`, `thisWeekDeliveries`, `thisWeekEarnings` (week = Sunday–now) |

### 4h. SSE (`sse.routes.js`)

| Method | Path | Middleware | Handler Description |
|--------|------|------------|---------------------|
| GET | `/events` | Manual JWT (header or `?token=` query param) | SSE event stream: authenticates, sets SSE headers, subscribes to `delivery:updated` / `order:updated` / `order:accepted` bus events, pushes `data: refresh\n\n`, 30s ping keep-alive, cleanup on disconnect |

### 4i. Admin (`admin.routes.js`)

| Method | Path | Middleware | Handler Description |
|--------|------|------------|---------------------|
| POST | `/admin/register` | None (declared before sub-router guard) | Register admin: validates inviteCode against `ADMIN_INVITE_CODE` env var; checks duplicate email; creates user with `role: "ADMIN"`; returns JWT |
| GET | `/admin/riders` | `authMiddleware`, `adminMiddleware` | List all riders with user info + delivery stats (total/completed/failed) |
| PUT | `/admin/riders/:id/verify` | `authMiddleware`, `adminMiddleware` | Toggle rider `isVerified` boolean |
| GET | `/admin/overview` | `authMiddleware`, `adminMiddleware` | Platform stats via `Promise.all`: totalUsers, totalOrders, totalRiders, totalRestaurants, 5 most recent orders |

---

## 5. Backend Middleware

**Directory**: `server/src/middleware/`

| File | Export | Logic |
|------|--------|-------|
| `auth.middleware.js` | `authMiddleware` (default) | Extracts JWT from `Authorization: Bearer <token>`, verifies with `JWT_SECRET`, sets `req.user = { id, email, role }`. Returns 401 on missing/invalid/expired token |
| `admin.middleware.js` | `adminMiddleware` (default) | `req.user.role === "ADMIN"` check. Returns 403 |
| `owner.middleware.js` | `ownerMiddleware` (default) | `req.user.role === "OWNER"` check. Returns 403 |
| `rider.middleware.js` | `riderMiddleware` (default) | `req.user.role === "RIDER"` check. Returns 403 |

**Note**: No global error-handling middleware is configured in `app.js`.

---

## 6. Backend Services

**Directory**: `server/src/services/`

| File | Exports | Description |
|------|---------|-------------|
| `events.js` | `bus` (EventEmitter singleton), `notify(event, userIds)` | Shared event bus for SSE. Max listeners: 200. `notify` emits an event with recipient userIds array (`["*"]` for broadcast) |
| `feecalculator.js` | `calculateFees(items)` | Computes server-side fees from `[{ unitPrice, quantity }]`: `subtotal` (sum), `deliveryFee` (flat 400₦), `serviceFee` (flat 200₦), `tax` (1.5% of subtotal, rounded), `totalAmount` |
| `paystack.js` | `verifyPayment(reference)` | Calls Paystack API `GET /transaction/verify/{reference}` with secret key. Returns `{ verified: boolean, data }`. Verified = `body.status` truthy AND `body.data.status === "success"` |

---

## 7. Database Models

**File**: `server/prisma/schema.prisma`
**Database**: PostgreSQL (Supabase), pooled + direct connections
**Migrations**: 8 migration directories in `server/prisma/migrations/`

### Enums

| Enum | Values |
|------|--------|
| `UserRole` | `CUSTOMER`, `OWNER`, `RIDER`, `ADMIN` |
| `OrderStatus` | `PENDING_PAYMENT`, `PENDING_RESTAURANT_CONFIRMATION`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED` |
| `PaymentStatus` | `PENDING`, `SUCCESS`, `FAILED` |
| `DeliveryStatus` | `ZILLA_ON_IT`, `AT_KITCHEN`, `BAGGED`, `MOVING`, `CLOSE_BY`, `DELIVERED`, `FAILED` |

### Models (9 total)

#### User
| Field | Type | Attributes |
|-------|------|------------|
| `id` | `Int` | `@id @default(autoincrement())` |
| `name` | `String` | |
| `email` | `String` | `@unique` |
| `password` | `String` | |
| `phone` | `String?` | optional |
| `role` | `UserRole` | `@default(CUSTOMER)` |
| `createdAt` | `DateTime` | `@default(now())` |
| `updatedAt` | `DateTime` | `@updatedAt` |

**Relations**: `restaurants Restaurant[]`, `orders Order[]`, `rider Rider?`

#### Rider
| Field | Type | Attributes |
|-------|------|------------|
| `id` | `Int` | `@id @default(autoincrement())` |
| `userId` | `Int` | `@unique` |
| `vehicleType` | `String` | |
| `licensePlate` | `String?` | optional |
| `licenseNumber` | `String?` | `@unique` |
| `matricNumber` | `String?` | `@unique` |
| `phone` | `String` | |
| `isAvailable` | `Boolean` | `@default(true)` |
| `isVerified` | `Boolean` | `@default(false)` |
| `createdAt` | `DateTime` | `@default(now())` |
| `updatedAt` | `DateTime` | `@updatedAt` |

**Relations**: `user User`, `deliveries Delivery[]`, `rejectedOrders RejectedOrder[]`

#### Restaurant
| Field | Type | Attributes |
|-------|------|------------|
| `id` | `Int` | `@id @default(autoincrement())` |
| `name` | `String` | |
| `description` | `String` | |
| `phone` | `String` | |
| `imageUrl` | `String` | |
| `address` | `String` | |
| `ownerId` | `Int` | |
| `createdAt` | `DateTime` | `@default(now())` |
| `updatedAt` | `DateTime` | `@updatedAt` |

**Relations**: `owner User`, `menuItems MenuItem[]`, `orders Order[]`

#### MenuItem
| Field | Type | Attributes |
|-------|------|------------|
| `id` | `Int` | `@id @default(autoincrement())` |
| `name` | `String` | |
| `description` | `String` | |
| `price` | `Decimal` | `@db.Decimal(10,2)` |
| `restaurantId` | `Int` | |
| `category` | `String` | |
| `isAvailable` | `Boolean` | `@default(true)` |
| `imageUrl` | `String` | |
| `createdAt` | `DateTime` | `@default(now())` |
| `updatedAt` | `DateTime` | `@updatedAt` |

**Relations**: `restaurant Restaurant`, `orderItems OrderItem[]`

#### Order
| Field | Type | Attributes |
|-------|------|------------|
| `id` | `Int` | `@id @default(autoincrement())` |
| `status` | `OrderStatus` | `@default(PENDING_PAYMENT)` |
| `subtotal` | `Decimal` | `@default(0) @db.Decimal(10,2)` |
| `deliveryFee` | `Decimal` | `@default(0) @db.Decimal(10,2)` |
| `serviceFee` | `Decimal` | `@default(0) @db.Decimal(10,2)` |
| `tax` | `Decimal` | `@default(0) @db.Decimal(10,2)` |
| `totalAmount` | `Decimal` | `@default(0) @db.Decimal(10,2)` |
| `paidAt` | `DateTime?` | optional |
| `paymentReference` | `String?` | optional |
| `deliveryAddress` | `String` | |
| `customerId` | `Int` | |
| `restaurantId` | `Int` | |
| `createdAt` | `DateTime` | `@default(now())` |
| `updatedAt` | `DateTime` | `@updatedAt` |

**Relations**: `customer User`, `restaurant Restaurant`, `payment Payment?`, `delivery Delivery?`, `orderItems OrderItem[]`, `rejectedBy RejectedOrder[]`

#### Delivery
| Field | Type | Attributes |
|-------|------|------------|
| `id` | `Int` | `@id @default(autoincrement())` |
| `orderId` | `Int` | `@unique` |
| `riderId` | `Int` | |
| `status` | `DeliveryStatus` | `@default(ZILLA_ON_IT)` |
| `pickedUpAt` | `DateTime?` | optional |
| `deliveredAt` | `DateTime?` | optional |
| `failureReason` | `String?` | optional |
| `createdAt` | `DateTime` | `@default(now())` |
| `updatedAt` | `DateTime` | `@updatedAt` |

**Relations**: `order Order`, `rider Rider`

#### RejectedOrder
| Field | Type | Attributes |
|-------|------|------------|
| `id` | `Int` | `@id @default(autoincrement())` |
| `riderId` | `Int` | |
| `orderId` | `Int` | |
| `createdAt` | `DateTime` | `@default(now())` |

**Relations**: `rider Rider`, `order Order`
**Constraints**: `@@unique([riderId, orderId])`

#### OrderItem
| Field | Type | Attributes |
|-------|------|------------|
| `id` | `Int` | `@id @default(autoincrement())` |
| `quantity` | `Int` | |
| `unitPrice` | `Decimal` | `@default(0) @db.Decimal(10,2)` |
| `totalPrice` | `Decimal` | `@default(0) @db.Decimal(10,2)` |
| `orderId` | `Int` | |
| `menuItemId` | `Int` | |
| `createdAt` | `DateTime` | `@default(now())` |
| `updatedAt` | `DateTime` | `@updatedAt` |

**Relations**: `order Order`, `menuItem MenuItem`

#### Payment
| Field | Type | Attributes |
|-------|------|------------|
| `id` | `Int` | `@id @default(autoincrement())` |
| `orderId` | `Int` | `@unique` |
| `provider` | `String` | `@default("PAYSTACK")` |
| `reference` | `String` | `@unique` |
| `amount` | `Decimal` | `@db.Decimal(10,2)` |
| `currency` | `String` | `@default("NGN")` |
| `status` | `PaymentStatus` | `@default(PENDING)` |
| `paidAt` | `DateTime?` | optional |
| `gatewayResponse` | `Json?` | optional |
| `createdAt` | `DateTime` | `@default(now())` |
| `updatedAt` | `DateTime` | `@updatedAt` |

**Relations**: `order Order`

### Entity-Relationship Diagram

```
User    1──N Restaurant      (ownerId)
User    1──N Order           (customerId)
User    1──0..1 Rider        (userId)
Rider   1──N Delivery        (riderId)
Rider   1──N RejectedOrder   (riderId)
Restaurant 1──N MenuItem     (restaurantId)
Restaurant 1──N Order        (restaurantId)
MenuItem 1──N OrderItem      (menuItemId)
Order   1──0..1 Payment      (orderId) [unique]
Order   1──0..1 Delivery     (orderId) [unique]
Order   1──N OrderItem       (orderId)
Order   1──N RejectedOrder   (orderId)
```

### Unique Constraints

| Model | Constraint | Type |
|-------|-----------|------|
| `User` | `email` | Single-column |
| `Rider` | `userId` | Single-column |
| `Rider` | `licenseNumber` | Single-column (nullable) |
| `Rider` | `matricNumber` | Single-column (nullable) |
| `Delivery` | `orderId` | Single-column |
| `RejectedOrder` | `[riderId, orderId]` | Composite |
| `Payment` | `orderId` | Single-column |
| `Payment` | `reference` | Single-column |

### Indexes

**No explicit `@@index` declarations anywhere in the schema.** Foreign key columns (`customerId`, `restaurantId`, `riderId`, `orderId`, `menuItemId`, `ownerId`) have no non-unique indexes — only implicit unique indexes from `@unique` constraints.

### Migration History (8 migrations)

| # | Directory | Key Changes |
|---|-----------|-------------|
| 1 | `20260615225946_init` | `UserRole` enum (CUSTOMER, OWNER), `User` table |
| 2 | `20260709213721_add_restaurant` | `Restaurant` table with FK to User |
| 3 | `20260713144440_add_menu_item` | `MenuItem` table (price as DoublePrecision) |
| 4 | `20260714234611_add_order_models` | `OrderStatus` enum, `Order` + `OrderItem` tables |
| 5 | `20260718191415_add_delivered_status` | Added `DELIVERED` to OrderStatus |
| 6 | `20260718200527_money_to_decimal` | Changed money fields to `Decimal(10,2)` |
| 7 | `20260720170837_payment_shema` | Refactored OrderStatus enum; added `subtotal`/`deliveryFee`/`serviceFee`/`tax`/`totalAmount`; renamed OrderItem fields; created `Payment` table |
| 8 | `20260723172104_add_rider_and_delivery` | Added `RIDER` to UserRole; created `Rider`, `Delivery` tables with `DeliveryStatus` enum (ASSIGNED, PICKED_UP, IN_TRANSIT, DELIVERED, FAILED) |

### Schema Drift

The current `schema.prisma` has diverged from migration #8. These changes were likely applied via `prisma db push`:
- `DeliveryStatus` enum changed from `ASSIGNED/PICKED_UP/IN_TRANSIT/DELIVERED/FAILED` → `ZILLA_ON_IT/AT_KITCHEN/BAGGED/MOVING/CLOSE_BY/DELIVERED/FAILED`
- `UserRole` gained `ADMIN` value
- `Rider.licensePlate` changed from required → optional
- `Rider.licenseNumber` changed from required → optional
- `Rider.matricNumber` field added (optional, unique)
- `Delivery.failureReason` field added
- `RejectedOrder` model added

### Seed Data

**No seed file exists.** No `prisma db seed` configuration in `package.json`. No seed scripts.

---

## 8. localStorage Usage

All values stored in **plain text** (no encryption).

| Key | Read/Write Locations | Purpose |
|-----|----------------------|---------|
| `"token"` | `AuthContext.jsx` (3 reads, 2 writes, 1 remove), `ManageRestaurant.jsx:54` (read), `AdminDashboard.jsx:112,217` (read), `Orders.jsx:26,48` (read), `OrderDetail.jsx:67,89` (read), `RiderDashboard.jsx:105` (read), `Cart.jsx:36` (read) | JWT token |
| `"user"` | `AuthContext.jsx` (2 reads, 2 writes, 1 remove) | User object `{ id, name, email, role, ... }` |
| `"cart"` | `CartContext.jsx` (1 read: init, 1 write: every state change) | Cart items array |

### Token Age Check

`AuthContext.jsx` decodes the JWT on init and checks the `exp` claim. Expired tokens are cleared from localStorage and user is logged out.

---

## 9. Hardcoded / Mock Data

### Fake Ratings (no rating system exists in DB)

| File | Line | Content |
|------|------|---------|
| `client/src/pages/RestaurantList.jsx` | 185 | `<span>star</span>4.5` |
| `client/src/pages/RestaurantDetail.jsx` | 121 | `<span>star</span>4.5` |

### Fake Delivery Times (no delivery time logic exists)

| File | Line | Content |
|------|------|---------|
| `client/src/pages/RestaurantList.jsx` | 177 | `20-30 min` |
| `client/src/pages/RestaurantDetail.jsx` | 123 | `20-30 min` |

### Hardcoded Filter Categories

| File | Line | Content |
|------|------|---------|
| `client/src/pages/RestaurantList.jsx` | 5 | `const FILTERS = ["All", "Pizza", "Burger", "Nigerian", "Drinks"]` |

### Dead UI Elements

| File | Line | Content |
|------|------|---------|
| `client/src/pages/Login.jsx` | 168 | `<a href="#">Forgot Password?</a>` — no password reset flow |
| `client/src/pages/Login.jsx` | 209–224 | Google/Apple social login buttons — no `onClick` handlers |
| `client/src/pages/Signup.jsx` | 352–368 | Same dead Google/Apple buttons |

### Placeholder / Stub Pages

| File | Detail |
|------|--------|
| `client/src/pages/Favorites.jsx` | Entire page is static "No favorites yet" — no favorites functionality exists |
| `client/src/pages/Profile.jsx` | 3 of 4 tabs (Order History, Payment Methods, Favorites) are "coming soon" placeholders |
| `client/src/pages/AdminDashboard.jsx` | 4 of 6 sections (Restaurants, Customers, Orders, Payments) are "Coming Soon" placeholders |
| `client/src/pages/OrderDetail.jsx:42` | Comment: `// Placeholder until maps integration provides real ETAs.` |
| `client/src/pages/RiderDashboard.jsx:29` | Comment: `// Placeholder until GPS/maps integration provides real distance-based ETAs.` |

### Fee Display Bug

| File | Line | Issue |
|------|------|-------|
| `client/src/pages/Cart.jsx` | 201 | Label says "Tax (7.5%)" but **actually calculates 1.5%** (`* 0.015`). Server also uses 1.5% |

### Hardcoded Fee Constants (Client-side, for Display Only)

| File | Line | Values |
|------|------|--------|
| `client/src/pages/Cart.jsx` | 140–143 | `estDelivery = 400`, `estService = 200`, `estTax = Math.round(groupTotal * 0.015)` |

---

## 10. API Calls — Client fetch() Inventory

**Total**: ~35 `fetch()` calls + 3 `EventSource` (SSE) connections across 10 page components.

**Base URL**: `${import.meta.env.VITE_API_URL}` (configured as `https://food-delivery-platform-jux3.onrender.com`)

**Pattern**: All API calls are inline raw `fetch()` with manual `Authorization: Bearer ${token}` headers. No shared API client exists.

### Login / Signup Pages

| Page | Method | Path | Notes |
|------|--------|------|-------|
| `Login.jsx:17` | GET | `/` | Warmup call (result discarded) |
| `Login.jsx:42` | POST | `/users/login` | Sends `{ email, password }` |
| `Signup.jsx:24` | GET | `/` | Warmup call (result discarded) |
| `Signup.jsx:60` | POST | `/users` | Sends `{ name, email, phone, password, role }` |
| `AdminSignup.jsx:51` | POST | `/admin/register` | Sends `{ name, email, password, inviteCode }` |

### Customer Pages

| Page | Method | Path | Notes |
|------|--------|------|-------|
| `RestaurantList.jsx:19` | GET | `/restaurants` | On mount |
| `RestaurantDetail.jsx:21` | GET | `/restaurants/${id}` | On mount |
| `RestaurantDetail.jsx:22` | GET | `/restaurants/${id}/menu-items` | On mount |
| `Cart.jsx:39` | POST | `/orders/checkout` | Sends `{ items, restaurantId, deliveryAddress }` |
| `Cart.jsx:72` | POST | `/payments/verify` | Inside Paystack `onSuccess` callback |
| `Orders.jsx:27` | GET | `/orders` | On mount |
| `Orders.jsx:51` | EventSource | `/events?token=...` | SSE for live updates |
| `Orders.jsx:56` | GET | `/orders` | Re-fetch on SSE refresh event |
| `OrderDetail.jsx:68` | GET | `/orders/${id}` | On mount |
| `OrderDetail.jsx:92` | EventSource | `/events?token=...` | SSE for live updates |
| `OrderDetail.jsx:97` | GET | `/orders/${id}` | Re-fetch on SSE refresh event |
| `Profile.jsx:37` | GET | `/users/profile` | On mount |
| `Profile.jsx:87` | PUT | `/users/profile` | On save |

### Owner Pages (ManageRestaurant / Dashboard)

| Page | Method | Path | Notes |
|------|--------|------|-------|
| `ManageRestaurant.jsx:62` | GET | `/my-restaurant` | On mount |
| `ManageRestaurant.jsx:82` | GET | `/restaurants/${id}/menu-items` | On mount (when restaurant exists) |
| `ManageRestaurant.jsx:93` | GET | `/restaurants/${id}/orders` | On mount |
| `ManageRestaurant.jsx:132` | GET | `/restaurants/${id}/orders` | **Polls every 30s** for new pending orders |
| `ManageRestaurant.jsx:164` | PUT | `/orders/${orderId}/status` | Accept (PENDING_RESTAURANT_CONFIRMATION) |
| `ManageRestaurant.jsx:182` | PUT | `/orders/${orderId}/status` | Decline (CANCELLED) |
| `ManageRestaurant.jsx:201` | PUT | `/orders/${orderId}/status` | Generic status update |
| `ManageRestaurant.jsx:225` | POST | `/restaurants` | Create restaurant |
| `ManageRestaurant.jsx:248` | PUT | `/restaurants/${restaurant.id}` | Update restaurant |
| `ManageRestaurant.jsx:271` | POST | `/restaurants/${id}/menu-items` | Create menu item |
| `ManageRestaurant.jsx:291` | PUT | `/menu-items/${editingItem.id}` | Update menu item |
| `ManageRestaurant.jsx:315` | DELETE | `/menu-items/${itemId}` | Delete menu item |

### Rider Pages

| Page | Method | Path | Notes |
|------|--------|------|-------|
| `RiderDashboard.jsx:110` | GET | `/riders/me` | On mount |
| `RiderDashboard.jsx:136` | GET | `/riders/available-orders` | On mount (parallel) |
| `RiderDashboard.jsx:139` | GET | `/riders/my-deliveries` | On mount (parallel) |
| `RiderDashboard.jsx:142` | GET | `/riders/stats` | On mount (parallel) |
| `RiderDashboard.jsx:200` | POST | `/riders/register` | Register rider profile |
| `RiderDashboard.jsx:226` | POST | `/deliveries/${orderId}/accept` | Accept available order |
| `RiderDashboard.jsx:254` | POST | `/riders/reject-order/${orderId}` | Reject available order |
| `RiderDashboard.jsx:275` | PUT | `/deliveries/${deliveryId}/status` | Advance delivery status |
| `RiderDashboard.jsx:313` | PUT | `/riders/me` | Update availability/profile |
| `RiderDashboard.jsx:357` | EventSource | `/events?token=...` | SSE for live updates |

### Admin Pages

| Page | Method | Path | Notes |
|------|--------|------|-------|
| `AdminDashboard.jsx:113` | GET | `/admin/overview` | On mount |
| `AdminDashboard.jsx:223` | GET | `/admin/riders` | When Riders tab active |
| `AdminDashboard.jsx:241` | PUT | `/admin/riders/${riderId}/verify` | Toggle rider verification |

---

## 11. Obvious Errors & Issues

### 🔴 Critical / Security

1. **`server/.env` contains live secrets committed to the repo**:
   - Supabase PostgreSQL connection URL with embedded username + password
   - Paystack secret key (`sk_test_...`)
   - JWT secret (`mh4rk20`)
   - Admin invite code (`chowzilla-admin-2024`)
   - The file exists despite `.gitignore` listing `.env`

2. **Weak JWT secret**: `"mh4rk20"` — trivially brute-forceable, 7 characters, lowercase + digits only.

3. **JWT tokens in URL query parameters**: SSE connections pass the token as `?token=...` (because `EventSource` cannot set HTTP headers). This makes tokens visible in:
   - Server access logs
   - Browser history
   - Referrer headers (if any external resources are loaded)
   - Network monitoring tools

4. **No rate limiting** on any endpoint — login is vulnerable to brute-force attacks.

5. **No security headers** — no `helmet` middleware; missing CSP, HSTS, X-Frame-Options, etc.

6. **Server returns raw `error.message` to clients** — potential information disclosure (database errors, stack traces).

### 🟡 Bugs

7. **Tax label mismatch**: `Cart.jsx:201` displays "Tax (7.5%)" but the calculation on both client (`* 0.015`) and server (`feecalculator.js:5`) uses 1.5%.

8. **`PaystackPop` is an unchecked global**: `Cart.jsx:64` calls `PaystackPop.setup()` without verifying the Paystack script loaded. If the `<script>` tag in `index.html` fails or is blocked, this throws an unhandled runtime error.

9. **Missing error handling on payment verify**: `Cart.jsx:72` — the `fetch("/payments/verify")` inside `onSuccess` has no `.catch()`. If the verification API fails, the user is still redirected to the order page.

10. **Array indices as React keys** — 5+ locations:
    - `Orders.jsx:195`: `key={idx}` on orderItems
    - `OrderDetail.jsx:490`: `key={idx}` on orderItems
    - `ManageRestaurant.jsx:800`: `key={idx}` on orderItems
    - `ManageRestaurant.jsx:657`: `key={idx}` on menuItems
    - Items can reorder; using indices causes incorrect DOM reuse.

11. **Missing useEffect dependency**: `AdminDashboard.jsx:236` — `useEffect(() => { fetchRiders(); }, [])` is missing `fetchRiders` in the dependency array (exhaustive-deps violation).

12. **`App.css` is unused Vite boilerplate**: 100% dead code.

13. **`hero.png` is never imported**: Unused asset in `client/src/assets/`.

14. **"Forgot Password" dead link**: `Login.jsx:168` — `<a href="#">` goes nowhere.

15. **Dead social login buttons**: Google and Apple buttons on Login and Signup have zero functionality (no `onClick`).

16. **RiderDashboard parallel fetch fragility**: Lines 136–143 use `Promise.all` for 4 fetches — if any one fails, the entire block fails.

### 🟢 Observations / Missing Functionality

17. **No input validation library** (no Joi, Zod, express-validator) — all validation is manual inline checks.
18. **No test framework** configured anywhere in the project.
19. **No logging library** (no Morgan, Winston) — all server logging is raw `console.error()`.
20. **No `.env.example` files** for either client or server.
21. **No seed data** for development or demo purposes.
22. **No non-unique indexes** on foreign key columns — potential query performance issue at scale.
23. **Unused `import React`** in several files (unnecessary with React 19's automatic JSX transform).
24. **Schema drift**: 4+ changes applied via `prisma db push` rather than migrations — the migration history doesn't match the current schema.
25. **`User.phone` vs `Rider.phone`**: Both models have a `phone` field — potential data duplication/divergence.
26. **`Restaurant` model**: No explicit constraint preventing a user from owning multiple restaurants beyond the application-level check.

---

## 12. Dependencies

### Client (`client/package.json`)

| Type | Package | Version |
|------|---------|---------|
| runtime | `react` | `^19.2.6` |
| runtime | `react-dom` | `^19.2.6` |
| runtime | `react-router-dom` | `^7.18.0` |
| dev | `vite` | `^8.0.12` |
| dev | `@vitejs/plugin-react` | `^6.0.1` |
| dev | `tailwindcss` | `^3.4.19` |
| dev | `postcss` | `^8.5.15` |
| dev | `autoprefixer` | `^10.5.0` |
| dev | `eslint` | `^10.3.0` |
| dev | `@eslint/js` | `^10.0.1` |
| dev | `eslint-plugin-react-hooks` | `^7.1.1` |
| dev | `eslint-plugin-react-refresh` | `^0.5.2` |
| dev | `globals` | `^17.6.0` |
| dev | `@types/react` | `^19.2.14` |
| dev | `@types/react-dom` | `^19.2.3` |

**Notable absences**: No Axios, no form library (react-hook-form/formik), no validation library (zod/yup), no state management (Redux/Zustand), no toast/notification library.

### Server (`server/package.json`)

| Type | Package | Version |
|------|---------|---------|
| runtime | `express` | `^5.2.1` |
| runtime | `@prisma/client` | `^6.19.3` |
| runtime | `bcrypt` | `^6.0.0` |
| runtime | `jsonwebtoken` | `^9.0.3` |
| runtime | `cors` | `^2.8.6` |
| runtime | `dotenv` | `^17.4.2` |
| dev | `prisma` | `^6.19.3` |
| dev | `nodemon` | `^3.1.14` |

**Notable absences**: No `helmet` (security headers), no `express-rate-limit`, no `morgan`/`winston` (logging), no `joi`/`zod`/`express-validator` (validation), no test framework, no `cookie-parser`.

---

## 13. Environment Variables

### Client `.env`

```
VITE_API_URL=https://food-delivery-platform-jux3.onrender.com
VITE_PAYSTACK_PUBLIC_KEY=pk_test_ba387919c38e68ce7b87c47f721c4c97c1124bd2
```

### Client `.env.production`

```
VITE_API_URL=https://food-delivery-platform-jux3.onrender.com
```

**Issue**: Missing `VITE_PAYSTACK_PUBLIC_KEY` in production env file.

### Server `.env` ⚠️ CONTAINS LIVE SECRETS

```
PORT=5000
DATABASE_URL=postgresql://postgres.dtqaumjfvgqevbewiahb:<password>@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.dtqaumjfvgqevbewiahb:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
JWT_SECRET=mh4rk20
PAYSTACK_SECRET_KEY=sk_test_bd8a691f972879547cc50a5adde1ec5792f16d43
ADMIN_INVITE_CODE=chowzilla-admin-2024
```

**No `.env.example` files exist in either client or server.**

---

## 14. Server Configuration & Entry Points

### `server/src/server.js` — Entry Point

- Loads `dotenv/config`
- Imports Express app from `./app.js`
- Listens on `process.env.PORT || 5000`
- Logs startup message

### `server/src/app.js` — Express App Setup

**Middleware stack (in order)**:
1. `cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" })`
2. `express.json()`
3. `GET /` — root health/welcome endpoint
4. `indexRoutes` — main router aggregating all sub-routers

**No global error-handling middleware is configured.**

### `server/src/routes/index.js` — Route Aggregator

Mounts sub-routers in registration order:
1. `userRoutes` (user.routes.js)
2. `restaurantRoutes` (restaurant.routes.js)
3. `menuRoutes` (menu-item.routes.js)
4. `orderRoutes` (order.routes.js)
5. `paymentRoutes` (payment.routes.js)
6. `riderRoutes` (rider.routes.js)
7. `deliveryRoutes` (delivery.routes.js)
8. `sseRoutes` (sse.routes.js)
9. `adminRoutes` (admin.routes.js)

Plus inline: `GET /health` → `{ message: "API is Healthy" }`

### `server/src/config/prisma.js` — Prisma Singleton

Exports a single `PrismaClient` instance used by all route files.

---

## 15. Client Directory Structure

```
client/
├── index.html                          # Host page: Google Fonts, Paystack script
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env                                # VITE_API_URL, VITE_PAYSTACK_PUBLIC_KEY
├── .env.production                     # VITE_API_URL only (missing paystack key)
├── vercel.json                         # Vercel deployment config
└── src/
    ├── main.jsx                        # ReactDOM entry point (StrictMode)
    ├── App.jsx                         # BrowserRouter + AuthProvider + CartProvider + Routes
    ├── App.css                         # ⚠️ Unused Vite boilerplate
    ├── index.css                       # Tailwind directives + custom animations (fadeIn, slideIn, fadeUp)
    ├── assets/
    │   ├── auth-bg.jpg                 # Auth page background (Login, Signup)
    │   └── hero.png                    # ⚠️ Unused
    ├── components/
    │   ├── AdminRoute.jsx
    │   ├── AppLayout.jsx               # Main layout shell with nav, cart badge, user dropdown
    │   ├── OwnerRoute.jsx
    │   ├── ProtectedRoute.jsx
    │   └── RiderRoute.jsx
    ├── context/
    │   ├── AuthContext.jsx              # Auth state + localStorage persistence
    │   └── CartContext.jsx              # Cart state + localStorage persistence
    └── pages/
        ├── AdminDashboard.jsx           # Admin: overview, rider verification, 4 "coming soon"
        ├── AdminSignup.jsx              # Admin registration with invite code
        ├── Cart.jsx                     # Cart + Paystack checkout flow
        ├── Favorites.jsx                # ⚠️ Stub — static empty state
        ├── Login.jsx                    # Login form (dead social buttons, dead forgot password)
        ├── ManageRestaurant.jsx         # Owner: restaurant/menu/order management (Dashboard)
        ├── OrderDetail.jsx              # Order timeline + delivery tracker (SSE)
        ├── Orders.jsx                   # Customer order history (SSE)
        ├── Profile.jsx                  # Profile settings (3 of 4 tabs are placeholders)
        ├── RestaurantDetail.jsx         # Restaurant menu + cart controls
        ├── RestaurantList.jsx           # Restaurant browsing + search/filter
        ├── RiderDashboard.jsx           # Rider: registration, orders, delivery, stats (SSE)
        └── Signup.jsx                   # Registration with role selector (dead social buttons)
```

---

## 16. Server Directory Structure

```
server/
├── package.json
├── .env                                # ⚠️ Contains live secrets
├── .gitignore                          # Lists .env but file exists committed
└── src/
    ├── server.js                       # Entry: load dotenv, start server
    ├── app.js                          # Express app: CORS, JSON, routes
    ├── config/
    │   └── prisma.js                   # PrismaClient singleton
    ├── middleware/
    │   ├── auth.middleware.js           # JWT verification → req.user
    │   ├── admin.middleware.js          # Role: ADMIN only
    │   ├── owner.middleware.js          # Role: OWNER only
    │   └── rider.middleware.js          # Role: RIDER only
    ├── routes/
    │   ├── index.js                    # Route aggregator + /health
    │   ├── user.routes.js              # User CRUD + auth
    │   ├── restaurant.routes.js        # Restaurant CRUD
    │   ├── menu-item.routes.js         # Menu item CRUD
    │   ├── order.routes.js             # Checkout + order management
    │   ├── payment.routes.js           # Paystack verification
    │   ├── rider.routes.js             # Rider profile CRUD
    │   ├── delivery.routes.js          # Delivery state machine + rider ops
    │   ├── sse.routes.js               # Server-Sent Events
    │   └── admin.routes.js             # Admin overview + rider verification
    ├── services/
    │   ├── events.js                   # EventEmitter bus for SSE
    │   ├── feecalculator.js            # Server-side fee computation
    │   └── paystack.js                 # Paystack API integration
    └── generated/
        └── prisma/                     # Auto-generated Prisma client
prisma/
    ├── schema.prisma                   # Database schema (9 models, 4 enums)
    ├── migrations/                     # 8 migration directories
    │   ├── 20260615225946_init/
    │   ├── 20260709213721_add_restaurant/
    │   ├── 20260713144440_add_menu_item/
    │   ├── 20260714234611_add_order_models/
    │   ├── 20260718191415_add_delivered_status/
    │   ├── 20260718200527_money_to_decimal/
    │   ├── 20260720170837_payment_shema/
    │   └── 20260723172104_add_rider_and_delivery/
    └── migration_lock.toml
```

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| Frontend pages | 13 |
| Frontend routes | 14 |
| Route guard components | 4 |
| Layout components | 1 |
| React contexts | 2 |
| Backend route files | 9 |
| Backend endpoints | 36 |
| Middleware functions | 4 |
| Service modules | 3 |
| Database models | 9 |
| Database enums | 4 |
| Prisma migrations | 8 |
| Client `fetch()` calls | ~35 |
| SSE connections | 3 |
| localStorage keys | 3 |
| Severity-🔴 issues | 6 |
| Severity-🟡 bugs | 9 |
| Severity-🟢 observations | 10 |
| Unused assets/files | 2 |
| Placeholder/stub pages | 2 pages + 4 admin sections + 3 profile tabs |
