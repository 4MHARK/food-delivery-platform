import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout, { OWNER_NAV } from "../components/AppLayout";
import { api } from "../lib/api";
import { useNotificationPermission, notify } from "../hooks/useNotifications";
import { useSSE } from "../hooks/useSSE";
import { formatCurrency } from "../lib/format";

const ORDER_STATUS = {
  PENDING_PAYMENT:                   { label: "Pending Payment", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  PENDING_RESTAURANT_CONFIRMATION:   { label: "Awaiting Confirm", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  ACCEPTED:                          { label: "Accepted", color: "bg-teal-100 text-teal-700 border-teal-200", dot: "bg-teal-500" },
  PREPARING:                         { label: "Preparing", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  READY_FOR_PICKUP:                  { label: "Ready for Pickup", color: "bg-indigo-100 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
  OUT_FOR_DELIVERY:                  { label: "On the Way", color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  DELIVERED:                         { label: "Delivered", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
  CANCELLED:                         { label: "Cancelled", color: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};
const ACTIVE_STATUSES = ["ACCEPTED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY"];
const TERMINAL_STATUSES = ["DELIVERED", "CANCELLED"];

// ── Date helpers (replace repeated inline toLocaleDateString/toLocaleTimeString calls) ──
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtDateYear = (d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// ── Small reusable field components (kills repeated label+input markup) ──
const SmallField = ({ label, textarea, className = "", ...props }) => (
  <div className={className}>
    <label className="block text-xs font-semibold text-slate-500 mb-1">{label}</label>
    {textarea ? (
      <textarea rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm resize-none" {...props} />
    ) : (
      <input className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" {...props} />
    )}
  </div>
);

const LargeField = ({ label, textarea, className = "", ...props }) => (
  <div className={className}>
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
    {textarea ? (
      <textarea rows={3} className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm resize-none" {...props} />
    ) : (
      <input className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" {...props} />
    )}
  </div>
);

// ── Captures real coordinates via the browser, same pattern as checkout ──
function LocationButton({ status, onClick }) {
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onClick}
        disabled={status === "loading"}
        className={`flex items-center gap-2 text-sm font-semibold rounded-xl px-4 py-2.5 transition active:scale-95 ${
          status === "success" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-600 hover:bg-amber-100"
        }`}
      >
        <span className="material-symbols-outlined text-lg">{status === "success" ? "check_circle" : "my_location"}</span>
        {status === "loading" ? "Getting your location..." : status === "success" ? "Location captured" : "Use my current location"}
      </button>
      <p className="text-xs text-slate-400 mt-1.5">Recommended — helps riders find you accurately.</p>
    </div>
  );
}

function StarRating({ rating }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={`material-symbols-outlined text-amber-500 text-sm ${n <= rating ? "filled-icon" : ""}`}>star</span>
      ))}
    </span>
  );
}

// ── One card for all three order sections (pending/active/past). Cuts ~150
//    lines of near-duplicate markup down to this + the call sites below. ──
function OrderCard({ order, statusInfo, highlight, muted, actions, rightSlot, showItems = true, showFooter = true }) {
  const bg = highlight ? "bg-amber-50 border-2 border-amber-200" : "bg-white";
  const divider = highlight ? "border-amber-200/50" : "border-slate-50";
  const footerBg = highlight ? "bg-amber-50/50" : "bg-slate-50/30";

  return (
    <div className={`${bg} rounded-2xl shadow-sm overflow-hidden ${muted ? "opacity-60 hover:opacity-100 transition" : ""}`}>
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Order #{order.id}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          <p className={`text-xs mt-1 ${muted ? "text-slate-400" : "text-slate-500"}`}>
            {order.customer?.name || "Customer"} · {fmtDate(order.createdAt)}{!muted && ` at ${fmtTime(order.createdAt)}`}
          </p>
        </div>
        {rightSlot ?? (actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>)}
      </div>

      {showItems && (
        <div className={`border-t ${divider} px-5 py-3 space-y-1.5`}>
          {order.orderItems?.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{item.quantity}&times; {item.menuItem?.name || `Item #${item.menuItemId}`}</span>
              <span className="text-slate-400 text-xs">{formatCurrency(item.unitPrice * item.quantity)}</span>
            </div>
          ))}
        </div>
      )}

      {showFooter && (
        <div className={`border-t ${divider} px-5 py-3 flex items-center justify-between ${footerBg}`}>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
            <span className="material-symbols-outlined text-sm shrink-0">location_on</span>
            <span className="truncate">{order.deliveryAddress}</span>
          </div>
          <span className="text-sm font-bold text-slate-900 shrink-0 ml-2">{formatCurrency(Number(order.totalAmount))}</span>
        </div>
      )}
    </div>
  );
}

