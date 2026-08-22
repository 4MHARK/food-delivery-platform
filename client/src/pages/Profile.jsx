import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import OrderCard from "../components/OrderCard";
import { api } from "../lib/api";

// Order statuses considered "past" (terminal). Everything else is a live order.
const PAST_STATUSES = ["DELIVERED", "CANCELLED"];

const Profile = () => {
  const navigate = useNavigate();
  const { token, logout, updateUser } = useAuth();

  // State: user data, error message, loading status
  const [user, setUser] = useState(null); // null = "no data yet"
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true); // start as true because we fetch immediately
  const [activeTab, setActiveTab] = useState("profile"); // which sidebar tab is selected
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Orders data — shared by the "Live orders" and "Order history" tabs
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Edit form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  // useEffect runs ONCE when this component first appears
  useEffect(() => {
    // Guard: if no token, kick them back to login
    if (!token) {
      navigate("/login");
      return; // stop here, don't try to fetch
    }

    // Fetch the user's profile from the backend
    const fetchProfile = async () => {
      try {
        const data = await api.get("/users/profile");

        setUser(data.user);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false); // always stop loading, whether success or failure
      }
    };

    fetchProfile();
  }, []); // ← empty array = "run once when the component mounts"

  // Fetch the user's orders — used by "Live orders" and "Order history" tabs
  useEffect(() => {
    if (!token) return;

    const fetchOrders = async () => {
      try {
        const data = await api.get("/orders");
        setOrders(data.orders || []);
      } catch {
        // non-fatal — the orders tabs just show their empty state
      } finally {
        setOrdersLoading(false);
      }
    };

    fetchOrders();
  }, [token]);

  // Populate form fields when user data loads
  useEffect(() => {
    if (user) {
      const nameParts = user.name.trim().split(" ");
      setFormData({
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]); // runs when `user` changes

  // Save profile changes
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage("");

    const fullName = `${formData.firstName} ${formData.lastName}`.trim();

    try {
      const data = await api.put("/users/profile", {
        name: fullName,
        email: formData.email,
        phone: formData.phone || null,
      });

      // Update the displayed user data in context + localStorage
      updateUser(data.user);
      setUser(data.user);
      setIsEditing(false);
      setSaveMessage("Profile updated!");
    } catch (e) {
      setSaveMessage(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Logout: clear stored data and go back to login
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Split orders into live (in flight) vs past (terminal)
  const liveOrders = orders.filter((o) => !PAST_STATUSES.includes(o.status));
  const pastOrders = orders.filter((o) => PAST_STATUSES.includes(o.status));

  // Shared renderer for the two orders tabs (loading / empty / list)
  const renderOrdersTab = (list, emptyTitle, emptyText) => {
    if (ordersLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-5 space-y-3 animate-pulse">
              <div className="flex justify-between">
                <div className="w-32 h-5 bg-slate-200 rounded" />
                <div className="w-20 h-5 bg-slate-200 rounded-full" />
              </div>
              <div className="w-full h-4 bg-slate-200 rounded" />
              <div className="w-1/2 h-4 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <div className="text-center py-16">
          <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl text-slate-300">receipt_long</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">{emptyTitle}</h3>
          <p className="text-slate-500">{emptyText}</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {list.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    );
  };

  // --- RENDER ---

  // State 1: Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-slate-500 text-lg">Loading profile...</p>
      </div>
    );
  }

  // State 2: Error
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-amber-500 px-6 py-2 font-semibold text-white"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }
  // State 3: Success — user data is loaded
  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="hidden md:flex md:w-64 bg-slate-900 flex-col">
        <div className="p-8">
          <h1 className="text-white text-2xl font-semibold">
            <span className="text-amber-500">Chow</span>Zilla
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 px-4">
            Menu
          </p>
          {[
            { label: "Personal info", tab: "profile", icon: "person" },
            { label: "Live orders", tab: "liveOrders", icon: "receipt_long" },
            { label: "Order history", tab: "orderHistory", icon: "history" },
            { label: "Payment method", tab: "payment", icon: "money", disabled: true },
            { label: "Favorites", tab: "favorites", icon: "favorite", href: "/favorites" },
          ].map((item) => (
            <button
              key={item.tab}
              disabled={item.disabled}
              onClick={() => {
                if (item.href) { navigate(item.href); return; }
                setActiveTab(item.tab);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
                item.disabled
                  ? "text-slate-600 opacity-50 cursor-not-allowed"
                  : activeTab === item.tab
                    ? "bg-amber-500/10 text-amber-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
              {item.disabled && (
                <span
                  title="Coming soon"
                  className="ml-auto text-[9px] font-bold uppercase tracking-wide bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full whitespace-nowrap"
                >
                  Soon
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            Log out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 md:p-12">
        {/* Mobile header with back + logout */}
        <div className="md:hidden flex justify-between items-center mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 text-slate-600 font-semibold text-sm"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            Back
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-slate-600 font-semibold text-sm"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            Log out
          </button>
        </div>

        {/* Desktop back button */}
        <button
          onClick={() => navigate(-1)}
          className="hidden md:flex items-center gap-1.5 text-slate-500 hover:text-amber-500 font-semibold text-sm mb-6 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
          Back
        </button>

        {/* Tab content — switches based on activeTab */}
        <div className="max-w-2xl mx-auto">
          {activeTab === "profile" && (
            <>
              {/* Summary section */}
              <section className="mb-8">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  {/* Avatar + user info */}
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">{user.name}</h2>
                      <p className="text-slate-500 text-base">{user.email}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="material-symbols-outlined text-green-600 text-lg filled-icon">
                          verified
                        </span>
                        <span className="text-sm font-medium text-green-600">
                          ChowZilla Member since {new Date(user.createdAt).getFullYear()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-2 px-4 py-2 border-2 border-slate-300 text-slate-700 rounded-xl font-semibold text-sm hover:bg-amber-50 hover:border-amber-500 hover:text-amber-600 transition-all active:scale-95"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                    {isEditing ? "Cancel" : "Edit Profile"}
                  </button>
                </div>
              </section>

              {/* Personal Information card */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 md:p-8">
                <div className="flex justify-between items-end mb-6 pb-4 border-b border-slate-200">
                  <h3 className="text-xl font-bold text-slate-900">Personal Information</h3>
                </div>

                {saveMessage && (
                  <p
                    className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
                      saveMessage === "Profile updated!"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {saveMessage}
                  </p>
                )}

                <form className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* First Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-600">
                      First Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={(e) =>
                          setFormData({ ...formData, firstName: e.target.value })
                        }
                        className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow text-base"
                      />
                    ) : (
                      <p className="text-slate-900 font-medium py-2">{formData.firstName}</p>
                    )}
                  </div>

                  {/* Last Name */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-600">
                      Last Name
                    </label>
                    {isEditing ? (
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={(e) =>
                          setFormData({ ...formData, lastName: e.target.value })
                        }
                        className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow text-base"
                      />
                    ) : (
                      <p className="text-slate-900 font-medium py-2">{formData.lastName}</p>
                    )}
                  </div>

                  {/* Email Address */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-600">
                      Email Address
                    </label>
                    {isEditing ? (
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow text-base"
                      />
                    ) : (
                      <p className="text-slate-900 font-medium py-2">{formData.email}</p>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-600">
                      Phone Number
                    </label>
                    {isEditing ? (
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        placeholder="+1 (555) 123-4567"
                        className="w-full h-11 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-shadow text-base"
                      />
                    ) : (
                      <p className="text-slate-400 font-medium py-2">
                        {formData.phone || "Not provided"}
                      </p>
                    )}
                  </div>

                  {/* Save button — only visible in edit mode */}
                  {isEditing && (
                    <div className="md:col-span-2 mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-amber-500 text-white font-semibold text-sm px-6 py-3 rounded-xl hover:bg-amber-600 transition-colors active:scale-95 shadow-sm disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-lg">save</span>
                        {saving ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  )}
                </form>
              </section>
            </>
          )}

          {activeTab === "liveOrders" && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Live orders</h2>
              {renderOrdersTab(liveOrders, "No live orders", "You have no orders in progress right now.")}
            </section>
          )}

          {activeTab === "orderHistory" && (
            <section>
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Order history</h2>
              {renderOrdersTab(pastOrders, "No past orders", "Your completed orders will appear here.")}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
