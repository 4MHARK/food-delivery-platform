import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/AppLayout";
import { api } from "../lib/api";
import { useSSE } from "../hooks/useSSE";
import { useNotificationPermission, notify } from "../hooks/useNotifications";
import { formatCurrency } from "../lib/format";

const STATUS_FLOW = [
  { key: "PENDING_PAYMENT", label: "Placed", icon: "receipt" },
  { key: "PENDING_RESTAURANT_CONFIRMATION", label: "Confirmed", icon: "check_circle" },
  { key: "ACCEPTED", label: "Accepted", icon: "task_alt" },
  { key: "PREPARING", label: "Preparing", icon: "cooking" },
  { key: "READY_FOR_PICKUP", label: "Ready for pickup", icon: "inventory_2" },
  { key: "OUT_FOR_DELIVERY", label: "On the way", icon: "local_shipping" },
  { key: "DELIVERED", label: "Delivered", icon: "done_all" },
];

const STATUS_COLORS = {
  PENDING_PAYMENT: "border-amber-500 text-amber-700 bg-amber-50",
  PENDING_RESTAURANT_CONFIRMATION: "border-blue-500 text-blue-700 bg-blue-50",
  ACCEPTED: "border-teal-500 text-teal-700 bg-teal-50",
  PREPARING: "border-orange-500 text-orange-700 bg-orange-50",
  READY_FOR_PICKUP: "border-indigo-500 text-indigo-700 bg-indigo-50",
  OUT_FOR_DELIVERY: "border-purple-500 text-purple-700 bg-purple-50",
  DELIVERED: "border-green-600 text-green-700 bg-green-50",
  CANCELLED: "border-red-400 text-red-600 bg-red-50",
};

const DELIVERY_STEPS = [
  { key: "ZILLA_ON_IT", label: "Zilla On It", icon: "assignment_ind" },
  { key: "AT_KITCHEN", label: "At Kitchen", icon: "storefront" },
  { key: "BAGGED", label: "Bagged", icon: "shopping_bag" },
  { key: "MOVING", label: "Moving", icon: "local_shipping" },
  { key: "CLOSE_BY", label: "Close By", icon: "near_me" },
  { key: "DELIVERED", label: "Delivered", icon: "done_all" },
];

// Estimated delivery time in minutes. Scaled down as rider progresses.
// Placeholder until maps integration provides real ETAs.
const CUSTOMER_ETA_RANGE = [5, 25];
const DELIVERY_STEP_COUNT = DELIVERY_STEPS.length - 1; // exclude FAILED

function estimateCustomerETA(deliveryStatus) {
  const currentIdx = DELIVERY_STEPS.findIndex((s) => s.key === deliveryStatus);
  const factor = Math.max(0, 1 - currentIdx / Math.max(1, DELIVERY_STEP_COUNT));
  const [low, high] = CUSTOMER_ETA_RANGE;
  return [
    Math.max(1, Math.round(low * factor)),
    Math.max(2, Math.round(high * factor)),
  ];
}

