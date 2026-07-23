import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

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
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/users/profile`,
          {
            // This is a GET request — no body needed
            // The token proves who we are
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || "Failed to load profile");
          return;
        }

        setUser(data.user);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false); // always stop loading, whether success or failure
      }
    };

    fetchProfile();
  }, []); // ← empty array = "run once when the component mounts"

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
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/users/profile`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: fullName,
            email: formData.email,
            phone: formData.phone || null,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setSaveMessage(data.message || "Failed to save changes");
        return;
      }

      // Update the displayed user data in context + localStorage
      updateUser(data.user);
      setUser(data.user);
      setIsEditing(false);
      setSaveMessage("Profile updated!");
    } catch {
      setSaveMessage("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Logout: clear stored data and go back to login
  const handleLogout = () => {
    logout();
    navigate("/login");
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
            { label: "Order history", tab: "order", icon: "receipt_long" },
            {label: "payment method", tab: "payment", icon: "money"},
            { label: "Favorites", tab: "favorites", icon: "favorite" },
          ].map((item) => (
            <button
              key={item.tab}
              onClick={() => setActiveTab(item.tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm transition-colors ${
                activeTab === item.tab
                  ? "bg-amber-500/10 text-amber-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {item.label}
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

          {activeTab === "order" && (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">
                receipt_long
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Order History</h2>
              <p className="text-slate-500">Your order history will appear here.</p>
            </div>
          )}

          {activeTab === "payment" && (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">
                payments
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment Methods</h2>
              <p className="text-slate-500">Your saved payment methods will appear here.</p>
            </div>
          )}

          {activeTab === "favorites" && (
            <div className="text-center py-20">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4 block">
                favorite
              </span>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Favorites</h2>
              <p className="text-slate-500">Your favorite restaurants and dishes will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
