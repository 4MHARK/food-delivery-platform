# PROJECT.md — Project Status & Progress Log

## Project: ChowZilla

A food delivery platform where customers order from restaurants. Built with React + Express + PostgreSQL as a full-stack learning project with real-world shipping standards.

---

## Current State (as of 2026-07-18)

**Phase:** Customer flow complete. Owner dashboard + order management complete. Shared layout refactor next.

---

## ✅ Completed

### Backend

| Feature | Details |
|---------|---------|
| Server | Express 5 on port 5000, CORS, JSON parsing |
| Database | PostgreSQL via Prisma, full schema with 5 models |
| User auth | POST /users (signup, now returns JWT), POST /users/login, GET+PUT /users/profile |
| JWT middleware | Verifies Bearer token, attaches user to request |
| Owner middleware | Role enforcement — blocks CUSTOMER from owner actions |
| Restaurant API | Full CRUD: GET all, GET/:id, POST (owner), PUT/:id (owner) |
| MenuItem API | Full CRUD: GET by restaurant, POST (owner), PUT/:id (owner), DELETE/:id (owner) |
| Order API | POST (customer), GET all (customer), GET/:id (customer+owner), PUT/:id/status (owner) |
| Restaurant orders | GET /restaurants/:id/orders — owner views orders for their restaurant |

### Frontend — Customer

| Feature | Details |
|---------|---------|
| Signup | Role selector (Customer/Owner), auto-login after signup, role-based redirect |
| Login | Email/password, JWT stored, role-based redirect (OWNER → /dashboard, CUSTOMER → /restaurants) |
| Restaurant list | Real data, search bar, category filters, skeleton loading, error/empty states, responsive card grid |
| Restaurant detail | Hero image, restaurant info, category-filtered menu, add-to-cart with +/- controls |
| Cart (CartContext) | Shared state persisted to localStorage, survives navigation and refresh |
| Cart page | Items grouped by restaurant, quantity controls, delivery address, place order via POST /orders |
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

---

## 🟡 In Progress

*None.*

---

## ❌ Not Started

| Feature | Priority |
|---------|----------|
| Favorites page (real functionality) | 🟡 |
| Extract shared Layout component (header/nav duplicated 7×) | 🟡 |
| 404 page | 🟢 |
| Seed data for development | 🟢 |
| Rider role + delivery tracking | 🟢 (post-MVP) |
| Real-time order updates (WebSockets) | 🟢 (post-MVP) |
| Image upload instead of URL pasting | 🟢 (post-MVP) |

---

## Known Bugs

| Bug | Severity | Status |
|-----|----------|--------|
| GET /api/users now requires auth (was unprotected) | 🟢 Low | Fixed |
| App.css contains unused Vite boilerplate | 🟢 Low | Not fixed |
| Header + bottom nav duplicated across 7 page components | 🟡 Medium | Not fixed |

---

## Progress Log

| Date | What was done |
|------|--------------|
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
