import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

const DEFAULT_NAV = [
  { icon: "home", label: "Home", path: "/restaurants" },
  { icon: "receipt_long", label: "Orders", path: "/orders" },
  { icon: "favorite", label: "Favorites", path: "/favorites" },
  { icon: "person", label: "Profile", path: "/profile" },
];

const OWNER_NAV = [
  { icon: "dashboard", label: "Dashboard", path: "/dashboard" },
  ...DEFAULT_NAV.slice(0, 3),
];

/**
 * Shared layout used by all authenticated pages.
 *
 * Props:
 *  children          — page content (goes inside <main>)
 *  backTo            — if provided, renders a back arrow that navigates here
 *  onBack            — custom back handler (overrides backTo)
 *  desktopNavItems   — override the default desktop nav links
 *  bottomNavItems    — override the default mobile bottom-nav links
 *  showCart          — show/hide the cart icon (default true)
 *  showUserDropdown  — show full user dropdown or just an avatar link (default true)
 *  extraHeader       — optional element rendered between header and main (search bar, etc.)
 */
const AppLayout = ({
  children,
  backTo,
  onBack,
  desktopNavItems,
  bottomNavItems,
  showCart = true,
  showUserDropdown = true,
  extraHeader,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { itemCount } = useCart();

  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  // Close dropdowns on outside click
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

  const handleLogout = () => {
    logout();
    setUserDropdownOpen(false);
    setMenuOpen(false);
    navigate("/login");
  };

  const isOwner = user?.role === "OWNER";
  const desktopNav = desktopNavItems || (isOwner ? OWNER_NAV : DEFAULT_NAV);
  const bottomNav = bottomNavItems || (isOwner ? OWNER_NAV : DEFAULT_NAV);
  const currentPath = location.pathname;

  // ── Header ──
  const Header = (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 lg:px-8 h-16 max-w-7xl mx-auto">
        {/* Left */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-amber-500 rounded-full hover:bg-slate-100 transition"
            ref={mobileMenuRef}
          >
            <span className="material-symbols-outlined">
              {menuOpen ? "close" : "menu"}
            </span>
          </button>

          {/* Back button */}
          {(backTo || onBack) && (
            <button
              onClick={() => onBack ? onBack() : navigate(backTo)}
              className="p-2 -ml-2 text-slate-600 hover:text-amber-500 rounded-full hover:bg-slate-100 transition"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
          )}

          {/* Logo */}
          <button
            onClick={() => navigate(isOwner ? "/dashboard" : "/restaurants")}
            className={`font-extrabold text-amber-500 tracking-tight ${
              (backTo || onBack) ? "text-xl hidden sm:block" : "text-2xl"
            }`}
          >
            Chow<span className="text-slate-900">Zilla</span>
          </button>
        </div>

        {/* Center: desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {desktopNav.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                currentPath === item.path ||
                (item.path === "/restaurants" && currentPath.startsWith("/restaurants/"))
                  ? "bg-amber-50 text-amber-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Cart */}
          {showCart && (
            <button
              onClick={() => navigate("/cart")}
              className="relative p-2 text-slate-600 hover:text-amber-500 hover:bg-slate-100 rounded-full transition"
            >
              <span className="material-symbols-outlined">shopping_bag</span>
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center animate-fade-up">
                  {itemCount}
                </span>
              )}
            </button>
          )}

          {/* User dropdown or simple avatar link */}
          {showUserDropdown ? (
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
                    <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                    <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={() => { navigate("/profile"); setUserDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                  >
                    <span className="material-symbols-outlined text-slate-400 text-xl">person</span>
                    View Profile
                  </button>
                  <button
                    onClick={() => { navigate("/orders"); setUserDropdownOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                  >
                    <span className="material-symbols-outlined text-slate-400 text-xl">receipt_long</span>
                    My Orders
                  </button>
                  {isOwner && (
                    <button
                      onClick={() => { navigate("/dashboard"); setUserDropdownOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition font-medium"
                    >
                      <span className="material-symbols-outlined text-slate-400 text-xl">dashboard</span>
                      Dashboard
                    </button>
                  )}
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
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate("/profile")}
              className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-bold hidden md:flex"
            >
              {userInitial}
            </button>
          )}
        </div>
      </div>

      {/* Mobile slide-down menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 animate-fade-up">
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white text-lg font-bold">
              {userInitial}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{user?.name || "Guest"}</p>
              <p className="text-xs text-slate-400">{user?.email || ""}</p>
            </div>
          </div>

          {bottomNav.map((item) => (
            <button
              key={item.path}
              onClick={() => { navigate(item.path); setMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition mb-1 ${
                currentPath === item.path ||
                (item.path === "/restaurants" && currentPath.startsWith("/restaurants/"))
                  ? "bg-amber-50 text-amber-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
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
    </header>
  );

  // ── Mobile bottom nav ──
  const BottomNav = bottomNav.length > 0 && (
    <nav className="md:hidden fixed bottom-0 w-full z-50 flex justify-around items-center px-4 py-2 bg-white rounded-t-xl shadow-[0_-4px_20px_rgba(15,23,42,0.05)]">
      {bottomNav.map((tab) => (
        <button
          key={tab.label}
          onClick={() => navigate(tab.path)}
          className={`flex flex-col items-center px-4 py-1 rounded-2xl transition ${
            currentPath === tab.path ||
            (tab.path === "/restaurants" && currentPath.startsWith("/restaurants/"))
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

  return (
    <div className="min-h-screen bg-slate-50">
      {Header}
      {extraHeader}
      <main className="min-h-[60vh]">{children}</main>
      {BottomNav}
    </div>
  );
};

export { DEFAULT_NAV, OWNER_NAV };
export default AppLayout;
