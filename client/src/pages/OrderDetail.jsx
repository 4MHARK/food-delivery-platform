import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/AppLayout";

const STATUS_FLOW = [
  { key: "PENDING_PAYMENT", label: "Placed", icon: "receipt" },
  { key: "PENDING_RESTAURANT_CONFIRMATION", label: "Confirmed", icon: "check_circle" },
  { key: "PREPARING", label: "Preparing", icon: "cooking" },
  { key: "OUT_FOR_DELIVERY", label: "On the way", icon: "local_shipping" },
  { key: "DELIVERED", label: "Delivered", icon: "done_all" },
];

const STATUS_COLORS = {
  PENDING_PAYMENT: "border-amber-500 text-amber-700 bg-amber-50",
  PENDING_RESTAURANT_CONFIRMATION: "border-blue-500 text-blue-700 bg-blue-50",
  PREPARING: "border-orange-500 text-orange-700 bg-orange-50",
  OUT_FOR_DELIVERY: "border-purple-500 text-purple-700 bg-purple-50",
  DELIVERED: "border-green-600 text-green-700 bg-green-50",
  CANCELLED: "border-red-400 text-red-600 bg-red-50",
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${import.meta.env.VITE_API_URL}/orders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) { setError(data.message || "Order not found"); return; }
        setOrder(data.order);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  const getStepState = (stepKey) => {
    if (!order) return "upcoming";
    if (order.status === "CANCELLED") return "cancelled";
    const currentIdx = STATUS_FLOW.findIndex((s) => s.key === order.status);
    const stepIdx = STATUS_FLOW.findIndex((s) => s.key === stepKey);
    if (stepIdx < currentIdx) return "completed";
    if (stepIdx === currentIdx) return "current";
    return "upcoming";
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  // ── LOADING ──
  if (loading) {
    return (
      <AppLayout backTo="/orders" showUserDropdown={false}>
        <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-8 pb-24">
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <div className="w-40 h-6 bg-slate-200 animate-pulse rounded" />
            <div className="flex gap-4 overflow-hidden">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="w-12 h-12 rounded-full bg-slate-200 animate-pulse shrink-0" />
              ))}
            </div>
            <div className="w-full h-32 bg-slate-200 animate-pulse rounded-xl" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-full h-10 bg-slate-200 animate-pulse rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── ERROR ──
  if (error) {
    return (
      <AppLayout backTo="/orders" showUserDropdown={false}>
        <div className="flex items-center justify-center px-4 pt-20">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              {error === "Order not found" ? "Order not found" : "Something went wrong"}
            </h2>
            <p className="text-slate-500 mb-6">{error}</p>
            <button
              onClick={() => navigate("/orders")}
              className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white hover:bg-amber-600 transition active:scale-95"
            >
              Back to Order History
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── SUCCESS ──
  const isCancelled = order.status === "CANCELLED";
  const isDelivered = order.status === "DELIVERED";
  const statusColor = STATUS_COLORS[order.status] || STATUS_COLORS.PENDING_PAYMENT;

  return (
    <AppLayout backTo="/orders" showUserDropdown={false}>
      <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-8 pb-24 md:pb-8">
        {/* Order ID + Status */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Order #{order.id}</p>
            <p className="text-sm text-slate-500 mt-0.5">
              {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border ${statusColor}`}>
            <span className="material-symbols-outlined text-sm">
              {isCancelled ? "cancel" : isDelivered ? "done_all" : "receipt"}
            </span>
            {order.status.charAt(0) + order.status.slice(1).toLowerCase()}
          </span>
        </div>

        {/* Status Timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-6">Order Progress</h3>

            {/* Desktop timeline */}
            <div className="hidden sm:flex items-start justify-between">
              {STATUS_FLOW.map((step, idx) => {
                const state = getStepState(step.key);
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1 relative">
                    {idx > 0 && (
                      <div className="absolute right-1/2 top-4 w-full h-0.5 -translate-y-1/2">
                        <div className={`h-full transition-colors ${state === "completed" ? "bg-amber-500" : "bg-slate-200"}`} />
                      </div>
                    )}
                    <div
                      className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition ${
                        state === "completed" ? "bg-amber-500 text-white"
                        : state === "current" ? "bg-white border-2 border-amber-500 text-amber-500"
                        : "bg-slate-100 text-slate-300"
                      }`}
                    >
                      {state === "completed" ? (
                        <span className="material-symbols-outlined text-sm font-bold">check</span>
                      ) : (
                        <span className="material-symbols-outlined text-sm">{step.icon}</span>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold mt-2 text-center leading-tight transition ${
                      state === "completed" ? "text-amber-600" : state === "current" ? "text-slate-900" : "text-slate-400"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile timeline (vertical) */}
            <div className="sm:hidden space-y-0">
              {STATUS_FLOW.map((step, idx) => {
                const state = getStepState(step.key);
                const isLast = idx === STATUS_FLOW.length - 1;
                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition ${
                        state === "completed" ? "bg-amber-500 text-white"
                        : state === "current" ? "bg-white border-2 border-amber-500 text-amber-500"
                        : "bg-slate-100 text-slate-300"
                      }`}>
                        {state === "completed" ? (
                          <span className="material-symbols-outlined text-sm font-bold">check</span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">{step.icon}</span>
                        )}
                      </div>
                      {!isLast && <div className={`w-0.5 h-6 transition ${state === "completed" ? "bg-amber-500" : "bg-slate-200"}`} />}
                    </div>
                    <span className={`text-xs font-semibold pt-1.5 transition ${
                      state === "completed" ? "text-amber-600" : state === "current" ? "text-slate-900" : "text-slate-400"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancelled notice */}
        {isCancelled && (
          <div className="bg-red-50 rounded-2xl p-6 mb-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl text-red-400">cancel</span>
            </div>
            <h3 className="text-lg font-bold text-red-700 mb-1">Order Cancelled</h3>
            <p className="text-sm text-red-500">This order has been cancelled and is no longer active.</p>
          </div>
        )}

        {/* Restaurant Card */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <button
            onClick={() => navigate(`/restaurants/${order.restaurant.id}`)}
            className="flex items-center gap-3 hover:opacity-80 transition w-full text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-amber-600 text-xl">storefront</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{order.restaurant.name}</h3>
              <p className="text-xs text-slate-400">Tap to view restaurant</p>
            </div>
            <span className="material-symbols-outlined text-slate-300 text-sm ml-auto">chevron_right</span>
          </button>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">
              {order.orderItems.length} {order.orderItems.length === 1 ? "Item" : "Items"}
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {order.orderItems.map((item, idx) => (
              <div key={idx} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    {item.menuItem?.imageUrl ? (
                      <img src={item.menuItem.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="material-symbols-outlined text-slate-400 text-sm">restaurant</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.menuItem?.name || `Item #${item.menuItemId}`}</p>
                    <p className="text-xs text-slate-400">₦{Number(item.unitPrice).toLocaleString()} × {item.quantity}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900">₦{(Number(item.unitPrice) * item.quantity).toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 px-5 py-4 space-y-2 bg-slate-50/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-700 font-medium">₦{Number(order.subtotal).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Delivery Fee</span>
              <span className="text-slate-700 font-medium">₦{Number(order.deliveryFee).toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Service Fee</span>
              <span className="text-slate-700 font-medium">₦{Number(order.serviceFee).toLocaleString()}</span>
            </div>
            {/* <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Tax</span>
              <span className="text-slate-700 font-medium">₦{Number(order.tax).toLocaleString()}</span>
            </div> */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-lg font-extrabold text-slate-900">₦{Number(order.totalAmount).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-amber-500">location_on</span>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Delivery Address</p>
              <p className="text-sm font-medium text-slate-900 leading-relaxed">{order.deliveryAddress}</p>
            </div>
          </div>
        </div>

        {/* Order Info */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-slate-400">info</span>
            </div>
            <div className="space-y-1 text-sm">
              <p className="text-slate-500">
                <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Order ID </span>
                <span className="text-slate-700 font-medium">#{order.id}</span>
              </p>
              <p className="text-slate-500">
                <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Placed </span>
                <span className="text-slate-700 font-medium">{formatDate(order.createdAt)} at {formatTime(order.createdAt)}</span>
              </p>
              {order.updatedAt !== order.createdAt && (
                <p className="text-slate-500">
                  <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Last updated </span>
                  <span className="text-slate-700 font-medium">{formatDate(order.updatedAt)} at {formatTime(order.updatedAt)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default OrderDetail;
