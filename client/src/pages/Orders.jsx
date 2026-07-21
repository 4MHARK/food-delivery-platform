import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/AppLayout";

const STATUS = {
  PENDING: { label: "Pending", color: "bg-amber-100 text-amber-700", icon: "hourglass_empty" },
  CONFIRMED: { label: "Confirmed", color: "bg-blue-100 text-blue-700", icon: "check_circle" },
  PREPARING: { label: "Preparing", color: "bg-orange-100 text-orange-700", icon: "cooking" },
  READY: { label: "Ready", color: "bg-emerald-100 text-emerald-700", icon: "inventory" },
  DELIVERING: { label: "Delivering", color: "bg-purple-100 text-purple-700", icon: "local_shipping" },
  DELIVERED: { label: "Delivered", color: "bg-green-100 text-green-700", icon: "done_all" },
  CANCELLED: { label: "Cancelled", color: "bg-slate-100 text-slate-500", icon: "cancel" },
};

const Orders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${import.meta.env.VITE_API_URL}/orders`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message || "Failed to load orders"); return; }
        setOrders(data.orders);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

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
        {orders.map((order) => {
          const status = STATUS[order.status] || STATUS.PENDING;
          return (
            <article
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition cursor-pointer"
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-amber-500">storefront</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{order.restaurant?.name || "Restaurant"}</h3>
                    <p className="text-xs text-slate-400">{formatDate(order.createdAt)} · {formatTime(order.createdAt)}</p>
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-full ${status.color}`}>
                  <span className="material-symbols-outlined text-sm">{status.icon}</span>
                  {status.label}
                </span>
              </div>

              <div className="border-t border-slate-50 px-5 py-3 space-y-1.5">
                {order.orderItems?.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">
                      {item.quantity}× {item.menuItem?.name || `Item #${item.menuItemId}`}
                    </span>
                    <span className="text-slate-400 text-xs">₦{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-50 px-5 py-3 flex items-center justify-between bg-slate-50/30">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  <span className="truncate max-w-[180px]">{order.deliveryAddress}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">₦{Number(order.total).toLocaleString()}</span>
              </div>
            </article>
          );
        })}
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
