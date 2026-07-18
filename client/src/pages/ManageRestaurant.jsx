import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { icon: "home", label: "Home", path: "/restaurants" },
  { icon: "receipt_long", label: "Orders", path: "/orders" },
  { icon: "favorite", label: "Favorites", path: "/favorites" },
  { icon: "person", label: "Profile", path: "/profile" },
];

const PLACEHOLDER_IMAGE = "";

const ManageRestaurant = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  // Restaurant state
  const [restaurant, setRestaurant] = useState(null);
  const [restForm, setRestForm] = useState({ name: "", description: "", address: "", phone: "", imageUrl: "" });
  const [savingRest, setSavingRest] = useState(false);
  const [restEditOpen, setRestEditOpen] = useState(false);

  // Menu items state
  const [menuItems, setMenuItems] = useState([]);
  const [menuForm, setMenuForm] = useState({ name: "", description: "", price: "", category: "", imageUrl: "" });
  const [editingItem, setEditingItem] = useState(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [savingMenu, setSavingMenu] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Global
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const token = localStorage.getItem("token");
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  const refetchMenu = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}/menu-items`);
      const data = await res.json();
      if (res.ok) setMenuItems(data.menuItems || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [restRes, menuRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}`),
          fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}/menu-items`),
        ]);
        const restData = await restRes.json();
        const menuData = await menuRes.json();

        if (!restRes.ok) { setError(restData.message || "Restaurant not found"); return; }
        if (restData.restaurant.ownerId !== user?.id) { setError("You do not own this restaurant"); return; }

        setRestaurant(restData.restaurant);
        setRestForm({
          name: restData.restaurant.name || "",
          description: restData.restaurant.description || "",
          address: restData.restaurant.address || "",
          phone: restData.restaurant.phone || "",
          imageUrl: restData.restaurant.imageUrl || "",
        });
        setMenuItems(menuRes.ok ? menuData.menuItems || [] : []);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const showMsg = (msg) => { setMessage(msg); setTimeout(() => setMessage(""), 3000); };

  // Update restaurant
  const handleUpdateRestaurant = async (e) => {
    e.preventDefault();
    try {
      setSavingRest(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(restForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      setRestaurant((prev) => ({ ...prev, ...restForm }));
      setRestEditOpen(false);
      showMsg("Restaurant updated successfully");
    } catch {
      setError("Failed to update restaurant");
    } finally {
      setSavingRest(false);
    }
  };

  // Add menu item
  const handleAddMenuItem = async (e) => {
    e.preventDefault();
    if (!menuForm.name || !menuForm.price || !menuForm.category) {
      setError("Name, price, and category are required");
      return;
    }
    try {
      setSavingMenu(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}/menu-items`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ ...menuForm, price: Number(menuForm.price) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      await refetchMenu();
      setMenuForm({ name: "", description: "", price: "", category: "", imageUrl: "" });
      setShowAddMenu(false);
      showMsg("Menu item added");
    } catch {
      setError("Failed to add menu item");
    } finally {
      setSavingMenu(false);
    }
  };

  // Update menu item
  const handleUpdateMenuItem = async (e) => {
    e.preventDefault();
    try {
      setSavingMenu(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/menu-items/${editingItem.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({
          name: editingItem.name,
          description: editingItem.description,
          price: Number(editingItem.price),
          category: editingItem.category,
          imageUrl: editingItem.imageUrl || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message); return; }
      await refetchMenu();
      setEditingItem(null);
      showMsg("Menu item updated");
    } catch {
      setError("Failed to update menu item");
    } finally {
      setSavingMenu(false);
    }
  };

  // Delete menu item
  const handleDeleteMenuItem = async (itemId) => {
    if (!window.confirm("Delete this item?")) return;
    try {
      setDeletingId(itemId);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/menu-items/${itemId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) { const d = await res.json(); setError(d.message); return; }
      await refetchMenu();
      showMsg("Menu item deleted");
    } catch {
      setError("Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="sticky top-0 z-50 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16 max-w-7xl mx-auto">
            <div className="w-32 h-6 bg-slate-200 animate-pulse rounded" />
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </header>
        <main className="px-4 lg:px-8 max-w-3xl mx-auto pt-8 pb-24">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-6 mb-4 space-y-3">
              <div className="w-1/2 h-5 bg-slate-200 animate-pulse rounded" />
              <div className="w-full h-10 bg-slate-200 animate-pulse rounded-xl" />
              <div className="w-3/4 h-10 bg-slate-200 animate-pulse rounded-xl" />
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
          <h2 className="text-xl font-bold text-slate-900 mb-2">{error}</h2>
          <button onClick={() => navigate("/dashboard")} className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white hover:bg-amber-600 transition active:scale-95 mt-4">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-8 h-16 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="p-2 -ml-2 text-slate-600 hover:text-amber-500 rounded-full hover:bg-slate-100 transition">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <button onClick={() => navigate("/restaurants")} className="text-xl font-extrabold text-amber-500 tracking-tight hidden sm:block">
              Chow<span className="text-slate-900">Zilla</span>
            </button>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            <button onClick={() => navigate("/dashboard")} className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-50 text-amber-700 transition">
              Dashboard
            </button>
            {NAV_ITEMS.map((item) => (
              <button key={item.path} onClick={() => navigate(item.path)} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition">
                {item.label}
              </button>
            ))}
          </nav>

          <button onClick={() => navigate("/profile")} className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold">
            {userInitial}
          </button>
        </div>
      </header>

      <main className="px-4 lg:px-8 max-w-3xl mx-auto pt-6 pb-24 md:pb-8">
        {/* Toast message */}
        {message && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-6 py-3 rounded-full shadow-lg animate-fade-up">
            {message}
          </div>
        )}

        {/* Restaurant info card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{restaurant?.name}</h2>
              <p className="text-sm text-slate-500 mt-0.5">{restaurant?.address} · {restaurant?.phone}</p>
            </div>
            <button
              onClick={() => setRestEditOpen(!restEditOpen)}
              className={`text-xs font-bold px-4 py-2 rounded-full transition ${
                restEditOpen ? "bg-slate-100 text-slate-600" : "bg-amber-500 text-white hover:bg-amber-600"
              }`}
            >
              {restEditOpen ? "Cancel" : "Edit"}
            </button>
          </div>

          {!restEditOpen && (
            <p className="text-sm text-slate-600 leading-relaxed">{restaurant?.description}</p>
          )}

          {restEditOpen && (
            <form onSubmit={handleUpdateRestaurant} className="space-y-4 border-t border-slate-100 pt-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
                <input value={restForm.name} onChange={(e) => setRestForm({ ...restForm, name: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                <textarea value={restForm.description} onChange={(e) => setRestForm({ ...restForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Address</label>
                  <input value={restForm.address} onChange={(e) => setRestForm({ ...restForm, address: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Phone</label>
                  <input value={restForm.phone} onChange={(e) => setRestForm({ ...restForm, phone: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Image URL</label>
                <input value={restForm.imageUrl} onChange={(e) => setRestForm({ ...restForm, imageUrl: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
              </div>
              <button type="submit" disabled={savingRest} className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]">
                {savingRest ? "Saving..." : "Save Changes"}
              </button>
            </form>
          )}
        </div>

        {/* Menu Items */}
        <section className="mb-6">
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
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Name *</label>
                  <input value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="e.g. Pepperoni Pizza" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Category *</label>
                  <input value={menuForm.category} onChange={(e) => setMenuForm({ ...menuForm, category: e.target.value })} placeholder="e.g. Main Course" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Price (₦) *</label>
                  <input type="number" step="0.01" value={menuForm.price} onChange={(e) => setMenuForm({ ...menuForm, price: e.target.value })} placeholder="e.g. 3500" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Image URL</label>
                  <input value={menuForm.imageUrl} onChange={(e) => setMenuForm({ ...menuForm, imageUrl: e.target.value })} placeholder="Optional" className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                <textarea value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} rows={2} placeholder="Describe the dish..." className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm resize-none" />
              </div>
              <button type="submit" disabled={savingMenu} className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm transition active:scale-[0.98]">
                {savingMenu ? "Adding..." : "Add to Menu"}
              </button>
            </form>
          )}

          {/* Edit form (inline) */}
          {editingItem && (
            <form onSubmit={handleUpdateMenuItem} className="bg-white rounded-2xl shadow-sm p-5 space-y-4 mb-4 border-l-4 border-amber-500">
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Editing: {editingItem.name}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Name</label>
                  <input value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Category</label>
                  <input value={editingItem.category} onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Price (₦)</label>
                  <input type="number" step="0.01" value={editingItem.price} onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Image URL</label>
                  <input value={editingItem.imageUrl || ""} onChange={(e) => setEditingItem({ ...editingItem, imageUrl: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Description</label>
                <textarea value={editingItem.description || ""} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none text-sm resize-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={savingMenu} className="flex-1 h-10 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-bold text-sm transition active:scale-95">
                  {savingMenu ? "Saving..." : "Save"}
                </button>
                <button type="button" onClick={() => setEditingItem(null)} className="px-4 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition">
                  Cancel
                </button>
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
              <p className="text-xs text-slate-400">Click &quot;+ Add Item&quot; to start building your menu.</p>
            </div>
          )}

          {/* Menu items list */}
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
                        <span className="text-xs font-bold text-slate-700">₦{Number(item.price).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingItem({ ...item, price: String(item.price) })}
                      className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteMenuItem(item.id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                    >
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
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-white rounded-t-xl shadow-[0_-4px_20px_rgba(15,23,42,0.05)]">
        {[{ icon: "dashboard", label: "Dashboard", path: "/dashboard" }, ...NAV_ITEMS.slice(0, 3)].map((tab) => (
          <button key={tab.label} onClick={() => navigate(tab.path)} className={`flex flex-col items-center px-4 py-1 rounded-2xl transition ${location.pathname === tab.path ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-100"}`}>
            <span className="material-symbols-outlined text-2xl">{tab.icon}</span>
            <span className="text-xs font-semibold mt-1">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default ManageRestaurant;
