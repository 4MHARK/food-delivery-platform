# PROJECT.md — Project Status & Progress Log

## Project: ChowZilla

A food delivery platform where customers order from restaurants. Built with React + Express + PostgreSQL as a full-stack learning project with real-world shipping standards.

---

## Current State (as of 2026-07-17)

**Phase:** Order API complete. Frontend features next.

---

## ✅ Completed

| Feature | Details |
|---------|---------|
| Backend server | Express 5 on port 5000, CORS enabled, JSON parsing |
| Database setup | PostgreSQL via Prisma, User table with migration |
| User registration | POST /api/users — validates, hashes password with bcrypt, saves user |
| User login API | POST /api/users/login — validates credentials, returns JWT |
| Profile API | GET /api/users/profile — JWT-protected, returns user data |
| JWT middleware | Verifies Bearer token, attaches user to request |
| Health check | GET /api/health |
| Signup page | Full form with validation, API integration, error/loading states, animations, card layout matching login |
| Login page | Form with email/password, validation, styled card, social buttons, "Forgot password" link |
| Profile page | Sidebar nav, tab switching, user summary, Personal Information form with edit/save, calls GET + PUT /api/users/profile |
| Profile update API | PUT /api/users/profile — validated, checks duplicate email, updates user |
| Auth context | AuthContext + useAuth hook — central auth state (user, token, login, logout, updateUser) |
| Protected routes | ProtectedRoute component — redirects to /login if no token |
| Logout | Clears context + localStorage, redirects to /login |
| Material Symbols | Icon font loaded in index.html, used across all pages |
| Page title | Changed from "client" to "ChowZilla" |
| Routing | / → /signup, /signup, /login, /profile (protected) |
| Branding | "ChowZilla" name, amber-500 color scheme, Plus Jakarta Sans font |
| Custom animations | fadeIn, fadeUp, slideIn keyframes in Tailwind |
| Restaurant model | Restaurant table with owner relation, migration applied |
| Restaurant API | GET all, GET by id, POST (auth), PUT with ownership check (auth) |
| MenuItem model | MenuItem table with Restaurant relation, isAvailable default, migration applied |
| MenuItem API | 4 endpoints: POST (auth+ownership), GET all (public), PUT (auth+ownership), DELETE (auth+ownership) |
| Order model | Order + OrderItem tables with OrderStatus enum, price snapshotting |
| Order API | 4 endpoints: POST (auth), GET all (auth), GET/:id (auth), PUT/:id/status (auth+ownership) |
| Owner middleware | Reusable role enforcement — blocks CUSTOMER from owner actions |
| JWT role fix | Added role to JWT payload (was missing, broke ownerMiddleware) |
| Project docs | CLAUDE.md (AI instructions), PROJECT.md (status tracker), README.md (setup guide) |
| End-to-end tests | All endpoints tested via curl (17 tests passed) |

---

## 🟡 In Progress

*None — ready for frontend features.*

---

## ❌ Not Started

| Feature | Priority |
|---------|----------|
| Restaurant listing page (frontend) | 🔴 Next |
| Owner dashboard (frontend) | 🟡 |
| Navigation/navbar component | 🟡 |
| Password visibility toggle | 🟢 |
| 404 page | 🟢 |
| Seed data for development | 🟢 |
| Tests | 🟢 (post-MVP) |

---

## Known Bugs

| Bug | Severity | Status |
|-----|----------|--------|
| GET /api/users is unprotected (returns all user data) | 🟡 Medium | Not fixed |
| App.css contains unused Vite boilerplate | 🟢 Low | Not fixed |
| `console.log(error)` in Login.jsx and Signup.jsx catch blocks | 🟢 Low | Not fixed |

---

## Progress Log

| Date | What was done |
|------|--------------|
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
