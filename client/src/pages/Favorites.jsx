import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { api } from "../lib/api";

const Favorites = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const data = await api.get("/favorites");
        setFavorites(data.favorites);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFavorites();
  }, []);

  const removeFavorite = async (restaurantId) => {
    setFavorites((prev) => prev.filter((r) => r.id !== restaurantId)); // optimistic
    try {
      await api.del(`/restaurants/${restaurantId}/favorite`);
    } catch {
      // best-effort resync on failure
      try {
        const data = await api.get("/favorites");
        setFavorites(data.favorites);
      } catch {
        // give up silently
      }
    }
  };

  // ── LOADING ──
  if (loading) {
    return (
      <AppLayout showCart={false} showUserDropdown={false}>
        <div className="px-4 lg:px-8 max-w-7xl mx-auto pt-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <div className="w-full h-52 bg-slate-200 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="h-6 w-3/4 bg-slate-200 animate-pulse rounded" />
                  <div className="h-4 w-full bg-slate-200 animate-pulse rounded" />
                  <div className="h-4 w-1/2 bg-slate-200 animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── ERROR ──
  if (error) {
    return (
      <AppLayout showCart={false} showUserDropdown={false}>
        <div className="flex items-center justify-center px-4 pt-20">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-500 mb-6">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white hover:bg-amber-600 transition active:scale-95"
            >
              Try again
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── EMPTY ──
  if (favorites.length === 0) {
    return (
      <AppLayout showCart={false} showUserDropdown={false}>
        <div className="flex flex-col items-center justify-center text-center py-20">
          <div className="w-28 h-28 rounded-full bg-slate-100 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-5xl text-slate-300">favorite</span>
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
      </AppLayout>
    );
  }

  // ── SUCCESS ──
  return (
    <AppLayout showCart={false} showUserDropdown={false}>
      <div className="px-4 lg:px-8 max-w-7xl mx-auto pt-8 pb-24 md:pb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-slate-900">Your favorites</h2>
          <p className="text-sm text-slate-500">
            {favorites.length} {favorites.length === 1 ? "restaurant" : "restaurants"}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((r) => (
            <article
              key={r.id}
              onClick={() => navigate(`/restaurants/${r.id}`)}
              className="bg-white rounded-2xl shadow-sm overflow-hidden transition hover:-translate-y-1 hover:shadow-lg cursor-pointer flex flex-col group"
            >
              <div className="relative w-full h-52 bg-slate-200 overflow-hidden">
                {r.imageUrl ? (
                  <img alt={r.name} src={r.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100">
                    <span className="material-symbols-outlined text-6xl text-amber-300">restaurant</span>
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); removeFavorite(r.id); }}
                  aria-label="Remove from favorites"
                  className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition active:scale-90"
                >
                  <span className="material-symbols-outlined filled-icon text-red-500 text-lg">favorite</span>
                </button>
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-amber-600 transition-colors mb-1">{r.name}</h3>
                  <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{r.description}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-1.5 text-slate-400">
                  <span className="material-symbols-outlined text-base">location_on</span>
                  <span className="text-xs font-medium truncate">{r.address}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Favorites;
