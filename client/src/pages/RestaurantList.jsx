import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { icon: "home", label: "Home", path: "/restaurants" },
  { icon: "receipt_long", label: "Orders", path: "/orders" },
  { icon: "favorite", label: "Favorites", path: "/favorites" },
  { icon: "person", label: "Profile", path: "/profile" },
];

const FILTERS = ["All", "Pizza", "Burger", "Nigerian", "Drinks"];

const RestaurantList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAuthenticated } = useAuth();

  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const userDropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurants`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.message || "Failed to load restaurants");
          return;
        }
        setRestaurants(data.restaurants);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurants();
  }, []);

  const filtered = restaurants.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      activeFilter === "All" ||
      r.name.toLowerCase().includes(activeFilter.toLowerCase()) ||
      r.description.toLowerCase().includes(activeFilter.toLowerCase());
    return matchesSearch && matchesFilter;
  });

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    setMenuOpen(false);
    navigate("/login");
  };

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  // ── Shared header ──
  const Header = (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 lg:px-8 h-16 max-w-7xl mx-auto">
        {/* Left: mobile hamburger + logo */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            ref={mobileMenuRef}
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-amber-500 rounded-full hover:bg-slate-100 transition"
          >
            <span className="material-symbols-outlined">
              {menuOpen ? "close" : "menu"}
            </span>
          </button>

          {/* Logo */}
          <button
            onClick={() => navigate("/restaurants")}
            className="text-2xl font-extrabold text-amber-500 tracking-tight"
          >
            Chow<span className="text-slate-900">Zilla</span>
          </button>
        </div>

        {/* Center: Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                location.pathname === item.path
                  ? "bg-amber-50 text-amber-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right: cart + user */}
        <div className="flex items-center gap-2">
          {/* Cart button */}
          <button
            onClick={() => navigate("/cart")}
            className="relative p-2 text-slate-600 hover:text-amber-500 hover:bg-slate-100 rounded-full transition"
          >
            <span className="material-symbols-outlined">shopping_bag</span>
          </button>

          {/* Desktop user dropdown */}
          <div className="relative hidden md:block" ref={userDropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className={`flex items-center gap-2 rounded-full p-1.5 pr-3 transition ${
                userDropdownOpen ? "bg-slate-100" : "hover:bg-slate-100"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-bold">
                {userInitial}
              </div>
              <span className="text-sm font-semibold text-slate-700 hidden lg:block max-w-[100px] truncate">
                {user?.name || "Guest"}
              </span>
              <span
                className={`material-symbols-outlined text-slate-400 text-sm transition ${
                  userDropdownOpen ? "rotate-180" : ""
                }`}
              >
                expand_more
              </span>
            </button>

            {/* Dropdown menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-lg border border-slate-100 py-2 animate-fade-up">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {user?.name || "Guest"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {user?.email || ""}
                  </p>
                </div>

                <button
                  onClick={() => {
                    navigate("/profile");
                    setUserDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                >
                  <span className="material-symbols-outlined text-slate-400 text-xl">
                    person
                  </span>
                  View Profile
                </button>

                <button
                  onClick={() => {
                    navigate("/orders");
                    setUserDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                >
                  <span className="material-symbols-outlined text-slate-400 text-xl">
                    receipt_long
                  </span>
                  My Orders
                </button>

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition font-medium"
                  >
                    <span className="material-symbols-outlined text-xl">
                      logout
                    </span>
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 animate-fade-up" ref={mobileMenuRef}>
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white text-lg font-bold">
              {userInitial}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {user?.name || "Guest"}
              </p>
              <p className="text-xs text-slate-400">{user?.email || ""}</p>
            </div>
          </div>

          {NAV_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition mb-1 ${
                location.pathname === item.path
                  ? "bg-amber-50 text-amber-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined text-xl">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}

          <div className="border-t border-slate-100 mt-2 pt-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition"
            >
              <span className="material-symbols-outlined text-xl">logout</span>
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Search + Filters bar */}
      <div className="px-4 lg:px-8 pb-3 max-w-7xl mx-auto">
        {/* Search */}
        <div className="relative mb-3">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Search restaurants, cuisines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-100 text-slate-900 rounded-xl pl-10 pr-4 py-3 border-none focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-shadow"
          />
        </div>

        {/* Filter chips */}
        <div className="overflow-x-auto flex gap-2 no-scrollbar">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition active:scale-95 ${
                activeFilter === f
                  ? "bg-slate-900 text-white"
                  : "bg-slate-200 text-slate-700 hover:bg-slate-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </header>
  );

  // ── Shared mobile bottom nav ──
  const BottomNav = (
    <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-white rounded-t-xl shadow-[0_-4px_20px_rgba(15,23,42,0.05)]">
      {NAV_ITEMS.map((tab) => (
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
  );

  // ── Content renderer ──
  const renderContent = () => {
    // LOADING
    if (loading) {
      return (
        <div className="px-4 lg:px-8 max-w-7xl mx-auto pt-8">
          {/* Skeleton filters */}
          <div className="flex gap-2 overflow-hidden mb-8">
            {[80, 100, 90, 70, 80].map((w, i) => (
              <div
                key={i}
                className="h-8 rounded-full bg-slate-200 animate-pulse"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>

          {/* Skeleton cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl overflow-hidden shadow-sm"
              >
                <div className="w-full h-[200px] bg-slate-200 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-6 w-3/4 bg-slate-200 animate-pulse rounded" />
                  <div className="h-4 w-full bg-slate-200 animate-pulse rounded" />
                  <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
                  <div className="flex gap-2 pt-2">
                    <div className="h-5 w-16 bg-slate-200 animate-pulse rounded-full" />
                    <div className="h-5 w-12 bg-slate-200 animate-pulse rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // ERROR
    if (error) {
      return (
        <div className="flex items-center justify-center px-4 pt-20">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-red-400">
                error_outline
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              Something went wrong
            </h2>
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

    // EMPTY
    if (filtered.length === 0) {
      return (
        <div className="flex items-center justify-center px-4 pt-16">
          <div className="text-center max-w-md">
            <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
              <span
                className="material-symbols-outlined text-slate-300"
                style={{ fontSize: "56px" }}
              >
                search_off
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-3">
              No restaurants found
            </h2>
            <p className="text-slate-500 mb-8 leading-relaxed">
              Try adjusting your filters or search query to discover delicious
              food nearby.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setActiveFilter("All");
              }}
              className="rounded-full bg-amber-500 text-white font-semibold py-3 px-8 shadow-md hover:bg-amber-600 transition active:scale-95"
            >
              Clear Filters
            </button>
          </div>
        </div>
      );
    }

    // SUCCESS
    return (
      <div className="px-4 lg:px-8 max-w-7xl mx-auto pt-8 pb-24 md:pb-8">
        {/* Section heading */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {activeFilter === "All" ? "All Restaurants" : activeFilter}
            </h2>
            <p className="text-sm text-slate-500">
              {filtered.length} {filtered.length === 1 ? "restaurant" : "restaurants"} found
            </p>
          </div>
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((r) => (
            <article
              key={r.id}
              onClick={() => navigate(`/restaurants/${r.id}`)}
              className="bg-white rounded-2xl shadow-sm overflow-hidden transition hover:-translate-y-1 hover:shadow-lg cursor-pointer flex flex-col group"
            >
              {/* Image */}
              <div className="relative w-full h-52 bg-slate-200 overflow-hidden">
                {r.imageUrl ? (
                  <img
                    alt={r.name}
                    src={r.imageUrl}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100">
                    <span className="material-symbols-outlined text-6xl text-amber-300">
                      restaurant
                    </span>
                  </div>
                )}
                {/* Delivery time badge */}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-slate-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                  20–30 min
                </div>
              </div>

              {/* Content */}
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between mb-1">
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                      {r.name}
                    </h3>
                    <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500 bg-amber-50 px-2 py-1 rounded-lg ml-2 shrink-0">
                      <span className="material-symbols-outlined text-sm">star</span>
                      4.5
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                    {r.description}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">
                      location_on
                    </span>
                    <span className="text-xs font-medium truncate max-w-[120px]">
                      {r.address}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">
                      call
                    </span>
                    <span className="text-xs font-medium">{r.phone}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {Header}
      <main className="min-h-[60vh]">{renderContent()}</main>
      {BottomNav}
    </div>
  );
};

export default RestaurantList;
