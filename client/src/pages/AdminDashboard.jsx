import { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";

const ADMIN_NAV = [
  { icon: "admin_panel_settings", label: "Admin", path: "/admin" },
];

const SECTIONS = [
  { key: "overview", label: "Overview", icon: "dashboard" },
  { key: "riders", label: "Riders", icon: "two_wheeler" },
  { key: "restaurants", label: "Restaurants", icon: "storefront" },
  { key: "customers", label: "Customers", icon: "group" },
  { key: "orders", label: "Orders", icon: "receipt_long" },
  { key: "payments", label: "Payments", icon: "payments" },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const sections = isSuperAdmin
    ? [...SECTIONS, { key: "campuses", label: "Campuses", icon: "apartment" }]
    : SECTIONS;

  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scope, setScope] = useState(null);

  useEffect(() => {
    api.get("/admin/me").then((data) => setScope(data)).catch(() => {});
  }, []);

  const scopeLabel = scope
    ? scope.role === "SUPER_ADMIN"
      ? "Global · All campuses"
      : scope.campusName || "Your campus"
    : "";

  return (
    <AppLayout desktopNavItems={ADMIN_NAV} bottomNavItems={ADMIN_NAV}>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ── Desktop Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-56 border-r border-slate-200 bg-white shrink-0">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Panel</p>
            {scopeLabel && (
              <p className="mt-1.5 text-[11px] font-semibold text-amber-600 truncate">{scopeLabel}</p>
            )}
          </div>
          <nav className="flex-1 py-2 space-y-0.5 px-2">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                  activeSection === s.key
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="material-symbols-outlined text-lg">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Mobile sidebar toggle ── */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-56 bg-white border-r border-slate-200 h-full flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin</p>
                  <button onClick={() => setSidebarOpen(false)} className="material-symbols-outlined text-slate-400">close</button>
                </div>
                {scopeLabel && (
                  <p className="mt-1.5 text-[11px] font-semibold text-amber-600 truncate">{scopeLabel}</p>
                )}
              </div>
              <nav className="flex-1 py-2 space-y-0.5 px-2">
                {sections.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => { setActiveSection(s.key); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition ${
                      activeSection === s.key
                        ? "bg-slate-900 text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{s.icon}</span>
                    {s.label}
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto">
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
            <button onClick={() => setSidebarOpen(true)} className="material-symbols-outlined text-slate-600">menu</button>
            <span className="text-sm font-bold text-slate-900">
              {sections.find((s) => s.key === activeSection)?.label}
            </span>
          </div>

          <div className="p-4 lg:p-8 max-w-5xl">
            {activeSection === "overview" && <OverviewSection />}
            {activeSection === "riders" && <RidersSection />}
            {activeSection === "restaurants" && <RestaurantsSection />}
            {activeSection === "customers" && <ComingSoon title="Customers" />}
            {activeSection === "orders" && <ComingSoon title="Orders" />}
            {activeSection === "payments" && <ComingSoon title="Payments" />}
            {activeSection === "campuses" && <CampusesSection />}
          </div>
        </main>
      </div>
    </AppLayout>
  );
};

// ══════════════════════════════════════════════
//  OVERVIEW SECTION
// ══════════════════════════════════════════════
const OverviewSection = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/admin/overview");
      setOverview(data.overview);
    } catch (err) {
      setError(err.message || "Failed to load overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOverview(); }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-red-400">error_outline</span>
        </div>
        <p className="text-slate-900 font-semibold mb-2">Failed to load overview</p>
        <p className="text-slate-500 text-sm mb-4">{error}</p>
        <button onClick={fetchOverview} className="text-amber-500 font-semibold text-sm hover:text-amber-600">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Platform Overview</h2>
        <p className="text-sm text-slate-500 mt-1">High-level metrics across the platform.</p>
      </div>

      {overview && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={overview.totalUsers} color="bg-blue-50 text-blue-700" />
            <StatCard label="Total Orders" value={overview.totalOrders} color="bg-purple-50 text-purple-700" />
            <StatCard label="Riders" value={overview.totalRiders} color="bg-amber-50 text-amber-700" />
            <StatCard label="Restaurants" value={overview.totalRestaurants} color="bg-green-50 text-green-700" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Recent Orders</h3>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="divide-y divide-slate-50">
                {overview.recentOrders.map((o) => (
                  <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        #{o.id} · {o.restaurant}
                      </p>
                      <p className="text-xs text-slate-400">{o.customer} · {new Date(o.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-900">{formatCurrency(o.totalAmount)}</span>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatCard = ({ label, value, color }) => (
  <div className={`rounded-2xl p-5 ${color} bg-opacity-10`}>
    <p className="text-xs font-semibold opacity-70 uppercase tracking-wider mb-1">{label}</p>
    <p className="text-3xl font-extrabold">{value}</p>
  </div>
);

// ══════════════════════════════════════════════
//  RIDERS SECTION (fully functional)
// ══════════════════════════════════════════════
const RidersSection = () => {
  const [riders, setRiders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState(null);
  const [suspendingId, setSuspendingId] = useState(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success"); // "success" | "error"
  const [confirmRevokeId, setConfirmRevokeId] = useState(null);

  const fetchRiders = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/admin/riders");
      setRiders(data.riders);
    } catch (err) {
      setError(err.message || "Failed to load riders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRiders(); }, []);

  const handleToggleVerify = async (riderId) => {
    try {
      setTogglingId(riderId);
      const data = await api.put(`/admin/riders/${riderId}/verify`);

      setRiders((prev) =>
        prev.map((r) =>
          r.id === riderId ? { ...r, isVerified: !r.isVerified } : r
        )
      );
      setMessage(data.message);
      setMessageType("success");
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setMessage(err.message || "Failed to update rider.");
      setMessageType("error");
      setTimeout(() => setMessage(""), 4000);
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleSuspend = async (riderId) => {
    try {
      setSuspendingId(riderId);
      const data = await api.put(`/admin/riders/${riderId}/suspend`);

      setRiders((prev) =>
        prev.map((r) =>
          r.id === riderId ? { ...r, isSuspended: !r.isSuspended } : r
        )
      );
      setMessage(data.message);
      setMessageType("success");
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setMessage(err.message || "Failed to update rider.");
      setMessageType("error");
      setTimeout(() => setMessage(""), 4000);
    } finally {
      setSuspendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-40 bg-slate-200 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-red-400">error_outline</span>
        </div>
        <p className="text-slate-900 font-semibold mb-2">Failed to load riders</p>
        <p className="text-slate-500 text-sm mb-4">{error}</p>
        <button onClick={fetchRiders} className="text-amber-500 font-semibold text-sm hover:text-amber-600">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Riders</h2>
          <p className="text-sm text-slate-500 mt-1">
            {riders.length} rider{riders.length !== 1 ? "s" : ""} · Approve or revoke delivery access.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            messageType === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {riders.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl text-slate-300">two_wheeler</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">No riders registered yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {riders.map((rider) => (
            <div key={rider.id} className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{rider.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rider.isVerified
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${rider.isVerified ? "bg-green-500" : "bg-red-500"}`} />
                      {rider.isVerified ? "Verified" : "Unverified"}
                    </span>
                    {rider.isAvailable && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Available
                      </span>
                    )}
                    {rider.isSuspended && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                        <span className="w-1.5 h-1.5 rounded-full bg-white" />
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{rider.email} · {rider.phone}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>{rider.vehicleType}</span>
                    {rider.licensePlate && <span>Plate: {rider.licensePlate}</span>}
                    {rider.licenseNumber && <span>License: {rider.licenseNumber}</span>}
                    {rider.matricNumber && <span>Matric: {rider.matricNumber}</span>}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs text-slate-400">
                    <span>{rider.totalDeliveries} deliveries</span>
                    <span>{rider.completedDeliveries} completed</span>
                    {rider.failedDeliveries > 0 && (
                      <span className="text-red-500">{rider.failedDeliveries} failed</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                {confirmRevokeId === rider.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setConfirmRevokeId(null)}
                      className="px-3 py-2 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => { handleToggleVerify(rider.id); setConfirmRevokeId(null); }}
                      disabled={togglingId === rider.id}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300 transition active:scale-95"
                    >
                      {togglingId === rider.id ? "Revoking..." : "Confirm Revoke"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() =>
                      rider.isVerified
                        ? setConfirmRevokeId(rider.id)
                        : handleToggleVerify(rider.id)
                    }
                    disabled={togglingId === rider.id}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition active:scale-95 ${
                      rider.isVerified
                        ? "bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                        : "bg-green-600 hover:bg-green-700 text-white disabled:bg-green-300"
                    }`}
                  >
                    {togglingId === rider.id && !rider.isVerified
                      ? "Updating..."
                      : rider.isVerified
                        ? "Revoke"
                        : "Approve"}
                  </button>
                )}
                <button
                  onClick={() => handleToggleSuspend(rider.id)}
                  disabled={suspendingId === rider.id}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition active:scale-95 ${
                    rider.isSuspended
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white disabled:bg-emerald-300"
                      : "bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  }`}
                >
                  {suspendingId === rider.id ? "Updating..." : rider.isSuspended ? "Unsuspend" : "Suspend"}
                </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════
//  RESTAURANTS SECTION (approval / reject / suspend)
// ══════════════════════════════════════════════
const STATUS_STYLE = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  SUSPENDED: "bg-slate-200 text-slate-700",
};

const RestaurantsSection = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [updatingId, setUpdatingId] = useState(null);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/admin/restaurants");
      setRestaurants(data.restaurants);
    } catch (err) {
      setError(err.message || "Failed to load restaurants.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(); }, []);

  const handleSetStatus = async (restaurantId, status) => {
    try {
      setUpdatingId(restaurantId);
      await api.put(`/admin/restaurants/${restaurantId}/status`, { status });
      setRestaurants((prev) =>
        prev.map((r) => (r.id === restaurantId ? { ...r, approvalStatus: status } : r))
      );
      setMessage(`Restaurant ${status.toLowerCase()}.`);
      setMessageType("success");
      setTimeout(() => setMessage(""), 4000);
    } catch (err) {
      setMessage(err.message || "Failed to update restaurant.");
      setMessageType("error");
      setTimeout(() => setMessage(""), 4000);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-40 bg-slate-200 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-red-400">error_outline</span>
        </div>
        <p className="text-slate-900 font-semibold mb-2">Failed to load restaurants</p>
        <p className="text-slate-500 text-sm mb-4">{error}</p>
        <button onClick={fetchRestaurants} className="text-amber-500 font-semibold text-sm hover:text-amber-600">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Restaurants</h2>
        <p className="text-sm text-slate-500 mt-1">
          {restaurants.length} restaurant{restaurants.length !== 1 ? "s" : ""} · Approve, reject or suspend.
        </p>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            messageType === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {restaurants.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl text-slate-300">storefront</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">No restaurants in your campus yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {restaurants.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{r.name}</h3>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        STATUS_STYLE[r.approvalStatus] || "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {r.approvalStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{r.address} · {r.ownerName}</p>
                  <div className="flex gap-3 text-xs text-slate-500">
                    <span>{r.menuItemCount} menu items</span>
                    <span>{r.orderCount} orders</span>
                  </div>
                </div>

                <div className="shrink-0 flex flex-wrap gap-2 justify-end">
                  {r.approvalStatus !== "APPROVED" && (
                    <button
                      onClick={() => handleSetStatus(r.id, "APPROVED")}
                      disabled={updatingId === r.id}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-green-600 hover:bg-green-700 text-white disabled:bg-green-300 transition active:scale-95"
                    >
                      Approve
                    </button>
                  )}
                  {r.approvalStatus !== "REJECTED" && (
                    <button
                      onClick={() => handleSetStatus(r.id, "REJECTED")}
                      disabled={updatingId === r.id}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-white border-2 border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition active:scale-95"
                    >
                      Reject
                    </button>
                  )}
                  {r.approvalStatus !== "SUSPENDED" && (
                    <button
                      onClick={() => handleSetStatus(r.id, "SUSPENDED")}
                      disabled={updatingId === r.id}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition active:scale-95"
                    >
                      Suspend
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════
//  CAMPUSES SECTION (super admin only)
// ══════════════════════════════════════════════
const CampusesSection = () => {
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [campusName, setCampusName] = useState("");
  const [campusAddress, setCampusAddress] = useState("");

  const [adminFor, setAdminFor] = useState(null);
  const [adminFields, setAdminFields] = useState({ name: "", email: "", password: "" });
  const [assigning, setAssigning] = useState(false);

  const flash = (msg, type = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 4000);
  };

  const fetchCampuses = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await api.get("/admin/campuses");
      setCampuses(data.campuses);
    } catch (err) {
      setError(err.message || "Failed to load campuses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampuses(); }, []);

  const handleCreateCampus = async (e) => {
    e.preventDefault();
    if (!campusName.trim()) return;
    try {
      setCreating(true);
      await api.post("/admin/campuses", { name: campusName.trim(), address: campusAddress.trim() });
      setCampusName("");
      setCampusAddress("");
      setShowCreate(false);
      flash("Campus created.");
      fetchCampuses();
    } catch (err) {
      flash(err.message || "Failed to create campus.", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleAssignAdmin = async (e) => {
    e.preventDefault();
    const { name, email, password } = adminFields;
    if (!name || !email || !password || !adminFor) return;
    try {
      setAssigning(true);
      await api.post(`/admin/campuses/${adminFor.id}/admins`, { name, email, password });
      setAdminFor(null);
      setAdminFields({ name: "", email: "", password: "" });
      flash(`School admin created for ${adminFor.name}.`);
    } catch (err) {
      flash(err.message || "Failed to create school admin.", "error");
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-40 bg-slate-200 rounded" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl text-red-400">error_outline</span>
        </div>
        <p className="text-slate-900 font-semibold mb-2">Failed to load campuses</p>
        <p className="text-slate-500 text-sm mb-4">{error}</p>
        <button onClick={fetchCampuses} className="text-amber-500 font-semibold text-sm hover:text-amber-600">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Campuses</h2>
          <p className="text-sm text-slate-500 mt-1">
            Each campus is an isolated school tenant with its own restaurants and riders.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="shrink-0 px-4 py-2 rounded-full text-sm font-bold bg-slate-900 text-white hover:bg-slate-700 transition active:scale-95"
        >
          + New Campus
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            messageType === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-green-50 border-green-200 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      {showCreate && (
        <form onSubmit={handleCreateCampus} className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
          <p className="text-sm font-bold text-slate-900">Create a campus</p>
          <input
            type="text"
            placeholder="Campus name (e.g. University of Lagos)"
            value={campusName}
            onChange={(e) => setCampusName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <input
            type="text"
            placeholder="Address (optional)"
            value={campusAddress}
            onChange={(e) => setCampusAddress(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <button
            type="submit"
            disabled={creating || !campusName.trim()}
            className="px-4 py-2 rounded-full text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-300 transition active:scale-95"
          >
            {creating ? "Creating..." : "Create Campus"}
          </button>
        </form>
      )}

      {campuses.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-3xl text-slate-300">apartment</span>
          </div>
          <p className="text-slate-500 text-sm font-medium">No campuses yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campuses.map((campus) => (
            <div key={campus.id} className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">{campus.name}</h3>
                  {campus.address && <p className="text-xs text-slate-400 mt-0.5">{campus.address}</p>}
                  <div className="flex gap-3 mt-2 text-xs text-slate-500">
                    <span>{campus.restaurantCount} restaurant{campus.restaurantCount !== 1 ? "s" : ""}</span>
                    <span>{campus.riderCount} rider{campus.riderCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setAdminFor(campus); setAdminFields({ name: "", email: "", password: "" }); }}
                  className="shrink-0 px-4 py-2 rounded-full text-xs font-bold bg-slate-900 text-white hover:bg-slate-700 transition active:scale-95"
                >
                  Add School Admin
                </button>
              </div>

              {adminFor?.id === campus.id && (
                <form onSubmit={handleAssignAdmin} className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <p className="text-sm font-bold text-slate-900">Create a school admin for {campus.name}</p>
                  <input
                    type="text"
                    placeholder="Admin name"
                    value={adminFields.name}
                    onChange={(e) => setAdminFields({ ...adminFields, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="email"
                    placeholder="Admin email"
                    value={adminFields.email}
                    onChange={(e) => setAdminFields({ ...adminFields, email: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    type="password"
                    placeholder="Temporary password"
                    value={adminFields.password}
                    onChange={(e) => setAdminFields({ ...adminFields, password: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={assigning}
                      className="px-4 py-2 rounded-full text-sm font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:bg-amber-300 transition active:scale-95"
                    >
                      {assigning ? "Creating..." : "Create Admin"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdminFor(null)}
                      className="px-4 py-2 rounded-full text-sm font-bold text-slate-500 hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════
//  COMING SOON PLACEHOLDER
// ══════════════════════════════════════════════
const ComingSoon = ({ title }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500 mt-1">Manage {title.toLowerCase()} on the platform.</p>
    </div>
    <div className="text-center py-20">
      <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-5">
        <span className="material-symbols-outlined text-4xl text-slate-300">construction</span>
      </div>
      <h3 className="text-lg font-bold text-slate-400 mb-2">Coming Soon</h3>
      <p className="text-sm text-slate-400 max-w-sm mx-auto">
        The {title.toLowerCase()} management section is under development and will be available in a future update.
      </p>
    </div>
  </div>
);

export default AdminDashboard;
