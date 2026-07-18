import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const NAV_ITEMS = [
  { icon: "home", label: "Home", path: "/restaurants" },
  { icon: "receipt_long", label: "Orders", path: "/orders" },
  { icon: "favorite", label: "Favorites", path: "/favorites" },
  { icon: "person", label: "Profile", path: "/profile" },
];

const RestaurantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { addItem, removeItem, itemCount: cartItemCount, items: cartItems } = useCart();

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(e.target)
      ) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [restaurantRes, menuRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}`),
          fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}/menu-items`),
        ]);

        const restaurantData = await restaurantRes.json();
        const menuData = await menuRes.json();

        if (!restaurantRes.ok) {
          setError(restaurantData.message || "Restaurant not found");
          return;
        }

        setRestaurant(restaurantData.restaurant);
        setMenuItems(menuRes.ok ? menuData.menuItems : []);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const categories = [
    "All",
    ...new Set(menuItems.map((item) => item.category)),
  ];
  const filteredItems =
    activeCategory === "All"
      ? menuItems
      : menuItems.filter((item) => item.category === activeCategory);

  // ── LOADING ──
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        {/* Skeleton header */}
        <header className="sticky top-0 z-50 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16 max-w-7xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 animate-pulse" />
              <div className="w-32 h-6 bg-slate-200 animate-pulse rounded" />
            </div>
            <div className="hidden md:flex gap-2">
              {[80, 80, 80, 80].map((w, i) => (
                <div
                  key={i}
                  className="h-8 rounded-xl bg-slate-200 animate-pulse"
                  style={{ width: w }}
                />
              ))}
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </header>

        <main className="pb-24 md:pb-8">
          {/* Skeleton hero */}
          <div className="w-full h-64 md:h-80 bg-slate-200 animate-pulse" />

          <div className="px-4 lg:px-8 max-w-5xl mx-auto">
            {/* Skeleton info */}
            <div className="bg-white rounded-2xl -mt-8 relative z-10 p-6 shadow-sm mb-8 space-y-3">
              <div className="w-3/4 h-7 bg-slate-200 animate-pulse rounded" />
              <div className="w-1/2 h-4 bg-slate-200 animate-pulse rounded" />
              <div className="flex gap-2">
                <div className="w-16 h-5 bg-slate-200 animate-pulse rounded-full" />
                <div className="w-16 h-5 bg-slate-200 animate-pulse rounded-full" />
              </div>
            </div>

            {/* Skeleton category tabs */}
            <div className="flex gap-2 mb-6 overflow-hidden">
              {[80, 100, 90, 70, 110].map((w, i) => (
                <div
                  key={i}
                  className="h-8 rounded-full bg-slate-200 animate-pulse"
                  style={{ width: w }}
                />
              ))}
            </div>

            {/* Skeleton menu cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm flex"
                >
                  <div className="w-28 h-28 bg-slate-200 animate-pulse shrink-0" />
                  <div className="p-4 flex-1 space-y-2">
                    <div className="w-3/4 h-5 bg-slate-200 animate-pulse rounded" />
                    <div className="w-full h-3 bg-slate-200 animate-pulse rounded" />
                    <div className="w-1/4 h-4 bg-slate-200 animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Mobile nav skeleton */}
        <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-white rounded-t-xl shadow-[0_-4px_20px_rgba(15,23,42,0.05)]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-12 h-12 bg-slate-200 animate-pulse rounded-2xl" />
          ))}
        </nav>
      </div>
    );
  }

  // ── ERROR ──
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-4xl text-red-400">
              error_outline
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {error === "restaurant not found"
              ? "Restaurant not found"
              : "Something went wrong"}
          </h2>
          <p className="text-slate-500 mb-6">
            {error === "restaurant not found"
              ? "This restaurant may have been removed or doesn't exist."
              : error}
          </p>
          <button
            onClick={() => navigate("/restaurants")}
            className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white hover:bg-amber-600 transition active:scale-95"
          >
            Back to Restaurants
          </button>
        </div>
      </div>
    );
  }

  // ── SUCCESS ──
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 lg:px-8 h-16 max-w-7xl mx-auto">
          {/* Left: back + logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 -ml-2 text-slate-600 hover:text-amber-500 rounded-full hover:bg-slate-100 transition"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <button
              onClick={() => navigate("/restaurants")}
              className="text-xl font-extrabold text-amber-500 tracking-tight hidden sm:block"
            >
              Chow<span className="text-slate-900">Zilla</span>
            </button>
          </div>

          {/* Center: desktop nav */}
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
            {/* Cart button with badge */}
            <button
              onClick={() => navigate("/cart")}
              className="relative p-2 text-slate-600 hover:text-amber-500 hover:bg-slate-100 rounded-full transition"
            >
              <span className="material-symbols-outlined">shopping_bag</span>
              {cartItemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center animate-fade-up">
                  {cartItemCount}
                </span>
              )}
            </button>

            {/* User dropdown */}
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
                      onClick={() => {
                        logout();
                        setUserDropdownOpen(false);
                        navigate("/login");
                      }}
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
      </header>

      {/* ── Hero ── */}
      <div className="relative w-full h-56 md:h-80 bg-slate-300 overflow-hidden">
        {restaurant.imageUrl ? (
          <img
            src={restaurant.imageUrl}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        {/* Restaurant name overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-8 max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 drop-shadow-lg">
            {restaurant.name}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-sm font-semibold px-3 py-1 rounded-full">
              <span className="material-symbols-outlined text-sm">star</span>
              4.5
            </span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-sm font-semibold px-3 py-1 rounded-full">
              20–30 min
            </span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-sm font-semibold px-3 py-1 rounded-full">
              $$
            </span>
          </div>
        </div>
      </div>

      {/* ── Restaurant Info Card ── */}
      <div className="px-4 lg:px-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl -mt-6 relative z-10 p-6 shadow-sm mb-8">
          <p className="text-slate-600 leading-relaxed mb-4">
            {restaurant.description}
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-500">
                location_on
              </span>
              {restaurant.address}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-500">
                call
              </span>
              {restaurant.phone}
            </span>
          </div>
        </div>

        {/* ── Menu Section ── */}
        <section className="pb-24 md:pb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Menu</h2>
            {menuItems.length > 0 && (
              <p className="text-sm text-slate-400">
                {menuItems.length} {menuItems.length === 1 ? "item" : "items"}
              </p>
            )}
          </div>

          {/* Category tabs */}
          {categories.length > 1 && (
            <div className="overflow-x-auto flex gap-2 mb-6 no-scrollbar">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-full px-5 py-2 text-sm font-semibold whitespace-nowrap transition active:scale-95 ${
                    activeCategory === cat
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Empty menu */}
          {menuItems.length === 0 && (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-4xl text-slate-300">
                  menu_book
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                No menu items yet
              </h3>
              <p className="text-slate-500 text-sm">
                This restaurant hasn&apos;t added any items to their menu.
              </p>
            </div>
          )}

          {/* Empty filtered category */}
          {menuItems.length > 0 && filteredItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">
                No items in &quot;{activeCategory}&quot;
              </p>
              <button
                onClick={() => setActiveCategory("All")}
                className="mt-2 text-amber-500 font-semibold text-sm hover:text-amber-600 transition"
              >
                Show all items
              </button>
            </div>
          )}

          {/* Menu items grid */}
          {filteredItems.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredItems.map((item) => {
                const qty =
                  cartItems.find((i) => i.menuItemId === item.id)?.quantity ||
                  0;
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl shadow-sm overflow-hidden flex transition hover:shadow-md ${
                      !item.isAvailable ? "opacity-50" : ""
                    }`}
                  >
                    {/* Item image */}
                    <div className="w-28 h-28 md:w-36 md:h-36 bg-slate-100 shrink-0">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                          <span className="material-symbols-outlined text-4xl text-slate-300">
                            restaurant
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Item details */}
                    <div className="p-3 md:p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm md:text-base font-bold text-slate-900 line-clamp-1">
                            {item.name}
                          </h3>
                          {!item.isAvailable && (
                            <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full shrink-0">
                              Out of stock
                            </span>
                          )}
                        </div>
                        <p className="text-xs md:text-sm text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm md:text-base font-bold text-slate-900">
                          ₦{Number(item.price).toLocaleString()}
                        </span>

                        {item.isAvailable ? (
                          qty > 0 ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => removeItem(item.id)}
                                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition active:scale-90"
                              >
                                <span className="material-symbols-outlined text-lg">
                                  remove
                                </span>
                              </button>
                              <span className="text-sm font-bold text-slate-900 w-5 text-center">
                                {qty}
                              </span>
                              <button
                                onClick={() => addItem(item, restaurant.id, restaurant.name)}
                                className="w-8 h-8 rounded-full bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center transition active:scale-90"
                              >
                                <span className="material-symbols-outlined text-lg">
                                  add
                                </span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addItem(item, restaurant.id, restaurant.name)}
                              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-full transition active:scale-95"
                            >
                              Add
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">
                            Unavailable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Mobile cart bar ── */}
      {cartItemCount > 0 && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 px-4 animate-fade-up">
          <button
            onClick={() => navigate("/cart")}
            className="w-full bg-slate-900 text-white rounded-2xl py-4 px-6 flex items-center justify-between shadow-lg active:scale-[0.98] transition"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold">
                {cartItemCount}
              </span>
              <span className="font-bold text-sm">View Cart</span>
            </div>
            <span className="font-bold text-amber-400 text-sm">
              ₦
              {cartItems
                .reduce((sum, i) => sum + i.price * i.quantity, 0)
                .toLocaleString()}
            </span>
          </button>
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-white rounded-t-xl shadow-[0_-4px_20px_rgba(15,23,42,0.05)]">
        {NAV_ITEMS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center px-4 py-1 rounded-2xl transition ${
              location.pathname.startsWith("/restaurants") &&
              tab.path === "/restaurants"
                ? "bg-amber-100 text-amber-700"
                : "text-slate-400 hover:bg-slate-100"
            }`}
          >
            <span className="material-symbols-outlined text-2xl">
              {tab.icon}
            </span>
            <span className="text-xs font-semibold mt-1">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default RestaurantDetail;
