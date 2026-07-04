# ChowZilla — Food Delivery Platform

A full-stack food delivery web application where customers can browse restaurants, place orders, and track deliveries. Built as a full-stack learning project with production-minded standards.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, Tailwind CSS 3.4 |
| Routing | React Router DOM 7 |
| Backend | Node.js, Express 5 |
| ORM | Prisma 6.19 |
| Database | PostgreSQL |
| Auth | bcrypt + JWT (jsonwebtoken) |
| Icons | Google Material Symbols |

## Features

- User registration and login with JWT authentication
- Protected profile page with edit/save capabilities
- Responsive design with sidebar navigation
- Auth context for global state management
- Client-side protected routes

## Project Structure

```
food-delivery-platform/
├── client/                # React frontend (Vite dev server on :5173)
│   ├── src/
│   │   ├── App.jsx        # BrowserRouter + all routes
│   │   ├── main.jsx       # Entry point
│   │   ├── index.css      # Tailwind directives + custom animations
│   │   ├── assets/        # Images (auth-bg.jpg, hero.png)
│   │   ├── components/    # Reusable components (ProtectedRoute)
│   │   ├── context/       # React context (AuthContext)
│   │   └── pages/         # Page components (Signup, Login, Profile)
│   └── .env               # VITE_API_URL=http://localhost:5000
└── server/                # Express API (on :5000)
    ├── src/
    │   ├── server.js      # Entry: loads dotenv, starts server
    │   ├── app.js         # Express app setup (CORS, JSON, routes)
    │   ├── config/        # Prisma client singleton
    │   ├── middleware/     # Auth middleware (JWT verification)
    │   └── routes/        # API routes (users, health)
    ├── prisma/
    │   ├── schema.prisma  # Database schema
    │   └── migrations/    # Migration history
    └── .env               # PORT, DATABASE_URL, JWT_SECRET
```

## Getting Started

### Prerequisites

- Node.js (v18 or later)
- PostgreSQL (running locally on port 5432)

### Setup

**1. Clone the repository**

```bash
git clone https://github.com/4MHARK/food-delivery-platform.git
cd food-delivery-platform
```

**2. Set up the backend**

```bash
cd server
npm install
```

Create a `server/.env` file:
```
PORT=5000
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/food_delivery_db?schema=public"
JWT_SECRET=your-secret-key
```

Run the database migration:
```bash
npx prisma migrate dev
```

Start the server:
```bash
npm run dev
# → http://localhost:5000
```

**3. Set up the frontend**

```bash
cd client
npm install
```

Create a `client/.env` file (or use the existing one):
```
VITE_API_URL=http://localhost:5000
```

Start the dev server:
```bash
npm run dev
# → http://localhost:5173
```

## API Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/health` | No | Health check |
| POST | `/api/users` | No | Register new user |
| POST | `/api/users/login` | No | Login, returns JWT |
| GET | `/api/users/profile` | Yes | Get user profile |
| PUT | `/api/users/profile` | Yes | Update user profile |

## Scripts

```bash
# Backend
cd server
npm run dev          # Start with nodemon (auto-restart)

# Frontend
cd client
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run preview      # Preview production build
```

## License

This project is built for learning purposes.
