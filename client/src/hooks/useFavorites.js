import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

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
      const data = await api.get("/favorites");
      setFavoriteIds(new Set(data.favorites.map((f) => f.id)));
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
        if (wasFav) {
          await api.del(`/restaurants/${restaurantId}/favorite`);
        } else {
          await api.post(`/restaurants/${restaurantId}/favorite`);
        }
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
