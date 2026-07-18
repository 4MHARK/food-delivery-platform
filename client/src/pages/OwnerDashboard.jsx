import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AppLayout, { OWNER_NAV } from "../components/AppLayout";

const initialForm = { name: "", description: "", address: "", phone: "", imageUrl: "" };

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const [stats, setStats] = useState({ menuItems: null, orders: null });

  const fetchStats = async (ownedRestaurants) => {
    const token = localStorage.getItem("token");
    try {
      const results = await Promise.all(
        ownedRestaurants.map(async (r) => {
          const [menuRes, ordersRes] = await Promise.all([
            fetch(`${import.meta.env.VITE_API_URL}/restaurants/${r.id}/menu-items`),
            fetch(`${import.meta.env.VITE_API_URL}/restaurants/${r.id}/orders`, {
              headers: { Authorization: `Bearer ${token}` },
            }),
          ]);
          const menuData = menuRes.ok ? await menuRes.json() : { menuItems: [] };
          const ordersData = ordersRes.ok ? await ordersRes.json() : { orders: [] };
          return {
            menuCount: (menuData.menuItems || []).length,
            orderCount: (ordersData.orders || []).length,
          };
        })
      );
      setStats({
        menuItems: results.reduce((sum, r) => sum + r.menuCount, 0),
        orders: results.reduce((sum, r) => sum + r.orderCount, 0),
      });
    } catch {
      // stats are non-critical — leave null on failure
    }
  };

  const fetchRestaurants = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurants`);
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Failed to load"); return; }
      const owned = data.restaurants.filter((r) => r.ownerId === user?.id);
      setRestaurants(owned);
      if (owned.length > 0) fetchStats(owned);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRestaurants(); }, [user?.id]);

  const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name || !form.description || !form.address || !form.phone) {
      setFormError("All fields except image URL are required");
      return;
    }
    try {
      setCreating(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.message || "Failed to create restaurant"); return; }
      setForm(initialForm);
      setShowCreate(false);
      setFormError("");
      await fetchRestaurants();
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // ── LOADING ──
  if (loading) {
    return (
      <AppLayout desktopNavItems={OWNER_NAV} bottomNavItems={OWNER_NAV}>
        <div className="px-4 lg:px-8 max-w-4xl mx-auto pt-12 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="w-20 h-4 bg-slate-200 animate-pulse rounded mb-3" />
                <div className="w-12 h-8 bg-slate-200 animate-pulse rounded" />
              </div>
            ))}
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-6 mb-4">
              <div className="w-3/4 h-5 bg-slate-200 animate-pulse rounded mb-3" />
              <div className="w-1/2 h-4 bg-slate-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </AppLayout>
    );
  }

  // ── ERROR ──
  if (error) {
    return (
      <AppLayout desktopNavItems={OWNER_NAV} bottomNavItems={OWNER_NAV}>
        <div className="flex items-center justify-center px-4 pt-20">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Failed to load</h2>
            <p className="text-slate-500 mb-6">{error}</p>
            <button onClick={() => window.location.reload()} className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white hover:bg-amber-600 transition active:scale-95">
              Try again
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const hasRestaurants = restaurants.length > 0;

  return (
    <AppLayout desktopNavItems={OWNER_NAV} bottomNavItems={OWNER_NAV}>
      <div className="px-4 lg:px-8 max-w-4xl mx-auto pt-8 pb-24 md:pb-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Welcome back, {user?.name?.split(" ")[0] || "Chef"}</h2>
          <p className="text-slate-500 text-sm mt-1">
            {hasRestaurants ? "Manage your restaurant, menu, and orders." : "Get started by creating your first restaurant."}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full mt-3">
            <span className="material-symbols-outlined text-sm">shield_person</span>
            Restaurant Owner
          </span>
        </div>

        {/* Stats */}
        {hasRestaurants && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <span className="material-symbols-outlined text-3xl text-amber-500 mb-3">storefront</span>
              <p className="text-2xl font-bold text-slate-900">{restaurants.length}</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                {restaurants.length === 1 ? "Restaurant" : "Restaurants"}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <span className="material-symbols-outlined text-3xl text-blue-500 mb-3">menu_book</span>
              <p className="text-2xl font-bold text-slate-900">{stats.menuItems !== null ? stats.menuItems : "—"}</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Menu Items</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <span className="material-symbols-outlined text-3xl text-emerald-500 mb-3">receipt_long</span>
              <p className="text-2xl font-bold text-slate-900">{stats.orders !== null ? stats.orders : "—"}</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Orders</p>
            </div>
          </div>
        )}

        {/* Your Restaurants */}
        {hasRestaurants && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Your Restaurants</h3>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="text-sm font-semibold text-amber-500 hover:text-amber-600 transition flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-lg">{showCreate ? "close" : "add"}</span>
                {showCreate ? "Cancel" : "New"}
              </button>
            </div>

            <div className="space-y-3">
              {restaurants.map((r) => (
                <div key={r.id} className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between hover:shadow-md transition">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-amber-600">storefront</span>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{r.name}</h4>
                      <p className="text-xs text-slate-400 truncate max-w-[200px]">{r.address}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/dashboard/restaurant/${r.id}`)}
                    className="text-xs font-bold text-amber-500 hover:text-amber-600 transition px-4 py-2 rounded-full hover:bg-amber-50 active:scale-95"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Create Form */}
        {(!hasRestaurants || showCreate) && (
          <section className="mb-8">
            <h3 className="text-lg font-bold text-slate-900 mb-4">
              {hasRestaurants ? "Create New Restaurant" : "Create Your First Restaurant"}
            </h3>

            {formError && (
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">{formError}</p>
            )}

            <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">Restaurant Name</label>
                <input type="text" id="name" name="name" required placeholder="e.g. Pepperoni Palace" value={form.name} onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm" />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
                <textarea id="description" name="description" required rows={3} placeholder="Tell customers what makes your restaurant special..." value={form.description} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="address" className="block text-sm font-semibold text-slate-700 mb-1.5">Address</label>
                  <input type="text" id="address" name="address" required placeholder="e.g. 456 Oak Ave" value={form.address} onChange={handleChange}
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm" />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5">Phone</label>
                  <input type="text" id="phone" name="phone" required placeholder="e.g. 555-1234" value={form.phone} onChange={handleChange}
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor="imageUrl" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Image URL <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input type="text" id="imageUrl" name="imageUrl" placeholder="https://example.com/your-image.jpg" value={form.imageUrl} onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm" />
              </div>
              <button type="submit" disabled={creating}
                className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]">
                {creating ? "Creating..." : "Create Restaurant"}
              </button>
            </form>
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default OwnerDashboard;
