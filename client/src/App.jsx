import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import Login from "./pages/Login";

// Route-level chunks. Login stays eager (it is the pre-auth entry point);
// everything else — including Leaflet and the three dashboards — loads only
// when its route is visited.
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const RestaurantList = lazy(() => import("./pages/RestaurantList"));
const Orders = lazy(() => import("./pages/Orders"));
const Favorites = lazy(() => import("./pages/Favorites"));
const RestaurantDetail = lazy(() => import("./pages/RestaurantDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const Dashboard = lazy(() => import("./pages/ManageRestaurant"));
const RiderDashboard = lazy(() => import("./pages/RiderDashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSignup = lazy(() => import("./pages/AdminSignup"));
import ProtectedRoute from "./components/ProtectedRoute";
import OwnerRoute from "./components/OwnerRoute";
import RiderRoute from "./components/RiderRoute";
import AdminRoute from "./components/AdminRoute";
import PushRegistrar from "./components/PushRegistrar";
import PwaPrompts from "./components/PwaPrompts";
import ServiceWorkerManager from "./components/ServiceWorkerManager";
import { isServiceWorkerAllowed } from "./lib/pwa";

// Evaluated once at module scope, so it never changes between renders. The
// check has to happen at the parent render site rather than inside the
// component: useRegisterSW is a hook and can't be called conditionally.
const SERVICE_WORKER_ALLOWED = isServiceWorkerAllowed();

function HomeRedirect() {
  const { user, isAuthenticated } = useAuth();

  // Not logged in — show login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in — route by role
  const dest =
    user?.role === "ADMIN" || user?.role === "SUPER_ADMIN" ? "/admin"
    : user?.role === "OWNER" ? "/dashboard"
    : user?.role === "RIDER" ? "/rider"
    : "/restaurants";
  return <Navigate to={dest} replace />;
}

function App() {
  return (
    <BrowserRouter>
      {/* Outside AuthProvider on purpose: the offline shell has to work before
          login, and the update banner shouldn't depend on auth state. */}
      {SERVICE_WORKER_ALLOWED && <ServiceWorkerManager />}
      <AuthProvider>
        <PushRegistrar />
        <PwaPrompts />
        <CartProvider>
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center">
                <span
                  role="status"
                  aria-label="Loading"
                  className="material-symbols-outlined animate-spin text-4xl text-amber-600"
                >
                  progress_activity
                </span>
              </div>
            }
          >
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/register" element={<AdminSignup />} />
            <Route path="/restaurants" element={<RestaurantList />} />
            <Route path="/restaurants/:id" element={<RestaurantDetail />} />
            <Route
              path="/cart"
              element={
                <ProtectedRoute>
                  <Cart />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <OwnerRoute>
                  <Dashboard />
                </OwnerRoute>
              }
            />
            <Route
              path="/rider"
              element={
                <RiderRoute>
                  <RiderDashboard />
                </RiderRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <OrderDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/favorites"
              element={
                <ProtectedRoute>
                  <Favorites />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
          </Routes>
          </Suspense>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
