# PROJECT.md — Project Status & Progress Log

## Project: ChowZilla

A food delivery platform where customers order from restaurants. Built with React + Express + PostgreSQL as a full-stack learning project with real-world shipping standards.

---

## Current State (as of 2026-07-04)

**Phase:** Auth system — login and profile pages in progress.

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
| Signup page | Full form with validation, API integration, error/loading states, animations, responsive two-column layout |
| Routing | React Router: / → /signup, /signup, /login, /profile |
| Branding | "ChowZilla" name, amber-500 color scheme, Plus Jakarta Sans font |
| Custom animations | fadeIn, fadeUp, slideIn keyframes in Tailwind |

---

## 🟡 In Progress

| Feature | Status |
|---------|--------|
| Login page | Started — has layout, form, but missing state declarations, broken event handler, no API call, no token storage |
| CLAUDE.md | Created (this file's companion) |

---

## ❌ Not Started

| Feature | Priority |
|---------|----------|
| Auth state management (token storage, user context) | 🔴 Next after login |
| Profile page implementation | 🔴 After auth state |
| Protected routes (client-side auth guard) | 🔴 After auth state |
| Logout functionality | 🟡 |
| Navigation/navbar component | 🟡 |
| Restaurant model & CRUD | 🟡 |
| Menu item model | 🟡 |
| Order model & flow | 🟡 |
| Password visibility toggle | 🟢 |
| 404 page | 🟢 |
| Form field-level validation messages | 🟢 |
| Seed data for development | 🟢 |
| Tests | 🟢 (post-MVP) |

---

## Known Bugs

| Bug | Severity | Status |
|-----|----------|--------|
| JWT_SECRET has leading space in server/.env | 🔴 High | Not fixed |
| Login.jsx: `e.prevent.default()` instead of `e.preventDefault()` | 🔴 High | In progress |
| Login.jsx: `SetError` instead of `setError` (case sensitivity) | 🔴 High | In progress |
| Login.jsx: Missing `useState` declarations for formData, error, loading | 🔴 High | In progress |
| Login.jsx: `"All feilds are required!"` typo | 🟡 Low | In progress |
| Login.jsx: Missing `navigate` for redirect after login | 🟡 Medium | In progress |
| GET /api/users is unprotected (returns all user data) | 🟡 Medium | Not fixed |
| App.css contains unused Vite boilerplate | 🟢 Low | Not fixed |
| HTML <title> still says "client" | 🟢 Low | Not fixed |

---

## Progress Log

| Date | What was done |
|------|--------------|
| 2026-07-04 | Full codebase review completed. Created CLAUDE.md and PROJECT.md. About to begin Login page build. |
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
