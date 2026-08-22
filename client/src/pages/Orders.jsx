import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/AppLayout";
import OrderCard, { STATUS } from "../components/OrderCard";
import { api } from "../lib/api";
import { useSSE } from "../hooks/useSSE";
import { useNotificationPermission, notify } from "../hooks/useNotifications";

const Orders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await api.get("/orders");
        setOrders(data.orders);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  // ── SSE: real-time status updates ──
  useNotificationPermission();

  useSSE(async () => {
    try {
      const data = await api.get("/orders");
      const freshOrders = data.orders || [];

      // Which orders changed status? (compare against current state)
      const changed = freshOrders.filter((fresh) => {
        const old = orders.find((o) => o.id === fresh.id);
        return old && old.status !== fresh.status;
      });

      // Notify for each changed order (browser batches notifications)
      for (const order of changed) {
        const label = STATUS[order.status]
          ? STATUS[order.status].label
          : order.status;
        notify("Order Updated", {
          body: `Order #${order.id} is now "${label}"`,
          icon: "/favicon.svg",
        });
      }

      setOrders(freshOrders);
    } catch { /* silent */ }
  });

  const renderContent = () => {
    // LOADING
    if (loading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <div className="flex justify-between">
                <div className="w-32 h-5 bg-slate-200 animate-pulse rounded" />
                <div className="w-20 h-5 bg-slate-200 animate-pulse rounded-full" />
              </div>
              <div className="w-full h-4 bg-slate-200 animate-pulse rounded" />
              <div className="w-1/2 h-4 bg-slate-200 animate-pulse rounded" />
              <div className="flex justify-between pt-2">
                <div className="w-24 h-5 bg-slate-200 animate-pulse rounded" />
                <div className="w-16 h-5 bg-slate-200 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ERROR
    if (error) {
      return (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
          </div>
          <p className="text-slate-900 font-semibold mb-2">Failed to load orders</p>
          <p className="text-slate-500 text-sm mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="text-amber-500 font-semibold text-sm hover:text-amber-600 transition">
            Try again
          </button>
        </div>
      );
    }

    // EMPTY
    if (orders.length === 0) {
      return (
        <div className="text-center py-16">
          <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-5xl text-slate-300">receipt_long</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">No orders yet</h3>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto leading-relaxed">
            You haven&apos;t placed any orders. Start exploring restaurants to find something delicious!
          </p>
          <button
            onClick={() => navigate("/restaurants")}
            className="rounded-full bg-amber-500 text-white font-semibold py-3 px-8 shadow-md hover:bg-amber-600 transition active:scale-95"
          >
            Browse Restaurants
          </button>
        </div>
      );
    }

    // SUCCESS
    return (
      <div className="space-y-4">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    );
  };

  return (
    <AppLayout showUserDropdown={false}>
      <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-8 pb-24 md:pb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Order History</h2>
        <p className="text-slate-500 text-sm mb-8">
          {!loading && orders.length > 0
            ? `${orders.length} ${orders.length === 1 ? "order" : "orders"}`
            : ""}
        </p>
        {renderContent()}
      </div>
    </AppLayout>
  );
};

export default Orders;
