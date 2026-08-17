import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import AppLayout from "../components/AppLayout";

const RestaurantDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, removeItem, itemCount: cartItemCount, items: cartItems } = useCart();
  const { isAuthenticated } = useAuth();

  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState(null); // { type: "error" | "success", text }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [restaurantRes, menuRes, reviewsRes] = await Promise.all([
          fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}`),
          fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}/menu-items`),
          fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}/reviews`),
        ]);
        const restaurantData = await restaurantRes.json();
        const menuData = await menuRes.json();
        const reviewsData = await reviewsRes.json();
        if (!restaurantRes.ok) { setError(restaurantData.message || "Restaurant not found"); return; }
        setRestaurant(restaurantData.restaurant);
        setMenuItems(menuRes.ok ? menuData.menuItems : []);
        setReviews(reviewsRes.ok ? reviewsData.reviews : []);
      } catch {
        setError("Something went wrong. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const refreshReviews = async () => {
    try {
      const [restaurantRes, reviewsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}`),
        fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}/reviews`),
      ]);
      const restaurantData = await restaurantRes.json();
      const reviewsData = await reviewsRes.json();
      if (restaurantRes.ok) setRestaurant(restaurantData.restaurant);
      if (reviewsRes.ok) setReviews(reviewsData.reviews);
    } catch { /* best-effort refresh after submit */ }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!rating) { setReviewMsg({ type: "error", text: "Please select a star rating." }); return; }
    setSubmitting(true);
    setReviewMsg(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${import.meta.env.VITE_API_URL}/restaurants/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setReviewMsg({ type: "error", text: data.message || "Could not submit review." }); return; }
      setReviewMsg({ type: "success", text: "Review saved. Thank you!" });
      setRating(0);
      setComment("");
      await refreshReviews();
    } catch {
      setReviewMsg({ type: "error", text: "Something went wrong. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ["All", ...new Set(menuItems.map((item) => item.category))];
  const filteredItems = activeCategory === "All" ? menuItems : menuItems.filter((item) => item.category === activeCategory);

  // ── LOADING ──
  if (loading) {
    return (
      <AppLayout onBack={() => navigate(-1)}>
        <div className="pb-24 md:pb-8">
          <div className="w-full h-64 md:h-80 bg-slate-200 animate-pulse" />
          <div className="px-4 lg:px-8 max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl -mt-8 relative z-10 p-6 shadow-sm mb-8 space-y-3">
              <div className="w-3/4 h-7 bg-slate-200 animate-pulse rounded" />
              <div className="w-1/2 h-4 bg-slate-200 animate-pulse rounded" />
              <div className="flex gap-2">
                <div className="w-16 h-5 bg-slate-200 animate-pulse rounded-full" />
                <div className="w-16 h-5 bg-slate-200 animate-pulse rounded-full" />
              </div>
            </div>
            <div className="flex gap-2 mb-6 overflow-hidden">
              {[80, 100, 90, 70, 110].map((w, i) => (
                <div key={i} className="h-8 rounded-full bg-slate-200 animate-pulse" style={{ width: w }} />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm flex">
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
        </div>
      </AppLayout>
    );
  }

  // ── ERROR ──
  if (error) {
    return (
      <AppLayout onBack={() => navigate(-1)}>
        <div className="flex items-center justify-center px-4 pt-20">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-4xl text-red-400">error_outline</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">
              {error === "restaurant not found" ? "Restaurant not found" : "Something went wrong"}
            </h2>
            <p className="text-slate-500 mb-6">
              {error === "restaurant not found" ? "This restaurant may have been removed or doesn't exist." : error}
            </p>
            <button
              onClick={() => navigate("/restaurants")}
              className="rounded-full bg-amber-500 px-8 py-3 font-semibold text-white hover:bg-amber-600 transition active:scale-95"
            >
              Back to Restaurants
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── SUCCESS ──
  return (
    <AppLayout onBack={() => navigate(-1)}>
      {/* Hero */}
      <div className="relative w-full h-56 md:h-80 bg-slate-300 overflow-hidden">
        {restaurant.imageUrl ? (
          <img src={restaurant.imageUrl} alt={restaurant.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-8 max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 drop-shadow-lg">{restaurant.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-white/20 backdrop-blur-sm text-white text-sm font-semibold px-3 py-1 rounded-full">Delivery fee from ₦400</span>
            <span className="bg-white/20 backdrop-blur-sm text-white text-sm font-semibold px-3 py-1 rounded-full">$$</span>
            {restaurant.reviewCount > 0 && (
              <span className="bg-white/20 backdrop-blur-sm text-white text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined filled-icon text-amber-300 text-base">star</span>
                {restaurant.avgRating}
                <span className="text-white/70 font-normal">({restaurant.reviewCount})</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 lg:px-8 max-w-5xl mx-auto">
        {/* Restaurant Info Card */}
        <div className="bg-white rounded-2xl -mt-6 relative z-10 p-6 shadow-sm mb-8">
          <p className="text-slate-600 leading-relaxed mb-4">{restaurant.description}</p>
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-500">location_on</span>
              {restaurant.address}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-amber-500">call</span>
              {restaurant.phone}
            </span>
          </div>
        </div>

        {/* Reviews Section */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Reviews</h2>
            {reviews.length > 0 && (
              <p className="text-sm text-slate-400">{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</p>
            )}
          </div>

          {/* Write a review */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Write a review</h3>
            {!isAuthenticated ? (
              <p className="text-sm text-slate-500">
                <button onClick={() => navigate("/login")} className="text-amber-500 font-semibold hover:text-amber-600 transition">Log in</button>{" "}
                to leave a review.
              </p>
            ) : (
              <form onSubmit={handleSubmitReview}>
                <div className="flex items-center gap-2 mb-4">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      className="transition active:scale-90"
                    >
                      <span className={`material-symbols-outlined text-2xl ${(hoverRating || rating) >= n ? "text-amber-500 filled-icon" : "text-slate-300"}`}>star</span>
                    </button>
                  ))}
                  {rating > 0 && <span className="text-xs text-slate-400 ml-1">{rating} star{rating > 1 ? "s" : ""}</span>}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Share your experience (optional)"
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm resize-none mb-4"
                />
                {reviewMsg && (
                  <p className={`mb-4 text-sm font-medium ${reviewMsg.type === "error" ? "text-red-600" : "text-green-600"}`}>{reviewMsg.text}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-bold px-6 py-2.5 rounded-full transition active:scale-95"
                >
                  {submitting ? "Submitting..." : "Submit Review"}
                </button>
              </form>
            )}
          </div>

          {/* Reviews list */}
          {reviews.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-3xl text-slate-300">rate_review</span>
              </div>
              <p className="text-sm text-slate-500">No reviews yet. Be the first to share your experience!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-sm">
                        {review.author?.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{review.author?.name || "Anonymous"}</span>
                    </div>
                    <span className="text-xs text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-0.5 mb-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`material-symbols-outlined text-base ${review.rating >= n ? "text-amber-500 filled-icon" : "text-slate-200"}`}>star</span>
                    ))}
                  </div>
                  {review.comment && <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Menu Section */}
        <section className="pb-24 md:pb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-900">Menu</h2>
            {menuItems.length > 0 && (
              <p className="text-sm text-slate-400">{menuItems.length} {menuItems.length === 1 ? "item" : "items"}</p>
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
                <span className="material-symbols-outlined text-4xl text-slate-300">menu_book</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No menu items yet</h3>
              <p className="text-slate-500 text-sm">This restaurant hasn&apos;t added any items to their menu.</p>
            </div>
          )}

          {/* Empty filtered */}
          {menuItems.length > 0 && filteredItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">No items in &quot;{activeCategory}&quot;</p>
              <button onClick={() => setActiveCategory("All")} className="mt-2 text-amber-500 font-semibold text-sm hover:text-amber-600 transition">
                Show all items
              </button>
            </div>
          )}

          {/* Menu items grid */}
          {filteredItems.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredItems.map((item) => {
                const qty = cartItems.find((i) => i.menuItemId === item.id)?.quantity || 0;
                return (
                  <div key={item.id} className={`bg-white rounded-2xl shadow-sm overflow-hidden flex transition hover:shadow-md ${!item.isAvailable ? "opacity-50" : ""}`}>
                    <div className="w-28 h-28 md:w-36 md:h-36 bg-slate-100 shrink-0">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
                          <span className="material-symbols-outlined text-4xl text-slate-300">restaurant</span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 md:p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm md:text-base font-bold text-slate-900 line-clamp-1">{item.name}</h3>
                          {!item.isAvailable && (
                            <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full shrink-0">Out of stock</span>
                          )}
                        </div>
                        <p className="text-xs md:text-sm text-slate-500 line-clamp-2 mt-1 leading-relaxed">{item.description}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-sm md:text-base font-bold text-slate-900">₦{Number(item.price).toLocaleString()}</span>
                        {item.isAvailable ? (
                          qty > 0 ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => removeItem(item.id)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition active:scale-90">
                                <span className="material-symbols-outlined text-lg">remove</span>
                              </button>
                              <span className="text-sm font-bold text-slate-900 w-5 text-center">{qty}</span>
                              <button onClick={() => addItem(item, restaurant.id, restaurant.name)} className="w-8 h-8 rounded-full bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center transition active:scale-90">
                                <span className="material-symbols-outlined text-lg">add</span>
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => addItem(item, restaurant.id, restaurant.name)} className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-full transition active:scale-95">
                              Add
                            </button>
                          )
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Unavailable</span>
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

      {/* Mobile cart bar */}
      {cartItemCount > 0 && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 z-40 px-4 animate-fade-up">
          <button
            onClick={() => navigate("/cart")}
            className="w-full bg-slate-900 text-white rounded-2xl py-4 px-6 flex items-center justify-between shadow-lg active:scale-[0.98] transition"
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold">{cartItemCount}</span>
              <span className="font-bold text-sm">View Cart</span>
            </div>
            <span className="font-bold text-amber-400 text-sm">
              ₦{cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0).toLocaleString()}
            </span>
          </button>
        </div>
      )}
    </AppLayout>
  );
};

export default RestaurantDetail;
