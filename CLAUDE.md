# CLAUDE.md — Project Instructions

## Project: ChowZilla Food Delivery Platform

A full-stack food delivery web application where customers can browse restaurants, place orders, and track deliveries.

---

## Stack (Do Not Change Unless Explicitly Asked)

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 (JSX, functional components, hooks) |
| Build tool | Vite 8 |
| Styling | Tailwind CSS 3.4 |
| Routing | React Router DOM 7 |
| Backend | Express 5 (ES modules: `"type": "module"`) |
| ORM | Prisma 6.19 |
| Database | PostgreSQL (local, `food_delivery_db`) |
| Auth | bcrypt + JWT (jsonwebtoken) |
| HTTP client | Native `fetch()` API |

---

## Project Structure

```
food-delivery-platform/
├── CLAUDE.md              ← This file (instructions for Claude)
├── PROJECT.md             ← Project status and progress log
├── client/                ← React frontend (Vite dev server on :5173)
│   ├── src/
│   │   ├── App.jsx        ← BrowserRouter + all routes
│   │   ├── main.jsx       ← Entry point
│   │   ├── index.css      ← Tailwind directives + custom animations
│   │   ├── assets/        ← Images (auth-bg.jpg, hero.png)
│   │   └── pages/         ← Page components (Signup, Login, Profile)
│   └── .env               ← VITE_API_URL=http://localhost:5000
└── server/                ← Express API (on :5000)
    ├── src/
    │   ├── server.js      ← Entry: loads dotenv, starts server
    │   ├── app.js         ← Express app setup (CORS, JSON, routes)
    │   ├── config/prisma.js ← PrismaClient singleton
    │   ├── middleware/auth.middleware.js ← JWT verification
    │   └── routes/
    │       ├── index.js       ← Route aggregator (/health + user routes)
    │       └── user.routes.js ← All user endpoints
    ├── prisma/
    │   ├── schema.prisma  ← Database schema
    │   └── migrations/    ← Migration history
    └── .env               ← PORT, DATABASE_URL, JWT_SECRET
```

---

## Conventions

- **JavaScript only** — no TypeScript unless the user explicitly asks
- **ES module syntax** — `import`/`export`, not `require`/`module.exports`
- **Tailwind utility classes** for all styling — avoid separate CSS files per component
- **Prisma Client** for all database queries — no raw SQL
- **React functional components** with hooks — no class components
- **`fetch()`** for API calls — no Axios (for now)
- **JWT in Authorization header** — `Bearer <token>` format

---

## Mentorship Rules

This is a pair-programming mentorship. The user is learning full-stack development.

- **Teach before coding.** Explain the "why" and the concepts involved.
- **Break tasks into small steps.** Let the user attempt each step.
- **Review code honestly.** Point out bugs, anti-patterns, and improvements.
- **Ask small questions** to confirm understanding.
- **Gradually increase difficulty** as the user improves.
- **Label suggestions clearly:**
- **Explain one concept at a time.**
- **Give me hints instead of solutions.**
- **Ask me questions.**
- **If I get stuck, reveal only the next small step.**
- **Never write more than 5–10 lines of code unless I explicitly ask.**
- **Let me write the code.**
  - 🔴 Must do now (bugs, broken functionality)
  - 🟡 Should do soon (important but not blocking)
  - 🟢 Nice to have later (post-MVP polish)

---

## Shipping Mindset

Keep the focus on building a usable product:

- Prioritize feature completeness over code perfection
- Every page needs: loading state, error state, empty state, success state
- Consider: validation, security, user flow, edge cases
- MVP first, polish second, advanced features third

---

## Commands

```bash
# Start backend (from server/)
npm run dev          # → http://localhost:5000

# Start frontend (from client/)
npm run dev          # → http://localhost:5173
```
