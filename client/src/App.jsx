import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import RestaurantList from "./pages/RestaurantList";
import Orders from "./pages/Orders";
import Favorites from "./pages/Favorites";
import RestaurantDetail from "./pages/RestaurantDetail";
import Cart from "./pages/Cart";
import OrderDetail from "./pages/OrderDetail";
import Dashboard from "./pages/ManageRestaurant";
import RiderDashboard from "./pages/RiderDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminSignup from "./pages/AdminSignup";
import ProtectedRoute from "./components/ProtectedRoute";
import OwnerRoute from "./components/OwnerRoute";
import RiderRoute from "./components/RiderRoute";
import AdminRoute from "./components/AdminRoute";
import PushRegistrar from "./components/PushRegistrar";
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
        <CartProvider>
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
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
