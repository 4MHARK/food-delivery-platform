import { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";

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
  const [activeSection, setActiveSection] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AppLayout desktopNavItems={ADMIN_NAV} bottomNavItems={ADMIN_NAV}>
      <div className="flex h-[calc(100vh-4rem)]">
        {/* ── Desktop Sidebar ── */}
        <aside className="hidden lg:flex flex-col w-56 border-r border-slate-200 bg-white shrink-0">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin Panel</p>
          </div>
          <nav className="flex-1 py-2 space-y-0.5 px-2">
            {SECTIONS.map((s) => (
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
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Admin</p>
                <button onClick={() => setSidebarOpen(false)} className="material-symbols-outlined text-slate-400">close</button>
              </div>
              <nav className="flex-1 py-2 space-y-0.5 px-2">
                {SECTIONS.map((s) => (
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
              {SECTIONS.find((s) => s.key === activeSection)?.label}
            </span>
          </div>

          <div className="p-4 lg:p-8 max-w-5xl">
            {activeSection === "overview" && <OverviewSection />}
            {activeSection === "riders" && <RidersSection />}
            {activeSection === "restaurants" && <ComingSoon title="Restaurants" />}
            {activeSection === "customers" && <ComingSoon title="Customers" />}
            {activeSection === "orders" && <ComingSoon title="Orders" />}
            {activeSection === "payments" && <ComingSoon title="Payments" />}
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
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
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
                      <span className="text-sm font-bold text-slate-900">₦{o.totalAmount.toLocaleString()}</span>
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
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success"); // "success" | "error"
  const [confirmRevokeId, setConfirmRevokeId] = useState(null);

  const token = localStorage.getItem("token");

  const fetchRiders = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/riders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
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
      const res = await fetch(`${import.meta.env.VITE_API_URL}/admin/riders/${riderId}/verify`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

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

                {confirmRevokeId === rider.id ? (
                  <div className="shrink-0 flex items-center gap-2">
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
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition active:scale-95 ${
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
              </div>
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