const initialRestForm = { name: "", description: "", address: "", phone: "", imageUrl: "" };
const initialMenuForm = { name: "", description: "", price: "", category: "", imageUrl: "" };

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const prevPendingRef = useRef(0);
  const prevReviewCountRef = useRef(0);

  // ── Core state ──
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Restaurant
  const [restaurant, setRestaurant] = useState(null);
  const [restForm, setRestForm] = useState(initialRestForm);
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | loading | success | error
  const [creating, setCreating] = useState(false);
  const [savingRest, setSavingRest] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Menu
  const [menuItems, setMenuItems] = useState([]);
  const [menuForm, setMenuForm] = useState(initialMenuForm);
  const [editingItem, setEditingItem] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Orders
  const [activeTab, setActiveTab] = useState("menu");
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Bank / payouts
  const [bankForm, setBankForm] = useState({ accountNumber: "", bankCode: "", bankName: "" });
  const [savingBank, setSavingBank] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resolvedName, setResolvedName] = useState(null); // account name from Paystack
  const [editingBank, setEditingBank] = useState(false);
  const [banks, setBanks] = useState([]); // fetched from Paystack
  const [payouts, setPayouts] = useState([]);
  const [payoutSummary, setPayoutSummary] = useState(null);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");

  const showMsg = (msg) => { setMessage(msg); setTimeout(() => setMessage(""), 10000); };

  // ── Fetch restaurant ──
  const fetchRestaurant = useCallback(async () => {
    try {
      const data = await api.get("/my-restaurant");
      const r = data.restaurant;
      setRestaurant(r);
      if (r) {
        setRestForm({
          name: r.name || "", description: r.description || "", address: r.address || "",
          phone: r.phone || "", imageUrl: r.imageUrl || "",
          lat: r.lat ?? undefined, lng: r.lng ?? undefined,
        });
        setLocationStatus(r.lat != null ? "success" : "idle");
        setBankForm({ accountNumber: r.accountNumber || "", bankCode: r.bankCode || "", bankName: r.bankName || "" });
        setResolvedName(r.accountName || null);
      }
      return r;
    } catch (err) {
      setError(err.message || "Failed to load");
      return null;
    }
  }, []);

  // ── Fetch menu ──
  const fetchMenu = useCallback(async (restaurantId) => {
    try {
      const data = await api.get(`/restaurants/${restaurantId}/menu-items`);
      setMenuItems(data.menuItems || []);
    } catch { /* silent */ }
  }, []);

  // ── Fetch orders ──
  const fetchOrders = useCallback(async (restaurantId) => {
    try {
      setOrdersLoading(true);
      setOrdersError("");
      const data = await api.get(`/restaurants/${restaurantId}/orders`);
      setOrders(data.orders || []);
      setLastUpdated(new Date());
    } catch (e) {
      setOrdersError(e.message || "Failed to load orders");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // ── Fetch payouts ──
  const fetchPayouts = useCallback(async (restaurantId) => {
    try {
      setPayoutsLoading(true);
      const data = await api.get(`/restaurants/${restaurantId}/payouts`);
      setPayouts(data.payouts || []);
      setPayoutSummary(data.summary || null);
    } catch { /* silent */ } finally {
      setPayoutsLoading(false);
    }
  }, []);

  // ── Fetch reviews ──
  const fetchReviews = useCallback(async (restaurantId) => {
    try {
      setReviewsLoading(true);
      setReviewsError("");
      const data = await api.get(`/restaurants/${restaurantId}/reviews`);
      setReviews(data.reviews || []);
    } catch (e) {
      setReviewsError(e.message || "Failed to load reviews");
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const fetchBanks = async () => {
    try {
      const data = await api.get("/payments/banks");
      setBanks(data.banks || []);
    } catch {
      setBanks([]);
    }
  };

  // ── Capture real coordinates for the restaurant, same pattern as checkout.
  //    Only ever writes real numbers into state — never null — so an unset
  //    location is omitted from the request instead of coercing to (0,0). ──
  const handleUseLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("error");
      showMsg("Your browser doesn't support location.");
      return;
    }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRestForm((f) => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setLocationStatus("success");
      },
      () => {
        setLocationStatus("error");
        showMsg("Couldn't get your location. You can still save without it.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // ── Initial load ──
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const r = await fetchRestaurant();
      if (r) {
        await Promise.all([fetchMenu(r.id), fetchOrders(r.id), fetchReviews(r.id)]);
      }
      fetchBanks();
      setLoading(false);
    };
    init();
  }, [fetchRestaurant, fetchMenu, fetchOrders]);

  // ── Live order updates via SSE (replaces 30s polling) ──
  useNotificationPermission(!!restaurant);

  // Baseline of how many pending orders we've already shown, so an SSE refresh
  // only fires the "new order" toast when the count actually goes up (and stays
  // in sync when we accept/reject orders ourselves).
  useEffect(() => {
    prevPendingRef.current = orders.filter((o) => o.status === "PENDING_RESTAURANT_CONFIRMATION").length;
  }, [orders]);

  useEffect(() => {
    prevReviewCountRef.current = reviews.length;
  }, [reviews]);

useSSE(
  async () => {
    if (!restaurant) return;
    try {
      const data = await api.get(`/restaurants/${restaurant.id}/orders`);
      const freshOrders = data.orders || [];
      const currentPending = freshOrders.filter(
        (o) => o.status === "PENDING_RESTAURANT_CONFIRMATION"
      ).length;

      // Always sync the UI to the server's real state — the toast below is
      // just an extra notification for new orders specifically, not a gate
      // on whether the order list itself gets updated.
      setOrders(freshOrders);
      setLastUpdated(new Date());

      if (currentPending > prevPendingRef.current) {
        const diff = currentPending - prevPendingRef.current;
        showMsg(`🔔 ${diff} new order${diff > 1 ? "s" : ""} received!`);
        notify("New Order!", {
          body: `${diff} new order${diff > 1 ? "s" : ""} received!`,
          icon: "/favicon.svg",
        });
      }
      prevPendingRef.current = currentPending;

      const revData = await api.get(`/restaurants/${restaurant.id}/reviews`).catch(() => null);
      const freshReviews = revData?.reviews || [];
      if (freshReviews.length > prevReviewCountRef.current) {
        const diff = freshReviews.length - prevReviewCountRef.current;
        showMsg(`⭐ ${diff} new review${diff > 1 ? "s" : ""} received!`);
        setReviews(freshReviews);
        notify("New Review!", {
          body: `${diff} new review${diff > 1 ? "s" : ""} on your restaurant.`,
          icon: "/favicon.svg",
        });
      }
      prevReviewCountRef.current = freshReviews.length;
    } catch { /* silent — an SSE refresh shouldn't disturb the user */ }
  },
  { enabled: !!restaurant, deps: [restaurant?.id] }
);

  // ── Order actions ──
  const advanceOrder = async (orderId, status, label) => {
    try {
      setUpdatingOrderId(orderId);
      await api.put(`/orders/${orderId}/status`, { status });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      showMsg(`Order #${orderId} ${label}`);
    } catch (e) {
      showMsg(e.message || "Failed to update order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleRejectOrder = async (orderId) => {
    if (!window.confirm("Cancel this order? The customer will be notified.")) return;
    try {
      setUpdatingOrderId(orderId);
      await api.put(`/orders/${orderId}/status`, { status: "CANCELLED" });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "CANCELLED" } : o)));
      showMsg(`Order #${orderId} cancelled`);
    } catch (e) {
      showMsg(e.message || "Failed to cancel order");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // ── Create restaurant ──
  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    if (!restForm.name || !restForm.description || !restForm.address || !restForm.phone) {
      setError("All fields except image URL are required");
      return;
    }
    try {
      setCreating(true);
      setError("");
      const data = await api.post("/restaurants", restForm);
      const r = data.restaurant;
      setRestaurant(r);
      setRestForm({
        name: r.name || "", description: r.description || "", address: r.address || "",
        phone: r.phone || "", imageUrl: r.imageUrl || "",
        lat: r.lat ?? undefined, lng: r.lng ?? undefined,
      });
      setShowCreate(false);
      showMsg("Restaurant created! Start building your menu.");
      fetchMenu(r.id);
      fetchOrders(r.id);
    } catch (e) {
      setError(e.message || "Failed to create restaurant");
    } finally {
      setCreating(false);
    }
  };

  // ── Update restaurant ──
  const handleUpdateRestaurant = async (e) => {
    e.preventDefault();
    try {
      setSavingRest(true);
      await api.put(`/restaurants/${restaurant.id}`, restForm);
      setRestaurant((prev) => ({ ...prev, ...restForm }));
      showMsg("Restaurant updated");
    } catch (e) {
      setError(e.message || "Failed to update restaurant");
    } finally {
      setSavingRest(false);
    }
  };

  // ── Save bank details (creates a Paystack transfer recipient) ──
  const handleSaveBank = async (e) => {
    e.preventDefault();
    if (!bankForm.accountNumber || !bankForm.bankCode) {
      showMsg("Account number and bank code are required");
      return;
    }
    try {
      setSavingBank(true);
      const data = await api.put(`/restaurants/${restaurant.id}/bank`, bankForm);
      setRestaurant((prev) => ({ ...prev, ...data.restaurant }));
      setEditingBank(false);
      showMsg("Bank details saved");
    } catch (e) {
      showMsg(e.message || "Failed to save bank details");
    } finally {
      setSavingBank(false);
    }
  };

  // ── Verify account number + bank → show the account name before saving ──
  const handleVerifyAccount = async () => {
    if (bankForm.accountNumber.length !== 10 || !bankForm.bankCode) {
      showMsg("Enter the 10-digit account number and pick a bank first.");
      return;
    }
    try {
      setVerifying(true);
      setResolvedName(null);
      const data = await api.get(
        `/payments/resolve-account?account_number=${bankForm.accountNumber}&bank_code=${bankForm.bankCode}`
      );
      setResolvedName(data.accountName);
      showMsg("Account verified.");
    } catch (e) {
      setResolvedName(null);
      showMsg(e.message || "Could not resolve account.");
    } finally {
      setVerifying(false);
    }
  };

  // ── Menu CRUD ──
  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!menuForm.name || !menuForm.price || !menuForm.category) {
      setError("Name, price, and category are required");
      return;
    }
    try {
      setSavingMenu(true);
      await api.post(`/restaurants/${restaurant.id}/menu-items`, { ...menuForm, price: Number(menuForm.price) });
      await fetchMenu(restaurant.id);
      setMenuForm(initialMenuForm);
      setShowAddMenu(false);
      showMsg("Menu item added");
    } catch (e) {
      setError(e.message || "Failed to add menu item");
    } finally {
      setSavingMenu(false);
    }
  };

  const handleUpdateMenuItem = async (e) => {
    e.preventDefault();
    try {
      setSavingMenu(true);
      await api.put(`/menu-items/${editingItem.id}`, {
        name: editingItem.name, description: editingItem.description,
        price: Number(editingItem.price), category: editingItem.category,
        imageUrl: editingItem.imageUrl || "",
      });
      await fetchMenu(restaurant.id);
      setEditingItem(null);
      showMsg("Menu item updated");
    } catch (e) {
      setError(e.message || "Failed to update menu item");
    } finally {
      setSavingMenu(false);
    }
  };

  const handleDeleteMenuItem = async (itemId) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      setDeletingId(itemId);
      await api.del(`/menu-items/${itemId}`);
      await fetchMenu(restaurant.id);
      showMsg("Menu item deleted");
    } catch (e) {
      setError(e.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Derived ──
  const pendingOrders = orders.filter((o) => o.status === "PENDING_RESTAURANT_CONFIRMATION");
  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  const pastOrders = orders.filter((o) => TERMINAL_STATUSES.includes(o.status));

  // ═══════════════════════════════════════════
  //  NO RESTAURANT — show welcome + create form
  // ═══════════════════════════════════════════
  if (!loading && !error && !restaurant) {
    return (
      <AppLayout desktopNavItems={OWNER_NAV} bottomNavItems={OWNER_NAV}>
        <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-12 pb-24">
          {/* Welcome */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-5xl text-amber-500">storefront</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome, {user?.name?.split(" ")[0] || "Chef"}!</h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              You don't have a restaurant yet. Create one now to start receiving orders.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full mt-4">
              <span className="material-symbols-outlined text-sm">shield_person</span>
              Restaurant Owner
            </span>
          </div>

          {error && (
            <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 font-medium text-center">{error}</div>
          )}

          <form onSubmit={handleCreateRestaurant} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Create Your Restaurant</h3>
            <LargeField label="Name" required placeholder="e.g. Taste Haven Grill" value={restForm.name} onChange={(e) => setRestForm({ ...restForm, name: e.target.value })} />
            <LargeField label="Description" textarea required placeholder="Tell customers what makes your restaurant special..." value={restForm.description} onChange={(e) => setRestForm({ ...restForm, description: e.target.value })} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <LargeField label="Address" required placeholder="e.g. 15 Admiralty Way, Lekki" value={restForm.address} onChange={(e) => setRestForm({ ...restForm, address: e.target.value })} />
              <LargeField label="Phone" required placeholder="e.g. +234 812 345 6789" value={restForm.phone} onChange={(e) => setRestForm({ ...restForm, phone: e.target.value })} />
            </div>
            <LocationButton status={locationStatus} onClick={handleUseLocation} />
            <LargeField label={<>Image URL <span className="text-slate-400 font-normal">(optional)</span></>} placeholder="https://example.com/image.jpg" value={restForm.imageUrl} onChange={(e) => setRestForm({ ...restForm, imageUrl: e.target.value })} />
            <button type="submit" disabled={creating}
              className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]">
              {creating ? "Creating..." : "Create Restaurant"}
            </button>
          </form>
        </div>
      </AppLayout>
    );
  }

  // ═══════════════════════════
  //  LOADING
  // ═══════════════════════════
  if (loading) {
    return (
      <AppLayout desktopNavItems={OWNER_NAV} bottomNavItems={OWNER_NAV}>
        <div className="px-4 lg:px-8 max-w-3xl mx-auto pt-8 pb-24">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-6 mb-4 space-y-3">
              <div className="w-1/2 h-5 bg-slate-200 animate-pulse rounded" />
              <div className="w-full h-10 bg-slate-200 animate-pulse rounded-xl" />
              <div className="w-3/4 h-10 bg-slate-200 animate-pulse rounded-xl" />
            </div>
          ))}
        </div>
      </AppLayout>
    );
  }

  // ═══════════════════════════
  //  ERROR
  // ═══════════════════════════
  if (error && !restaurant) {
    return (
      <AppLayout desktopNavItems={OWNER_NAV} bottomNavItems={OWNER_NAV}>
        <div className="flex items-center justify-center px-4 pt-20">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{error}</h2>
            <button onClick={() => window.location.reload()} className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white hover:bg-amber-600 transition active:scale-95 mt-4">
              Try Again
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ═══════════════════════════════════════════════
  //  HAS RESTAURANT — full dashboard
  // ═══════════════════════════════════════════════
  return (
    <AppLayout desktopNavItems={OWNER_NAV} bottomNavItems={OWNER_NAV} showCart={false} showUserDropdown={false}>
      <div className="px-4 lg:px-8 max-w-4xl mx-auto pt-6 pb-24 md:pb-8">
        {/* Toast */}
        {message && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-6 py-3 rounded-full shadow-lg animate-fade-up cursor-pointer" onClick={() => setMessage("")}>
            {message}
          </div>
        )}

        {/* ── Header Card ── */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-3xl text-amber-600">storefront</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{restaurant.name}</h2>
                <p className="text-sm text-slate-500">{restaurant.address} · {restaurant.phone}</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreate(!showCreate)}
              className={`text-xs font-bold px-4 py-2 rounded-full transition ${
                showCreate ? "bg-slate-100 text-slate-600" : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
            >
              {showCreate ? "Cancel" : "Edit Restaurant"}
            </button>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5 pt-5 border-t border-slate-100">
            {[
              { label: "Menu Items", value: menuItems.length },
              { label: "New Orders", value: pendingOrders.length, highlight: pendingOrders.length > 0 },
              { label: "Total Orders", value: orders.length },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-2xl font-bold ${s.highlight ? "text-amber-500" : "text-slate-900"}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Edit restaurant form */}
          {showCreate && (
            <form onSubmit={handleUpdateRestaurant} className="space-y-4 border-t border-slate-100 pt-4 mt-4">
              <SmallField label="Name" value={restForm.name} onChange={(e) => setRestForm({ ...restForm, name: e.target.value })} />
              <SmallField label="Description" textarea value={restForm.description} onChange={(e) => setRestForm({ ...restForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <SmallField label="Address" value={restForm.address} onChange={(e) => setRestForm({ ...restForm, address: e.target.value })} />
                <SmallField label="Phone" value={restForm.phone} onChange={(e) => setRestForm({ ...restForm, phone: e.target.value })} />
              </div>
              <LocationButton status={locationStatus} onClick={handleUseLocation} />
              <SmallField label="Image URL" value={restForm.imageUrl} onChange={(e) => setRestForm({ ...restForm, imageUrl: e.target.value })} />
              <button type="submit" disabled={savingRest} className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]">
                {savingRest ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab("menu")}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition ${
              activeTab === "menu" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="material-symbols-outlined text-sm mr-1.5 align-middle">menu_book</span>
            Menu
            <span className="ml-1.5 text-slate-400 text-xs font-normal">({menuItems.length})</span>
          </button>
          <button
            onClick={() => { setActiveTab("orders"); fetchOrders(restaurant.id); }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition relative ${
              activeTab === "orders" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="material-symbols-outlined text-sm mr-1.5 align-middle">receipt_long</span>
            Orders
            {pendingOrders.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                {pendingOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab("payouts"); fetchPayouts(restaurant.id); }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition ${
              activeTab === "payouts" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="material-symbols-outlined text-sm mr-1.5 align-middle">account_balance</span>
            Payouts
          </button>
          <button
            onClick={() => { setActiveTab("reviews"); fetchReviews(restaurant.id); }}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition ${
              activeTab === "reviews" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <span className="material-symbols-outlined text-sm mr-1.5 align-middle">star</span>
            Reviews
          </button>
        </div>

        {/* ══════════════ MENU TAB ══════════════ */}
        {activeTab === "menu" && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Menu <span className="text-slate-400 text-sm font-normal">({menuItems.length})</span>
              </h3>
              <button
                onClick={() => { setShowAddMenu(!showAddMenu); setEditingItem(null); }}
                className={`text-xs font-bold px-4 py-2 rounded-full transition ${
                  showAddMenu ? "bg-slate-100 text-slate-600" : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {showAddMenu ? "Cancel" : "+ Add Item"}
              </button>
            </div>

            {/* Add form */}
            {showAddMenu && (
              <form onSubmit={handleAddMenuItem} className="bg-white rounded-2xl shadow-sm p-5 space-y-4 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <SmallField label="Name *" value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="e.g. Pepperoni Pizza" />
                  <SmallField label="Category *" value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })} placeholder="e.g. Main Course" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SmallField label="Price (₦) *" type="number" step="0.01" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} placeholder="e.g. 3500" />
                  <SmallField label="Image URL" value={menuForm.imageUrl} onChange={(e) => setMenuForm({ ...menuForm, imageUrl: e.target.value })} placeholder="Optional" />
                </div>
                <SmallField label="Description" textarea value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Describe the dish..." />
                <button type="submit" disabled={savingMenu} className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]">
                  {savingMenu ? "Adding..." : "Add to Menu"}
                </button>
              </form>
            )}

            {/* Edit form */}
            {editingItem && (
              <form onSubmit={handleUpdateMenuItem} className="bg-white rounded-2xl shadow-sm p-5 space-y-4 mb-4 border-l-4 border-amber-500">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Editing: {editingItem.name}</p>
                <div className="grid grid-cols-2 gap-3">
                  <SmallField label="Name" value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} />
                  <SmallField label="Category" value={editingItem.category} onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SmallField label="Price (₦)" type="number" step="0.01" value={editingItem.price} onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })} />
                  <SmallField label="Image URL" value={editingItem.imageUrl || ""} onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })} />
                </div>
                <SmallField label="Description" textarea value={editingItem.description || ""} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} />
                <div className="flex gap-2">
                  <button type="submit" disabled={savingMenu} className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-sm transition active:scale-95">
                    {savingMenu ? "Saving..." : "Save"}
                  </button>
                  <button type="button" onClick={() => setEditingItem(null)} className="px-4 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition">Cancel</button>
                </div>
              </form>
            )}

            {/* Empty menu */}
            {menuItems.length === 0 && !showAddMenu && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-3xl text-slate-300">menu_book</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">No menu items</h4>
                <p className="text-xs text-slate-400">Click "+ Add Item" to start building your menu.</p>
              </div>
            )}

            {/* Menu list */}
            {menuItems.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {menuItems.map((item, idx) => (
                  <div key={item.id} className={`px-5 py-4 flex items-center justify-between ${idx < menuItems.length - 1 ? "border-b border-slate-50" : ""}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <span className="material-symbols-outlined text-slate-400 text-sm">restaurant</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{item.category}</span>
                          <span className="text-xs font-bold text-slate-700">{formatCurrency(Number(item.price))}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setEditingItem({ ...item, price: String(item.price) })} className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button onClick={() => handleDeleteMenuItem(item.id)} disabled={deletingId === item.id} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50">
                        {deletingId === item.id ? (
                          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                        ) : (
                          <span className="material-symbols-outlined text-sm">delete</span>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ══════════════ ORDERS TAB ══════════════ */}
        {activeTab === "orders" && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Orders</h3>
              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <span className="text-xs text-slate-400">Updated {fmtTime(lastUpdated)}</span>
                )}
                <button
                  onClick={() => restaurant && fetchOrders(restaurant.id)}
                  disabled={ordersLoading}
                  className="text-xs font-semibold text-amber-500 hover:text-amber-600 transition flex items-center gap-1 disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-sm ${ordersLoading ? "animate-spin" : ""}`}>
                    {ordersLoading ? "progress_activity" : "refresh"}
                  </span>
                  Refresh
                </button>
              </div>
            </div>

            {ordersError && !ordersLoading && (
              <div className="bg-red-50 rounded-2xl p-6 text-center mb-4">
                <p className="text-sm text-red-600 font-medium mb-3">{ordersError}</p>
                <button onClick={() => restaurant && fetchOrders(restaurant.id)} className="text-sm font-semibold text-red-600 hover:text-red-700 underline transition">Try again</button>
              </div>
            )}

            {ordersLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
                    <div className="flex justify-between">
                      <div className="w-32 h-5 bg-slate-200 animate-pulse rounded" />
                      <div className="w-20 h-5 bg-slate-200 animate-pulse rounded-full" />
                    </div>
                    <div className="w-full h-4 bg-slate-200 animate-pulse rounded" />
                    <div className="w-1/2 h-4 bg-slate-200 animate-pulse rounded" />
                  </div>
                ))}
              </div>
            )}

            {!ordersLoading && !ordersError && orders.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-3xl text-slate-300">receipt_long</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">No orders yet</h4>
                <p className="text-xs text-slate-400">Orders from customers will appear here.</p>
              </div>
            )}

            {!ordersLoading && !ordersError && orders.length > 0 && (
              <div className="space-y-6">
                {/* ── NEW (PENDING) ── */}
                {pendingOrders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      New ({pendingOrders.length})
                    </h4>
                    <div className="space-y-3">
                      {pendingOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          highlight
                          statusInfo={{ color: ORDER_STATUS.PENDING_RESTAURANT_CONFIRMATION.color, label: "New" }}
                          actions={
                            <>
                              <button
                                onClick={() => advanceOrder(order.id, "ACCEPTED", "accepted")}
                                disabled={updatingOrderId === order.id}
                                className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white text-xs font-bold transition active:scale-95 flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-sm">check</span>
                                Accept
                              </button>
                              <button
                                onClick={() => handleRejectOrder(order.id)}
                                disabled={updatingOrderId === order.id}
                                className="px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-500 text-xs font-bold transition active:scale-95"
                              >
                                Decline
                              </button>
                            </>
                          }
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── ACTIVE ── */}
                {activeOrders.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">Active ({activeOrders.length})</h4>
                    <div className="space-y-3">
                      {activeOrders.map((order) => {
                        const status = ORDER_STATUS[order.status] || ORDER_STATUS.PENDING_PAYMENT;
                        return (
                          <OrderCard
                            key={order.id}
                            order={order}
                            statusInfo={status}
                            actions={
                              <>
                                {order.status === "ACCEPTED" && (
                                  <button onClick={() => advanceOrder(order.id, "PREPARING", "marked preparing")} disabled={updatingOrderId === order.id} className="px-4 py-2 rounded-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-xs font-bold transition active:scale-95">
                                    Preparing
                                  </button>
                                )}
                                {order.status === "PREPARING" && (
                                  <button onClick={() => advanceOrder(order.id, "READY_FOR_PICKUP", "ready for pickup")} disabled={updatingOrderId === order.id} className="px-4 py-2 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-300 text-white text-xs font-bold transition active:scale-95">
                                    Ready for pickup
                                  </button>
                                )}
                                {["ACCEPTED", "PREPARING", "READY_FOR_PICKUP"].includes(order.status) && (
                                  <button onClick={() => handleRejectOrder(order.id)} disabled={updatingOrderId === order.id} className="px-4 py-2 rounded-full bg-white border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600 text-slate-500 text-xs font-bold transition active:scale-95">
                                    Cancel order
                                  </button>
                                )}
                                {updatingOrderId === order.id && (
                                  <span className="material-symbols-outlined text-sm text-amber-500 animate-spin">progress_activity</span>
                                )}
                              </>
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── PAST ── */}
                {pastOrders.length > 0 && (
                  <div>
                    <button
                      onClick={() => {
                        const el = document.getElementById("past-orders");
                        if (el) el.classList.toggle("hidden");
                      }}
                      className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 hover:text-slate-600 transition flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">history</span>
                      Completed ({pastOrders.length})
                      <span className="material-symbols-outlined text-sm">expand_more</span>
                    </button>
                    <div id="past-orders" className="space-y-3">
                      {pastOrders.map((order) => {
                        const status = ORDER_STATUS[order.status] || ORDER_STATUS.CANCELLED;
                        return (
                          <OrderCard
                            key={order.id}
                            order={order}
                            statusInfo={status}
                            muted
                            showItems={false}
                            showFooter={false}
                            rightSlot={<span className="text-sm font-bold text-slate-400 shrink-0">{formatCurrency(Number(order.totalAmount))}</span>}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ══════════════ PAYOUTS TAB ══════════════ */}
        {activeTab === "payouts" && (
          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Payouts</h3>

            <div className="bg-white rounded-2xl shadow-sm p-5 mb-4">
              <h4 className="text-sm font-bold text-slate-900 mb-1">Payout bank account</h4>
              <p className="text-xs text-slate-400 mb-4">Your restaurant's share is sent here when an order is delivered.</p>
              {restaurant.accountName && !editingBank ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
                    <p className="font-semibold text-emerald-800">{restaurant.accountName}</p>
                    <p className="text-emerald-700">{restaurant.bankName || "Bank"} ·•••• {restaurant.accountNumber?.slice(-4)}</p>
                  </div>
                  <button type="button" onClick={() => { setEditingBank(true); setResolvedName(restaurant.accountName); }} className="w-full h-10 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition active:scale-[0.98]">
                    Edit bank details
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveBank} className="space-y-3">
                  <SmallField
                    label="Account Number" value={bankForm.accountNumber} inputMode="numeric" maxLength={10}
                    placeholder="10-digit account number"
                    onChange={(e) => { setBankForm({ ...bankForm, accountNumber: e.target.value.replace(/\D/g, "") }); setResolvedName(null); }}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1">Bank</label>
                    <select value={bankForm.bankCode} onChange={(e) => { const bank = banks.find((b) => b.code === e.target.value); setBankForm({ ...bankForm, bankCode: e.target.value, bankName: bank?.name || "" }); setResolvedName(null); }} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm bg-white">
                      <option value="">{banks.length ? "Select bank" : "Loading banks..."}</option>
                      {banks.map((b) => (
                        <option key={b.code} value={b.code}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="button" onClick={handleVerifyAccount} disabled={verifying} className="w-full h-10 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-semibold text-sm transition active:scale-[0.98]">
                    {verifying ? "Verifying..." : "Verify Account"}
                  </button>
                  {resolvedName && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm">
                      <p className="text-xs text-emerald-600 mb-0.5">Account name</p>
                      <p className="font-semibold text-emerald-800">{resolvedName}</p>
                    </div>
                  )}
                  <button type="submit" disabled={savingBank || !resolvedName} className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]">
                    {savingBank ? "Saving..." : "Save Bank Details"}
                  </button>
                </form>
              )}
            </div>

            {payoutSummary && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: "Total Earned", value: payoutSummary.totalEarned, color: "text-slate-900" },
                  { label: "Paid Out", value: payoutSummary.paidOut, color: "text-green-600" },
                  { label: "Pending", value: payoutSummary.pending, color: "text-amber-600" },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl shadow-sm p-4 text-center">
                    <p className={`text-xl font-extrabold ${s.color}`}>{formatCurrency(s.value)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            )}

            {payoutsLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <div key={i} className="h-16 bg-slate-200 animate-pulse rounded-2xl" />)}
              </div>
            ) : payouts.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-3xl text-slate-300">account_balance</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">No payouts yet</h4>
                <p className="text-xs text-slate-400">Your earnings appear here once orders are delivered.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {payouts.map((p, idx) => (
                  <div key={p.id} className={`px-5 py-3 flex items-center justify-between ${idx < payouts.length - 1 ? "border-b border-slate-50" : ""}`}>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Order #{p.orderId}</p>
                      <p className="text-xs text-slate-400">{fmtDateYear(p.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === "SUCCESS" ? "bg-green-100 text-green-700" : p.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{p.status}</span>
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(p.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ══════════════ REVIEWS TAB ══════════════ */}
        {activeTab === "reviews" && (
          <section>
            <h3 className="text-lg font-bold text-slate-900 mb-4">Reviews</h3>

            {reviews.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5 mb-4 flex items-center gap-5">
                <div className="text-center">
                  <p className="text-4xl font-extrabold text-slate-900">
                    {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
                  </p>
                  <StarRating rating={Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)} />
                </div>
                <p className="text-sm text-slate-500">
                  Based on {reviews.length} customer review{reviews.length === 1 ? "" : "s"}.
                </p>
              </div>
            )}

            {reviewsLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-200 animate-pulse rounded-2xl" />)}
              </div>
            )}

            {reviewsError && !reviewsLoading && (
              <div className="bg-red-50 rounded-2xl p-6 text-center mb-4">
                <p className="text-sm text-red-600 font-medium mb-3">{reviewsError}</p>
                <button onClick={() => fetchReviews(restaurant.id)} className="text-sm font-semibold text-red-600 hover:text-red-700 underline transition">Try again</button>
              </div>
            )}

            {!reviewsLoading && !reviewsError && reviews.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-3xl text-slate-300">star</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">No reviews yet</h4>
                <p className="text-xs text-slate-400">Customer reviews appear here once orders are delivered.</p>
              </div>
            )}

            {!reviewsLoading && !reviewsError && reviews.length > 0 && (
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl shadow-sm p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-900">{r.author?.name || "Customer"}</span>
                      <span className="text-xs text-slate-400">{fmtDateYear(r.createdAt)}</span>
                    </div>
                    <div className="mb-2">
                      <StarRating rating={r.rating} />
                    </div>
                    {r.comment && <p className="text-sm text-slate-600">{r.comment}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;