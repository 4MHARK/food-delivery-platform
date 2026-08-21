import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";

// Loads the current customer's favorited restaurant ids and exposes a toggle.
// One fetch per page (not per card); hearts update optimistically.
export function useFavorites() {
  const { isAuthenticated } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState(new Set());

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setFavoriteIds(new Set());
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/favorites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setFavoriteIds(new Set(data.favorites.map((f) => f.id)));
    } catch {
      // non-fatal — hearts simply stay unfilled
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (restaurantId) => {
      const wasFav = favoriteIds.has(restaurantId);
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(restaurantId);
        else next.add(restaurantId);
        return next;
      });
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${import.meta.env.VITE_API_URL}/restaurants/${restaurantId}/favorite`,
          {
            method: wasFav ? "DELETE" : "POST",
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        if (!res.ok) refresh();
      } catch {
        refresh();
      }
    },
    [favoriteIds, refresh]
  );

  return {
    isFavorited: (id) => favoriteIds.has(id),
    toggle,
    refresh,
  };
}
