import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";

const Favorites = () => {
  const navigate = useNavigate();

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
};

export default Favorites;
