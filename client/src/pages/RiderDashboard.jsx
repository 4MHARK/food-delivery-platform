import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout, { RIDER_NAV } from "../components/AppLayout";

const ORDER_STATUS = {
  PENDING_PAYMENT:                   { label: "Pending Payment", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  PENDING_RESTAURANT_CONFIRMATION:   { label: "Awaiting Confirm", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  PREPARING:                         { label: "Preparing", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  OUT_FOR_DELIVERY:                  { label: "On the Way", color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  DELIVERED:                         { label: "Delivered", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500" },
  CANCELLED:                         { label: "Cancelled", color: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};

const DELIVERY_STATUS = {
  ZILLA_ON_IT: { label: "Zilla On It", color: "bg-blue-100 text-blue-700 border-blue-200",   dot: "bg-blue-500" },
  AT_KITCHEN:  { label: "At Kitchen",  color: "bg-yellow-100 text-yellow-700 border-yellow-200", dot: "bg-yellow-500" },
  BAGGED:      { label: "Bagged",      color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  MOVING:      { label: "Moving",      color: "bg-purple-100 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  CLOSE_BY:    { label: "Close By",    color: "bg-pink-100 text-pink-700 border-pink-200",       dot: "bg-pink-500" },
  DELIVERED:   { label: "Delivered",   color: "bg-green-100 text-green-700 border-green-200",    dot: "bg-green-500" },
  FAILED:      { label: "Failed",      color: "bg-red-100 text-red-700 border-red-200",          dot: "bg-red-500" },
};

const ACTIVE_DELIVERY_STATUSES = ["ZILLA_ON_IT", "AT_KITCHEN", "BAGGED", "MOVING", "CLOSE_BY"];
const PAST_DELIVERY_STATUSES = ["DELIVERED", "FAILED"];

// Estimated delivery time ranges in minutes per vehicle type.
// Placeholder until GPS/maps integration provides real distance-based ETAs.
const ETA_RANGES = {
  Bicycle:   [20, 35],
  Motorcycle: [10, 25],
  Car:       [10, 20],
};
const DEFAULT_ETA = [10, 30];

/** Calculate remaining ETA based on delivery progress (0 = not started, 1 = complete). */
function estimateETA(vehicleType, deliveryStatus) {
  const [low, high] = ETA_RANGES[vehicleType] || DEFAULT_ETA;
  const totalSteps = Object.keys(DELIVERY_STATUS).filter(
    (k) => k !== "FAILED"
  ).length - 1; // exclude FAILED, count steps from ZILLA_ON_IT to DELIVERED
  const progress = Object.keys(DELIVERY_STATUS).indexOf(deliveryStatus);
  const factor = Math.max(0, 1 - progress / Math.max(1, totalSteps));
  return [
    Math.max(1, Math.round(low * factor)),
    Math.max(2, Math.round(high * factor)),
  ];
}

const RiderDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rider, setRider] = useState(null);

  // Registration form
  const [riderForm, setRiderForm] = useState({
    vehicleType: "",
    licensePlate: "",
    licenseNumber: "",
    matricNumber: "",
    phone: "",
  });
  const [idType, setIdType] = useState("license"); // "license" | "matric"
  const [registering, setRegistering] = useState(false);

  // Orders & deliveries
  const [availableOrders, setAvailableOrders] = useState([]);
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [stats, setStats] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");

  // Per-row loading
  const [acceptingOrderId, setAcceptingOrderId] = useState(null);
  const [rejectingOrderId, setRejectingOrderId] = useState(null);
  const [updatingDeliveryId, setUpdatingDeliveryId] = useState(null);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  // FAILED confirmation dialog
  const [failTarget, setFailTarget] = useState(null); // deliveryId | null
  const [failReason, setFailReason] = useState("");

  // Toast
  const [message, setMessage] = useState("");
  const messageTimer = useRef(null);

  // Polling
  const prevAvailableRef = useRef(0);
  const [lastUpdated, setLastUpdated] = useState(null);

  // SSE error tracking: stop after 30s of continuous failure
  const sseFailSinceRef = useRef(null);

  const showMsg = (msg) => {
    setMessage(msg);
    clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(""), 8000);
  };

  const token = localStorage.getItem("token");

  // ── Fetch rider profile ──
  const fetchRider = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/riders/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404) {
        setRider(null);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setRider(data.rider);
      }
    } catch {
      setError("Failed to load rider profile.");
    }
  };

  // ── Fetch available orders and my deliveries ──
  const fetchData = async (opts = {}) => {
    const { silent = false } = opts;
    try {
      if (!silent) {
        setDataLoading(true);
        setDataError("");
      }

      const [ordersRes, deliveriesRes, statsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/riders/available-orders`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${import.meta.env.VITE_API_URL}/riders/my-deliveries`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${import.meta.env.VITE_API_URL}/riders/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      let availableOrders = [];
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        availableOrders = ordersData.orders || [];
        setAvailableOrders(availableOrders);
      }
      if (deliveriesRes.ok) {
        const deliveriesData = await deliveriesRes.json();
        setMyDeliveries(deliveriesData.deliveries || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      setLastUpdated(new Date());
      return { availableOrders };
    } catch {
      if (!silent) setDataError("Failed to load data.");
      return null;
    } finally {
      if (!silent) setDataLoading(false);
    }
  };

  // ── Register rider profile ──
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!riderForm.vehicleType || !riderForm.phone) {
      showMsg("Please fill in vehicle type and phone.");
      return;
    }
    if (idType === "license" && (!riderForm.licensePlate || !riderForm.licenseNumber)) {
      showMsg("Please fill in license plate and license number.");
      return;
    }
    if (idType === "matric" && !riderForm.matricNumber) {
      showMsg("Please fill in your matriculation number.");
      return;
    }
    try {
      setRegistering(true);
      const body = {
        vehicleType: riderForm.vehicleType,
        phone: riderForm.phone,
      };
      if (idType === "license") {
        body.licensePlate = riderForm.licensePlate;
        body.licenseNumber = riderForm.licenseNumber;
      } else {
        body.matricNumber = riderForm.matricNumber;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/riders/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.message || "Registration failed.");
        return;
      }
      setRider(data.rider);
      showMsg("Rider profile created! 🎉");
    } catch {
      showMsg("Something went wrong. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  // ── Accept delivery ──
  const handleAccept = async (orderId) => {
    try {
      setAcceptingOrderId(orderId);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/deliveries/${orderId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.message || "Failed to accept order.");
        return;
      }
      showMsg(`Order #${orderId} accepted!`);
      // Refresh data
      await fetchData();
    } catch {
      showMsg("Something went wrong. Please try again.");
    } finally {
      setAcceptingOrderId(null);
    }
  };

  // ── Reject / skip an available order ──
  const handleReject = async (orderId) => {
    // Optimistic: hide from list immediately
    setAvailableOrders((prev) => prev.filter((o) => o.id !== orderId));
    try {
      setRejectingOrderId(orderId);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/riders/reject-order/${orderId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        // Rollback — refetch to restore correct state
        showMsg("Could not skip order. It may reappear on refresh.");
        await fetchData();
      }
    } catch {
      showMsg("Something went wrong. The order may reappear on refresh.");
    } finally {
      setRejectingOrderId(null);
    }
  };

  // ── Update delivery status ──
  const handleUpdateDeliveryStatus = async (deliveryId, newStatus, extra = {}) => {
    try {
      setUpdatingDeliveryId(deliveryId);
      const body = { status: newStatus, ...extra };
      const res = await fetch(`${import.meta.env.VITE_API_URL}/deliveries/${deliveryId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.message || "Failed to update status.");
        return;
      }
      const label = DELIVERY_STATUS[newStatus]?.label || newStatus;
      showMsg(`Delivery status updated to "${label}"`);
      await fetchData();
    } catch {
      showMsg("Something went wrong. Please try again.");
    } finally {
      setUpdatingDeliveryId(null);
    }
  };

  // ── Confirm and execute FAILED ──
  const confirmFail = async () => {
    const deliveryId = failTarget;
    setFailTarget(null);
    if (!deliveryId) return;
    const reason = failReason.trim() || undefined;
    setFailReason("");
    await handleUpdateDeliveryStatus(deliveryId, "FAILED", reason ? { reason } : {});
  };

  // ── Toggle availability ──
  const handleToggleAvailability = async () => {
    try {
      setTogglingAvailability(true);
      const newVal = !rider.isAvailable;
      const res = await fetch(`${import.meta.env.VITE_API_URL}/riders/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isAvailable: newVal }),
      });
      const data = await res.json();
      if (!res.ok) {
        showMsg(data.message || "Failed to update availability.");
        return;
      }
      setRider(data.rider);
      showMsg(newVal ? "You are now available for deliveries 🟢" : "You are now unavailable ⚫");
    } catch {
      showMsg("Something went wrong. Please try again.");
    } finally {
      setTogglingAvailability(false);
    }
  };

  // ── Initial load ──
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchRider();
      setLoading(false);
    };
    init();
  }, []);

  // Load data once rider is available
  useEffect(() => {
    if (rider) {
      fetchData();
    }
  }, [rider]);

  // ── SSE: real-time updates ──
  useEffect(() => {
    if (!rider) return;

    const es = new EventSource(
      `${import.meta.env.VITE_API_URL}/events?token=${encodeURIComponent(token)}`
    );

    es.onmessage = async () => {
      const result = await fetchData({ silent: true });
      if (result) {
        const currentAvailable = result.availableOrders.length;
        if (currentAvailable > prevAvailableRef.current) {
          const diff = currentAvailable - prevAvailableRef.current;
          showMsg(`🔔 ${diff} new order${diff > 1 ? "s" : ""} available!`);
          if (Notification.permission === "granted") {
            new Notification("New Order Available!", {
              body: `${diff} new order${diff > 1 ? "s" : ""} ready for pickup.`,
            });
          }
        }
        prevAvailableRef.current = currentAvailable;
      }
    };

    es.onerror = () => {
      if (!sseFailSinceRef.current) sseFailSinceRef.current = Date.now();
      if (Date.now() - sseFailSinceRef.current > 30_000) {
        es.close();
      }
    };

    es.onopen = () => {
      sseFailSinceRef.current = null; // reset — connection is back
    };

    return () => es.close();
  }, [rider, token]);

  // ── Request notification permission ──
  useEffect(() => {
    if (rider && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [rider]);

  // Derive sections
  const activeDelivery = myDeliveries.find((d) => ACTIVE_DELIVERY_STATUSES.includes(d.status)) || null;
  const pastDeliveries = myDeliveries.filter((d) => PAST_DELIVERY_STATUSES.includes(d.status));
  const [showHistory, setShowHistory] = useState(false);

  // ═════════════════════════════════════
  //  LOADING STATE
  // ═════════════════════════════════════
  if (loading) {
    return (
      <AppLayout desktopNavItems={RIDER_NAV} bottomNavItems={RIDER_NAV}>
        <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-12 pb-24">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-slate-200 rounded-lg" />
            <div className="h-4 w-64 bg-slate-200 rounded" />
            <div className="bg-white rounded-2xl p-6 space-y-4">
              <div className="h-6 w-32 bg-slate-200 rounded" />
              <div className="h-12 bg-slate-200 rounded-xl" />
              <div className="h-12 bg-slate-200 rounded-xl" />
              <div className="h-12 bg-slate-200 rounded-xl" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ═════════════════════════════════════
  //  NO RIDER PROFILE — registration form
  // ═════════════════════════════════════
  if (!loading && !error && !rider) {
    return (
      <AppLayout desktopNavItems={RIDER_NAV} bottomNavItems={RIDER_NAV}>
        <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-12 pb-24">
          {/* Welcome */}
          <div className="text-center mb-10">
            <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-5xl text-amber-500">two_wheeler</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome, {user?.name?.split(" ")[0] || "Rider"}!</h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Set up your rider profile to start accepting deliveries and earning money.
            </p>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full mt-4">
              <span className="material-symbols-outlined text-sm">shield_person</span>
              Delivery Rider
            </span>
          </div>

          {message && (
            <div className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 font-medium text-center">{message}</div>
          )}

          <form onSubmit={handleRegister} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Rider Profile</h3>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Vehicle Type</label>
              <select
                required
                value={riderForm.vehicleType}
                onChange={(e) => setRiderForm({ ...riderForm, vehicleType: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm bg-white"
              >
                <option value="">Select vehicle type...</option>
                <option value="Motorcycle">Motorcycle</option>
                <option value="Car">Car</option>
                <option value="Bicycle">Bicycle</option>
              </select>
            </div>
            {/* ID Type Toggle */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Identification</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIdType("license")}
                  className={`flex-1 h-12 rounded-xl border-2 text-sm font-semibold transition ${
                    idType === "license"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  🪪 License
                </button>
                <button
                  type="button"
                  onClick={() => setIdType("matric")}
                  className={`flex-1 h-12 rounded-xl border-2 text-sm font-semibold transition ${
                    idType === "matric"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  🎓 Student ID
                </button>
              </div>
            </div>

            {/* License fields */}
            {idType === "license" && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">License Plate</label>
                  <input
                    required
                    placeholder="e.g. ABC 123 XY"
                    value={riderForm.licensePlate}
                    onChange={(e) => setRiderForm({ ...riderForm, licensePlate: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">License Number</label>
                  <input
                    required
                    placeholder="e.g. DL-2024-12345"
                    value={riderForm.licenseNumber}
                    onChange={(e) => setRiderForm({ ...riderForm, licenseNumber: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                  />
                </div>
              </>
            )}

            {/* Matric number field */}
            {idType === "matric" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Matriculation Number</label>
                <input
                  required
                  placeholder="e.g. FPI/2024/12345"
                  value={riderForm.matricNumber}
                  onChange={(e) => setRiderForm({ ...riderForm, matricNumber: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number</label>
              <input
                required
                type="tel"
                placeholder="e.g. +234 812 345 6789"
                value={riderForm.phone}
                onChange={(e) => setRiderForm({ ...riderForm, phone: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={registering}
              className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]"
            >
              {registering ? "Creating..." : "Create Rider Profile"}
            </button>
          </form>
        </div>
      </AppLayout>
    );
  }

  // ═════════════════════════════════════
  //  MAIN DASHBOARD
  // ═════════════════════════════════════
  return (
    <>
    <AppLayout desktopNavItems={RIDER_NAV} bottomNavItems={RIDER_NAV}>
      <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-6 pb-24 md:pb-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Deliveries</h2>
            <p className="text-slate-500 text-sm">
              {rider?.vehicleType}
              {rider?.licensePlate ? ` • ${rider.licensePlate}` : ""}
              {rider?.matricNumber ? ` • ${rider.matricNumber}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Availability toggle */}
            <button
              onClick={handleToggleAvailability}
              disabled={togglingAvailability}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                rider?.isAvailable ? "bg-green-500" : "bg-slate-300"
              } ${togglingAvailability ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  rider?.isAvailable ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            {lastUpdated && (
              <p className="text-xs text-slate-400 hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        {/* Toast */}
        {message && (
          <div
            onClick={() => setMessage("")}
            className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 font-medium cursor-pointer flex items-center justify-between"
          >
            <span>{message}</span>
            <span className="material-symbols-outlined text-amber-400 text-lg">close</span>
          </div>
        )}

        {/* Data error */}
        {dataError && !dataLoading && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 font-medium mb-4 flex items-center justify-between">
            <span>{dataError}</span>
            <button onClick={fetchData} className="font-bold underline hover:text-red-700">Try again</button>
          </div>
        )}

        {/* ── Stats Card ── */}
        {stats && !dataLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Earnings</p>
              <p className="text-xl font-extrabold text-slate-900">₦{stats.totalEarnings.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Deliveries</p>
              <p className="text-xl font-extrabold text-slate-900">{stats.totalDeliveries}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">This Week</p>
              <p className="text-xl font-extrabold text-slate-900">₦{stats.thisWeekEarnings.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-1">Week Trips</p>
              <p className="text-xl font-extrabold text-slate-900">{stats.thisWeekDeliveries}</p>
            </div>
          </div>
        )}

        {/* Skeleton loading */}
        {dataLoading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5">
                <div className="h-5 w-32 bg-slate-200 rounded mb-3" />
                <div className="h-4 w-full bg-slate-200 rounded mb-2" />
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* ── Available Orders ── */}
        {!dataLoading && (
          <div className="space-y-6">
            {/* Available Orders Section */}
            {rider?.isAvailable ? (
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Available Orders
                {availableOrders.length > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {availableOrders.length}
                  </span>
                )}
              </h3>

              {availableOrders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">No available orders</p>
                  <p className="text-slate-400 text-xs mt-1">Check back soon for new delivery requests.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableOrders.map((order) => (
                    <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-amber-100">
                      <div className="px-5 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">Order #{order.id}</span>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ORDER_STATUS[order.status]?.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${ORDER_STATUS[order.status]?.dot}`} />
                              {ORDER_STATUS[order.status]?.label || order.status}
                            </span>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(order.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Restaurant */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="material-symbols-outlined text-amber-500 text-lg">storefront</span>
                          <span className="text-sm font-semibold text-slate-700">{order.restaurant?.name}</span>
                          {order.restaurant?.phone && (
                            <span className="text-xs text-slate-400">· {order.restaurant.phone}</span>
                          )}
                        </div>

                        {/* Items */}
                        <div className="text-sm text-slate-500 mb-3 space-y-0.5">
                          {order.orderItems?.map((item) => (
                            <p key={item.id}>
                              {item.quantity}x {item.menuItem?.name || "Item"}{" "}
                              <span className="text-slate-400">@ ₦{Number(item.unitPrice).toLocaleString()}</span>
                            </p>
                          ))}
                        </div>

                        {/* Customer */}
                        <div className="flex items-center gap-2 mb-3 text-sm text-slate-500">
                          <span className="material-symbols-outlined text-lg text-slate-400">person</span>
                          <span className="font-medium text-slate-700">{order.customer?.name || "Customer"}</span>
                          {order.customer?.phone && (
                            <span className="text-slate-400">· {order.customer.phone}</span>
                          )}
                        </div>

                        {/* Delivery address */}
                        <div className="flex items-start gap-2 mb-4 text-sm text-slate-500">
                          <span className="material-symbols-outlined text-lg text-slate-400">location_on</span>
                          <span>{order.deliveryAddress}</span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            ₦{Number(order.totalAmount).toLocaleString()}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleReject(order.id)}
                              disabled={rejectingOrderId === order.id || acceptingOrderId === order.id}
                              className="bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-500 border border-slate-200 text-sm font-semibold px-3 py-2.5 rounded-full transition active:scale-95"
                              title="Skip this order"
                            >
                              {rejectingOrderId === order.id ? (
                                "Skipping..."
                              ) : (
                                <span className="material-symbols-outlined text-base">close</span>
                              )}
                            </button>
                            <button
                              onClick={() => handleAccept(order.id)}
                              disabled={acceptingOrderId === order.id || rejectingOrderId === order.id}
                              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-bold px-6 py-2.5 rounded-full transition active:scale-95"
                            >
                              {acceptingOrderId === order.id ? "Accepting..." : "Accept Delivery"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-3">
                  <span className="material-symbols-outlined text-3xl text-slate-400">do_not_disturb</span>
                </div>
                <p className="text-sm font-medium text-slate-500">You are currently unavailable</p>
                <p className="text-xs text-slate-400 mt-1">Toggle availability to see new orders.</p>
              </div>
            )}

            {/* ── My Active Delivery ── */}
            <div>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${activeDelivery ? "bg-purple-500 animate-pulse" : "bg-slate-300"}`} />
                My Delivery
              </h3>

              {!activeDelivery ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-3xl text-slate-300">local_shipping</span>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">No active delivery</p>
                  <p className="text-slate-400 text-xs mt-1">Accept an available order to get started.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-purple-100">
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">Order #{activeDelivery.order?.id}</span>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DELIVERY_STATUS[activeDelivery.status]?.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${DELIVERY_STATUS[activeDelivery.status]?.dot}`} />
                          {DELIVERY_STATUS[activeDelivery.status]?.label}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(activeDelivery.createdAt).toLocaleString()}
                      </span>
                    </div>

                    {/* Restaurant + Customer */}
                    <div className="grid grid-cols-2 gap-3 mb-3 text-sm">
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-400 mb-0.5">Pickup</p>
                        <p className="font-semibold text-slate-800">{activeDelivery.order?.restaurant?.name}</p>
                        <p className="text-xs text-slate-500">{activeDelivery.order?.restaurant?.address}</p>
                        {activeDelivery.order?.restaurant?.phone && (
                          <p className="text-xs text-slate-500 mt-0.5">{activeDelivery.order.restaurant.phone}</p>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3">
                        <p className="text-xs text-slate-400 mb-0.5">Customer</p>
                        <p className="font-semibold text-slate-800">{activeDelivery.order?.customer?.name}</p>
                        {activeDelivery.order?.customer?.phone && (
                          <p className="text-xs text-slate-500">{activeDelivery.order.customer.phone}</p>
                        )}
                        <p className="text-xs text-slate-500">{activeDelivery.order?.deliveryAddress}</p>
                      </div>
                    </div>

                    {/* Items */}
                    <div className="text-sm text-slate-500 mb-4 space-y-0.5">
                      {activeDelivery.order?.orderItems?.map((item) => (
                        <p key={item.id}>
                          {item.quantity}x {item.menuItem?.name || "Item"}
                        </p>
                      ))}
                    </div>

                    {/* Total + ETA */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-bold text-slate-900">
                        Total: ₦{Number(activeDelivery.order?.totalAmount).toLocaleString()}
                      </span>
                      {(() => {
                        const [etaMin, etaMax] = estimateETA(rider?.vehicleType, activeDelivery.status);
                        return (
                          <span className="text-xs text-slate-400 font-medium">
                            ⏱ ~{etaMin}–{etaMax} min
                          </span>
                        );
                      })()}
                    </div>

                    {/* Status advancement buttons */}
                    <div className="flex flex-wrap gap-2">
                      {activeDelivery.status === "ZILLA_ON_IT" && (
                        <>
                          <button
                            onClick={() => handleUpdateDeliveryStatus(activeDelivery.id, "AT_KITCHEN")}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 text-white text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            {updatingDeliveryId === activeDelivery.id ? "Updating..." : "At Kitchen"}
                          </button>
                          <button
                            onClick={() => { setFailTarget(activeDelivery.id); setFailReason(""); }}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            Report Issue
                          </button>
                        </>
                      )}
                      {activeDelivery.status === "AT_KITCHEN" && (
                        <>
                          <button
                            onClick={() => handleUpdateDeliveryStatus(activeDelivery.id, "BAGGED")}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            {updatingDeliveryId === activeDelivery.id ? "Updating..." : "Bagged"}
                          </button>
                          <button
                            onClick={() => { setFailTarget(activeDelivery.id); setFailReason(""); }}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            Report Issue
                          </button>
                        </>
                      )}
                      {activeDelivery.status === "BAGGED" && (
                        <>
                          <button
                            onClick={() => handleUpdateDeliveryStatus(activeDelivery.id, "MOVING")}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 text-white text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            {updatingDeliveryId === activeDelivery.id ? "Updating..." : "Moving"}
                          </button>
                          <button
                            onClick={() => { setFailTarget(activeDelivery.id); setFailReason(""); }}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            Report Issue
                          </button>
                        </>
                      )}
                      {activeDelivery.status === "MOVING" && (
                        <>
                          <button
                            onClick={() => handleUpdateDeliveryStatus(activeDelivery.id, "CLOSE_BY")}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-pink-500 hover:bg-pink-600 disabled:bg-pink-300 text-white text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            {updatingDeliveryId === activeDelivery.id ? "Updating..." : "Close By"}
                          </button>
                          <button
                            onClick={() => { setFailTarget(activeDelivery.id); setFailReason(""); }}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            Report Issue
                          </button>
                        </>
                      )}
                      {activeDelivery.status === "CLOSE_BY" && (
                        <>
                          <button
                            onClick={() => handleUpdateDeliveryStatus(activeDelivery.id, "DELIVERED")}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            {updatingDeliveryId === activeDelivery.id ? "Updating..." : "Delivered"}
                          </button>
                          <button
                            onClick={() => { setFailTarget(activeDelivery.id); setFailReason(""); }}
                            disabled={updatingDeliveryId === activeDelivery.id}
                            className="bg-white hover:bg-red-50 text-red-600 border-2 border-red-200 text-sm font-bold px-4 py-2.5 rounded-full transition active:scale-95"
                          >
                            Report Issue
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── History ── */}
            {pastDeliveries.length > 0 && (
              <div>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between text-sm font-bold text-slate-500 uppercase tracking-wider mb-3"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-300" />
                    History ({pastDeliveries.length})
                  </span>
                  <span className={`material-symbols-outlined text-slate-400 transition ${showHistory ? "rotate-180" : ""}`}>
                    expand_more
                  </span>
                </button>

                {showHistory && (
                  <div className="space-y-3">
                    {pastDeliveries.map((delivery) => (
                      <div key={delivery.id} className="bg-white rounded-2xl shadow-sm overflow-hidden opacity-60">
                        <div className="px-5 py-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-slate-900">Order #{delivery.order?.id}</span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${DELIVERY_STATUS[delivery.status]?.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${DELIVERY_STATUS[delivery.status]?.dot}`} />
                                {DELIVERY_STATUS[delivery.status]?.label}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400">
                              {new Date(delivery.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span className="material-symbols-outlined text-base">storefront</span>
                            <span>{delivery.order?.restaurant?.name}</span>
                          </div>
                          {delivery.deliveredAt && (
                            <p className="text-xs text-slate-400 mt-1">
                              Delivered: {new Date(delivery.deliveredAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Error state (post-load) */}
            {!dataLoading && dataError && availableOrders.length === 0 && myDeliveries.length === 0 && (
              <div className="text-center py-12">
                <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Could not load data</h3>
                <p className="text-slate-500 text-sm mb-4">{dataError}</p>
                <button
                  onClick={fetchData}
                  className="rounded-full bg-amber-500 text-white font-semibold py-2.5 px-6 shadow-md hover:bg-amber-600 transition active:scale-95 text-sm"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>

    {/* ── FAILED Confirmation Dialog ── */}
    {failTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => { setFailTarget(null); setFailReason(""); }}
        />
        {/* Dialog */}
        <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl text-red-500">warning</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">Report Delivery Issue?</h3>
            <p className="text-sm text-slate-500 mt-1">
              This will release the order for another rider. The customer will be notified.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Reason (optional)
            </label>
            <textarea
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="e.g. Restaurant closed, customer unreachable..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none transition text-sm resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setFailTarget(null); setFailReason(""); }}
              className="flex-1 h-12 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition active:scale-95"
            >
              Cancel
            </button>
            <button
              onClick={confirmFail}
              className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition active:scale-95"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default RiderDashboard;