function formatCountdown(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function RateRider({ riderId, riderName }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) { setMsg({ type: "error", text: "Please choose a star rating." }); return; }
    setSubmitting(true);
    setMsg(null);
    try {
      await api.post(`/riders/${riderId}/reviews`, { rating, comment: comment.trim() || undefined });
      setMsg({ type: "success", text: `Thanks for rating ${riderName}!` });
      setRating(0);
      setComment("");
    } catch (e) {
      setMsg({ type: "error", text: e.message || "Could not submit review." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
      <h3 className="text-sm font-bold text-slate-900 mb-1">Rate your rider</h3>
      <p className="text-xs text-slate-500 mb-4">How was your delivery with {riderName}?</p>
      <form onSubmit={submit}>
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className="transition active:scale-90"
            >
              <span className={`material-symbols-outlined text-2xl ${(hover || rating) >= n ? "text-amber-500 filled-icon" : "text-slate-300"}`}>star</span>
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us how it went (optional)"
          rows={2}
          maxLength={500}
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm resize-none mb-4"
        />
        {msg && (
          <p className={`mb-4 text-sm font-medium ${msg.type === "error" ? "text-red-600" : "text-green-600"}`}>{msg.text}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-bold px-6 py-2.5 rounded-full transition active:scale-95"
        >
          {submitting ? "Submitting..." : "Submit Rating"}
        </button>
      </form>
    </div>
  );
}

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const data = await api.get(`/orders/${id}`);
        setOrder(data.order);
      } catch (e) {
        setError(e.message || "Order not found");
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  // Tick every second while the order is still cancellable so the refund
  // countdown stays live for the customer.
  useEffect(() => {
    if (order?.status !== "PENDING_RESTAURANT_CONFIRMATION") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [order?.status]);

  // ── SSE: real-time status updates ──
  useNotificationPermission();

  useSSE(async () => {
    try {
      const data = await api.get(`/orders/${id}`);
      const fresh = data.order;

      if (!order) {
        setOrder(fresh);
        return;
      }

      const orderStatusChanged = fresh.status !== order.status;
      const deliveryStatusChanged =
        fresh.delivery?.status !== order.delivery?.status;

      if (!orderStatusChanged && !deliveryStatusChanged) return;

      if (orderStatusChanged) {
        const label = fresh.status.replace(/_/g, " ").toLowerCase();
        notify("Order Updated", {
          body: `Order #${fresh.id} is now ${label}`,
          icon: "/favicon.svg",
        });
      } else if (deliveryStatusChanged) {
        const step = DELIVERY_STEPS.find((s) => s.key === fresh.delivery?.status);
        notify("Delivery Update", {
          body: `Your rider: "${step?.label || "Status updated"}"`,
          icon: "/favicon.svg",
        });
      }

      setOrder(fresh);
    } catch { /* silent */ }
  }, { deps: [id] });

  const getStepState = (stepKey) => {
    if (!order) return "upcoming";
    if (order.status === "CANCELLED") return "cancelled";

    // "On the way" spans the whole delivery. It only ticks once the rider is
    // actually MOVING (or closer); before that they're still picking up the food.
    if (stepKey === "OUT_FOR_DELIVERY") {
      if (order.status === "DELIVERED") return "completed";
      if (order.status === "OUT_FOR_DELIVERY") {
        return ["MOVING", "CLOSE_BY", "DELIVERED"].includes(order.delivery?.status)
          ? "completed"
          : "current";
      }
      return "upcoming";
    }

    const currentIdx = STATUS_FLOW.findIndex((s) => s.key === order.status);
    const stepIdx = STATUS_FLOW.findIndex((s) => s.key === stepKey);
    if (stepIdx < currentIdx) return "completed";
    // The final "Delivered" step should render as checked (completed), not just
    // highlighted, so the tracker ends fully checked once the order is delivered.
    if (stepIdx === currentIdx) return order.status === "DELIVERED" ? "completed" : "current";
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

  // ── Cancel order (customer) — full refund only inside the free-cancel window ──
  const refundDeadlineMs = order?.refundDeadline ? new Date(order.refundDeadline).getTime() : null;

  const handleCancel = async () => {
    const within = refundDeadlineMs != null && Date.now() < refundDeadlineMs;
    const msg =
      order.status === "PENDING_PAYMENT"
        ? "Cancel this order?"
        : within
        ? "Cancel this order? You'll receive a full refund."
        : "The free-cancellation window has passed — you will NOT be refunded. Cancel anyway?";
    if (!window.confirm(msg)) return;
    setCancelling(true);
    setCancelMsg("");
    try {
      const data = await api.post(`/orders/${id}/cancel`);
      setOrder(data.order);
      setCancelMsg(data.message);
    } catch (e) {
      setCancelMsg(e.message || "Could not cancel order.");
    } finally {
      setCancelling(false);
    }
  };

  // ── Pay now (unpaid order) — re-open Paystack for the existing reference ──
  const handlePayNow = async () => {
    const payment = order?.payment;
    if (!payment?.reference) {
      setError("This order can't be paid for right now.");
      return;
    }
    if (typeof window.PaystackPop === "undefined") {
      setError("Payment system is unavailable. Please try again.");
      return;
    }

    setPaying(true);
    const handler = window.PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: user?.email,
      amount: Math.round(Number(payment.amount) * 100), // Naira → kobo
      currency: "NGN",
      ref: payment.reference,
      onSuccess: async () => {
        try {
          const data = await api.post("/payments/verify", {
            reference: payment.reference,
          });
          setOrder(data.order);
        } catch (e) {
          setError(e.message || "Payment received, but we couldn't confirm it.");
        } finally {
          setPaying(false);
        }
      },
      onCancel: () => setPaying(false),
      onClose: () => setPaying(false),
    });
    handler.openIframe();
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
  const withinWindow = refundDeadlineMs != null && now < refundDeadlineMs;
  const remainingMs = withinWindow ? refundDeadlineMs - now : 0;

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

        {/* Delivery code — customer shares this with the rider at handoff */}
        {order.deliveryCode && !isDelivered && !isCancelled && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <p className="text-xs font-semibold text-emerald-700">Delivery code — share with your rider</p>
            <p className="mt-1 text-3xl font-black tracking-[0.4em] text-emerald-800">{order.deliveryCode}</p>
          </div>
        )}

        {/* Unpaid order — pay now or cancel (Chowdeck-style) */}
        {order.status === "PENDING_PAYMENT" && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-amber-600">hourglass_empty</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Payment pending</h3>
                <p className="text-xs text-slate-500 mb-3">
                  This order hasn't been paid for yet. Pay now to send it to the restaurant, or cancel it.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handlePayNow}
                    disabled={paying}
                    className="h-10 px-5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold text-sm transition active:scale-95"
                  >
                    {paying ? "Opening payment..." : "Pay now"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="h-10 px-5 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 font-semibold text-sm transition active:scale-95"
                  >
                    {cancelling ? "Cancelling..." : "Cancel order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel order — available until the restaurant accepts */}
        {order.status === "PENDING_RESTAURANT_CONFIRMATION" && (
          <div className="mb-6 rounded-2xl border border-amber-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-amber-500">timer</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900 mb-1">Need to cancel?</h3>
                {withinWindow ? (
                  <p className="text-xs text-emerald-600 font-semibold mb-3">
                    ⏱ Full refund available for the next {formatCountdown(remainingMs)}. Cancel now to get your money back.
                  </p>
                ) : (
                  <p className="text-xs text-red-600 font-semibold mb-3">
                    ⚠ The free-cancellation window has passed. Cancelling now will NOT refund your payment.
                  </p>
                )}
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="h-10 px-4 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 font-semibold text-sm transition active:scale-95"
                >
                  {cancelling ? "Cancelling..." : "Cancel Order"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Timeline — always shown so the current stage is derived directly
            from order.status (including "On the way"); the Delivery Tracker below
            adds granular detail while en route. */}
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

            {/* Rider status — inline under "On the way" (replaces the old separate Delivery Tracker) */}
            {order.delivery && order.status === "OUT_FOR_DELIVERY" && (
              <div className="mt-5 flex items-center gap-3 rounded-xl bg-purple-50 border border-purple-100 px-4 py-3">
                {order.delivery.rider?.photoUrl ? (
                  <img
                    src={order.delivery.rider.photoUrl}
                    alt={order.delivery.rider.user?.name || "Your rider"}
                    className="w-10 h-10 rounded-full object-cover border border-purple-200 shrink-0"
                  />
                ) : (
                  <span className="material-symbols-outlined text-purple-500 text-xl">two_wheeler</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 truncate">
                    {order.delivery.rider?.user?.name || "Your rider"}
                    {order.delivery.rider?.user?.phone && (
                      <span className="text-slate-400"> · {order.delivery.rider.user.phone}</span>
                    )}
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {DELIVERY_STEPS.find((s) => s.key === order.delivery.status)?.label || order.delivery.status}
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-medium shrink-0">
                  {(() => {
                    const [lo, hi] = estimateCustomerETA(order.delivery.status);
                    return `~${lo}–${hi} min`;
                  })()}
                </span>
              </div>
            )}
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
            {cancelMsg && (
              <p className="mt-3 text-sm font-semibold text-slate-700 bg-white/70 rounded-xl px-4 py-2 inline-block">{cancelMsg}</p>
            )}
          </div>
        )}

        {/* ── Delivery Failed Notice (delivery failed, awaiting new rider) ── */}
        {order.delivery && order.delivery.status === "FAILED" && order.status === "READY_FOR_PICKUP" && (
          <div className="bg-amber-50 rounded-2xl p-6 mb-6 text-center border border-amber-200">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl text-amber-500">assignment_late</span>
            </div>
            <h3 className="text-lg font-bold text-amber-800 mb-1">Delivery Attempt Unsuccessful</h3>
            <p className="text-sm text-amber-600 mb-1">
              The rider was unable to complete this delivery.
              {order.delivery.failureReason && (
                <span className="block mt-1 italic">Reason: &ldquo;{order.delivery.failureReason}&rdquo;</span>
              )}
            </p>
            <p className="text-xs text-amber-500 mt-2">
              A new rider is being assigned — your order is still being prepared.
            </p>
          </div>
        )}

        {/* Delivered confirmation */}
        {order.delivery && order.status === "DELIVERED" && (
          <div className="bg-green-50 rounded-2xl p-6 mb-6 text-center border border-green-100">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-3xl text-green-500">done_all</span>
            </div>
            <h3 className="text-lg font-bold text-green-700 mb-1">Order Delivered!</h3>
            <p className="text-sm text-green-600">
              Delivered by {order.delivery.rider?.user?.name || "your rider"}
              {order.delivery.rider?.user?.phone && <span> · {order.delivery.rider.user.phone}</span>}
              {order.delivery.deliveredAt && ` at ${new Date(order.delivery.deliveredAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`}
            </p>
          </div>
        )}

        {/* Rate your rider */}
        {order.delivery && order.status === "DELIVERED" && order.delivery.rider && (
          <RateRider riderId={order.delivery.rider.id} riderName={order.delivery.rider.user?.name || "your rider"} />
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
            {order.orderItems.map((item) => (
              <div key={item.id} className="px-5 py-4 flex items-center justify-between">
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
                    <p className="text-xs text-slate-400">{formatCurrency(Number(item.unitPrice))} × {item.quantity}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900">{formatCurrency((Number(item.unitPrice) * item.quantity))}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-100 px-5 py-4 space-y-2 bg-slate-50/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-700 font-medium">{formatCurrency(Number(order.subtotal))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Delivery Fee</span>
              <span className="text-slate-700 font-medium">{formatCurrency(Number(order.deliveryFee))}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Service Fee</span>
              <span className="text-slate-700 font-medium">{formatCurrency(Number(order.serviceFee))}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-sm font-bold text-slate-900">Total</span>
              <span className="text-lg font-extrabold text-slate-900">{formatCurrency(Number(order.totalAmount))}</span>
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
