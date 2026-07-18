import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { icon: "home", label: "Home", path: "/restaurants" },
  { icon: "receipt_long", label: "Orders", path: "/orders" },
  { icon: "favorite", label: "Favorites", path: "/favorites" },
  { icon: "person", label: "Profile", path: "/profile" },
];

const initialForm = {
  name: "",
  description: "",
  address: "",
  phone: "",
  imageUrl: "",
};

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  const fetchRestaurants = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurants`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Failed to load");
        return;
      }
      const mine = data.restaurants.filter((r) => r.ownerId === user?.id);
      setRestaurants(mine);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, [user?.id]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.message || "Failed to create restaurant");
        return;
      }

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

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-50 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16 max-w-7xl mx-auto">
            <div className="w-32 h-6 bg-slate-200 animate-pulse rounded" />
            <div className="hidden md:flex gap-2">
              {[80, 80, 80, 80].map((w, i) => (
                <div key={i} className="h-8 rounded-xl bg-slate-200 animate-pulse" style={{ width: w }} />
              ))}
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </header>
        <main className="px-4 lg:px-8 max-w-4xl mx-auto pt-12 pb-24">
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
        </main>
      </div>
    );
  }

  // ── ERROR ──
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Failed to load</h2>
          <p className="text-slate-500 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white hover:bg-amber-600 transition active:scale-95"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasRestaurants = restaurants.length > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-8 h-16 max-w-7xl mx-auto">
          <button
            onClick={() => navigate("/restaurants")}
            className="text-2xl font-extrabold text-amber-500 tracking-tight"
          >
            Chow<span className="text-slate-900">Zilla</span>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 transition"
            >
              Dashboard
            </button>
            {NAV_ITEMS.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/cart")}
              className="relative p-2 text-slate-600 hover:text-amber-500 hover:bg-slate-100 rounded-full transition"
            >
              <span className="material-symbols-outlined">shopping_bag</span>
            </button>

            <div className="relative group hidden md:block">
              <button className="flex items-center gap-2 rounded-full p-1.5 pr-3 hover:bg-slate-100 transition">
                <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold">
                  {userInitial}
                </div>
                <span className="text-sm font-semibold text-slate-700 hidden lg:block max-w-[100px] truncate">
                  {user?.name || "Owner"}
                </span>
              </button>
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg border border-slate-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-400">{user?.email}</p>
                </div>
                <button
                  onClick={() => navigate("/profile")}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                >
                  <span className="material-symbols-outlined text-slate-400 text-xl">person</span>
                  View Profile
                </button>
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition font-medium"
                  >
                    <span className="material-symbols-outlined text-xl">logout</span>
                    Log out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 lg:px-8 max-w-4xl mx-auto pt-8 pb-24 md:pb-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">
            Welcome back, {user?.name?.split(" ")[0] || "Chef"}
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {hasRestaurants
              ? "Manage your restaurant, menu, and orders."
              : "Get started by creating your first restaurant."}
          </p>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full mt-3">
            <span className="material-symbols-outlined text-sm">shield_person</span>
            Restaurant Owner
          </span>
        </div>

        {/* Stats — only when restaurants exist */}
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
              <p className="text-2xl font-bold text-slate-900">—</p>
              <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">Menu Items</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <span className="material-symbols-outlined text-3xl text-emerald-500 mb-3">receipt_long</span>
              <p className="text-2xl font-bold text-slate-900">—</p>
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
                <div
                  key={r.id}
                  className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between hover:shadow-md transition"
                >
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
              <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">
                {formError}
              </p>
            )}

            <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  placeholder="e.g. Pepperoni Palace"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={3}
                  placeholder="Tell customers what makes your restaurant special..."
                  value={form.description}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="address" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Address
                  </label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    required
                    placeholder="e.g. 456 Oak Ave"
                    value={form.address}
                    onChange={handleChange}
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Phone
                  </label>
                  <input
                    type="text"
                    id="phone"
                    name="phone"
                    required
                    placeholder="e.g. 555-1234"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="imageUrl" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Image URL <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  id="imageUrl"
                  name="imageUrl"
                  placeholder="https://example.com/your-image.jpg"
                  value={form.imageUrl}
                  onChange={handleChange}
                  className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]"
              >
                {creating ? "Creating..." : "Create Restaurant"}
              </button>
            </form>
          </section>
        )}

        {/* Empty state — show when already viewing form */}
        {!hasRestaurants && !showCreate && (
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl text-slate-300">storefront</span>
            </div>
            <p className="text-slate-500 text-sm">Fill out the form above to create your first restaurant.</p>
          </div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-white rounded-t-xl shadow-[0_-4px_20px_rgba(15,23,42,0.05)]">
        {[
          { icon: "dashboard", label: "Dashboard", path: "/dashboard" },
          ...NAV_ITEMS.slice(0, 3),
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center px-4 py-1 rounded-2xl transition ${
              location.pathname === tab.path
                ? "bg-amber-100 text-amber-700"
                : "text-slate-400 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
            <span className="text-xs font-semibold mt-1">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default OwnerDashboard;
