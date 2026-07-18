import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { icon: "home", label: "Home", path: "/restaurants" },
  { icon: "receipt_long", label: "Orders", path: "/orders" },
  { icon: "favorite", label: "Favorites", path: "/favorites" },
  { icon: "person", label: "Profile", path: "/profile" },
];

const Favorites = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

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

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/profile")}
              className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white text-sm font-bold"
            >
              {userInitial}
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 lg:px-8 max-w-7xl mx-auto pt-12 pb-24">
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-5xl text-slate-300">
              favorite
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">No favorites yet</h2>
          <p className="text-slate-500 mb-8 max-w-sm leading-relaxed">
            Tap the heart icon on any restaurant to save it here for quick access.
          </p>
          <button
            onClick={() => navigate("/restaurants")}
            className="rounded-full bg-amber-500 text-white font-semibold py-3 px-8 shadow-md hover:bg-amber-600 transition active:scale-95"
          >
            Discover Restaurants
          </button>
        </div>
      </main>

      {/* Mobile bottom nav */}
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
    </div>
  );
};

export default Favorites;
