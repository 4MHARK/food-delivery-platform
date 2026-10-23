import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import AppLayout from "../components/AppLayout";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { loadPaystack } from "../lib/paystack";
import LandmarkPicker from "../components/LandmarkPicker";
import { getCurrentPosition, nearestLandmark } from "../lib/geo";

const Cart = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, addItem, removeItem, clearItem, clearCart, itemCount, total } = useCart();
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState(null);
  const [deliveryLng, setDeliveryLng] = useState(null);
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | loading | success | error
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKeyRef = useRef(null);
  const paymentHandledRef = useRef(false);
  const [feesByRestaurant, setFeesByRestaurant] = useState({});

  // Campus landmark drop-off
  const [restaurantMeta, setRestaurantMeta] = useState({}); // restaurantId -> restaurant | null
  const [landmarks, setLandmarks] = useState([]);
  const [landmarksLoading, setLandmarksLoading] = useState(false);
  const [landmarksFetched, setLandmarksFetched] = useState(false);
  const [landmarkId, setLandmarkId] = useState(null);
  const [landmarkDetail, setLandmarkDetail] = useState("");
  const [nearest, setNearest] = useState(null);
  const [customAddress, setCustomAddress] = useState(false);

  // Group items by restaurant
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.restaurantId]) {
      acc[item.restaurantId] = {
        restaurantName: item.restaurantName,
        restaurantId: item.restaurantId,
        items: [],
      };
    }
    acc[item.restaurantId].items.push(item);
    return acc;
  }, {});

  const restaurantIds = [...new Set(items.map((item) => item.restaurantId))];
  const campusIds = [
    ...new Set(
      restaurantIds
        .map((id) => restaurantMeta[id]?.campusId)
        .filter((id) => id != null)
    ),
  ];
  const campusId = campusIds.length === 1 ? campusIds[0] : null;
  const multiCampus = campusIds.length > 1;
  const metaSettled = restaurantIds.every(
    (id) => restaurantMeta[id] !== undefined
  );

  const selectedLandmark =
    landmarks.find((landmark) => landmark.id === landmarkId) || null;
  const usingCustomAddress =
    customAddress ||
    (metaSettled && !campusId) ||
    (Boolean(campusId) &&
      landmarksFetched &&
      landmarks.length === 0);
  const landmarkFlowReady = metaSettled && !multiCampus;

  // Capture the customer's current position for the no-pin fallback and to
  // suggest the nearest campus landmark. It never overwrites an address and no
  // longer calls a third-party reverse geocoder.
  const handleUseLocation = async () => {
    setLocationStatus("loading");
    setError("");

    try {
      const position = await getCurrentPosition();
      setDeliveryLat(position.lat);
      setDeliveryLng(position.lng);
      setLocationStatus("success");

      const suggestion = nearestLandmark(position, landmarks, {
        maxDistanceMeters: 300,
      });
      setNearest(suggestion);
      if (suggestion) {
        setLandmarkId(suggestion.landmark.id);
        setCustomAddress(false);
      }
    } catch (e) {
      setLocationStatus("error");
      setError(e?.message || "Couldn't get your location.");
    }
  };

  const handlePlaceOrder = async (restaurantId, restaurantItems) => {
    if (multiCampus) {
      setError("Your cart has restaurants from different campuses. Remove items until they share one campus.");
      return;
    }

    if (!usingCustomAddress) {
      if (!selectedLandmark) {
        setError("Choose your drop-off point from the campus list.");
        return;
      }
      if (
        (selectedLandmark.lat == null || selectedLandmark.lng == null) &&
        (deliveryLat === null || deliveryLng === null)
      ) {
        setError("This drop-off point has no map pin yet. Tap \"Use my current location\" so the rider can find you.");
        return;
      }
    } else {
      if (!deliveryAddress.trim()) {
        setError("Please enter a delivery address");
        return;
      }
      if (deliveryLat === null || deliveryLng === null) {
        setError("Please share your location so the rider can find you — tap \"Use my current location\" above.");
        return;
      }
    }

    // Generate an idempotency key once per checkout attempt — reused on retry.
    // crypto.randomUUID() is unavailable in non-HTTPS contexts (e.g. testing over
    // a LAN IP on a phone), so fall back to a timestamped random string.
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current =
        (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
        `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    try {
      setPlacing(true);
      setError("");

      // Load the SDK before creating the order, so an ad blocker or CDN failure
      // leaves no orphaned PENDING_PAYMENT order behind.
      await loadPaystack();

      // Step 1: Create the order on the backend. In landmark mode the server
      // owns the name/coordinates; the customer's position is only a fallback
      // when the landmark has no map pin yet.
      const payload = {
        restaurantId,
        idempotencyKey: idempotencyKeyRef.current,
        items: restaurantItems.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
        })),
      };

      if (!usingCustomAddress) {
        payload.deliveryLandmarkId = selectedLandmark.id;
        if (landmarkDetail.trim()) {
          payload.deliveryDetail = landmarkDetail.trim();
        }
        if (selectedLandmark.lat == null || selectedLandmark.lng == null) {
          payload.deliveryLat = deliveryLat;
          payload.deliveryLng = deliveryLng;
        }
      } else {
        payload.deliveryAddress = deliveryAddress.trim();
        payload.deliveryLat = deliveryLat;
        payload.deliveryLng = deliveryLng;
      }

      const data = await api.post("/orders/checkout", payload);

      const { order, payment } = data;

      setPlacing(false);

      // Order created — reset the key so the next order gets a fresh one
      idempotencyKeyRef.current = null;
      // Reset the handler so a fresh attempt can navigate again
      paymentHandledRef.current = false;

      // Open Paystack popup for payment. The cart is NOT cleared here — items are
      // only removed once payment is confirmed, so cancelling the popup leaves the
      // user's cart intact (they can add more items or retry).
      const handler = PaystackPop.setup({
        key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
        email: user.email,
        amount: Math.round(Number(payment.amount) * 100), // Naira → kobo
        currency: "NGN",
        ref: payment.reference,
        onSuccess: async () => {
          // Paystack fires onClose after success too — act only once.
          if (paymentHandledRef.current) return;
          paymentHandledRef.current = true;
          try {
            await api.post("/payments/verify", { reference: payment.reference });
            restaurantItems.forEach((item) => clearItem(item.menuItemId));
            navigate(`/orders/${order.id}`);
          } catch {
            // Surface the failure instead of silently swallowing it
            setError("Payment received, but we couldn't confirm it with our servers. Please check your Orders page or contact support.");
          }
        },
        onCancel: () => {
          // User closed the popup without paying — stay on the cart.
          paymentHandledRef.current = true;
        },
        onClose: () => {
          // Always fires when the popup closes (including after success/cancel).
          paymentHandledRef.current = true;
        },
      });
      handler.openIframe();
    } catch (e) {
      setError(e?.message || "Something went wrong. Please try again.");
      setPlacing(false);
    }
  };

  // Fetch server-computed fees for each restaurant group. The server is the single
  // source of truth for money — the cart only ever displays its numbers.
  useEffect(() => {
    if (items.length === 0) {
      setFeesByRestaurant({});
      return;
    }

    let cancelled = false;
    const groups = items.reduce((acc, item) => {
      if (!acc[item.restaurantId]) acc[item.restaurantId] = [];
      acc[item.restaurantId].push(item);
      return acc;
    }, {});

    const fetchFees = async () => {
      const next = {};
      await Promise.all(
        Object.entries(groups).map(async ([restaurantId, groupItems]) => {
          try {
            const data = await api.post("/orders/estimate", {
              restaurantId: Number(restaurantId),
              items: groupItems.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
            });
            next[restaurantId] = data.fees;
          } catch {
            // Leave undefined → the UI shows a placeholder until the server responds
          }
        })
      );
      if (!cancelled) setFeesByRestaurant(next);
    };
    fetchFees();

    return () => {
      cancelled = true;
    };
  }, [items]);

  // Fetch restaurant metadata so the cart can resolve its campus. This also
  // covers carts saved in localStorage before campusId was available.
  useEffect(() => {
    const missing = restaurantIds.filter(
      (id) => restaurantMeta[id] === undefined
    );
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        missing.map(async (id) => {
          try {
            const data = await api.get(`/restaurants/${id}`, { auth: false });
            return [id, data.restaurant || null];
          } catch {
            return [id, null];
          }
        })
      );
      if (!cancelled) {
        setRestaurantMeta((prev) => ({
          ...prev,
          ...Object.fromEntries(entries),
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, restaurantMeta]);

  // Load the landmark directory for the shared campus. Multi-campus carts are
  // blocked in the UI; a failed metadata fetch falls back to a custom address.
  useEffect(() => {
    if (!campusId) {
      setLandmarks([]);
      setLandmarksFetched(false);
      return;
    }

    let cancelled = false;
    setLandmarksLoading(true);
    setLandmarksFetched(false);
    setLandmarkId(null);
    setCustomAddress(false);
    setNearest(null);

    api
      .get(`/campuses/${campusId}/landmarks`, { auth: false })
      .then((data) => {
        if (!cancelled) setLandmarks(data.landmarks || []);
      })
      .catch(() => {
        if (!cancelled) setLandmarks([]);
      })
      .finally(() => {
        if (!cancelled) {
          setLandmarksLoading(false);
          setLandmarksFetched(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campusId]);

  return (
    <AppLayout onBack={() => navigate(-1)} showCart={false} showUserDropdown={false}>
      <div className="px-4 lg:px-8 max-w-2xl mx-auto pt-8 pb-24 md:pb-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Your Cart</h2>
        <p className="text-slate-500 text-sm mb-8">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 font-medium">{error}</p>
        )}

        {/* Empty cart */}
        {items.length === 0 && (
          <div className="text-center py-16">
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-5xl text-slate-300">shopping_bag</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Your cart is empty</h3>
            <p className="text-slate-500 mb-8">Add items from a restaurant to get started.</p>
            <button
              onClick={() => navigate("/restaurants")}
              className="rounded-full bg-amber-500 text-slate-950 font-semibold py-3 px-8 shadow-md hover:bg-amber-600 transition active:scale-95"
            >
              Browse Restaurants
            </button>
          </div>
        )}

        {/* Cart items grouped by restaurant */}
        {items.length > 0 && (
          <div className="space-y-8">
            {/* Drop-off point */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="block text-sm font-semibold text-slate-700">
                  Drop-off point
                </span>
                {!multiCampus && metaSettled && landmarks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomAddress((prev) => !prev);
                      setError("");
                    }}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-800"
                  >
                    {usingCustomAddress
                      ? "Choose a campus landmark"
                      : "My building isn't listed"}
                  </button>
                )}
              </div>

              {multiCampus && (
                <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
                  Your cart has restaurants from different campuses. Remove
                  items until they share one campus before ordering.
                </p>
              )}

              {!multiCampus && !metaSettled && (
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
              )}

              {!multiCampus && metaSettled && !usingCustomAddress && (
                <>
                  <LandmarkPicker
                    landmarks={landmarks}
                    value={landmarkId}
                    loading={landmarksLoading}
                    onChange={(landmark) => {
                      setLandmarkId(landmark.id);
                      setError("");
                    }}
                  />

                  {selectedLandmark && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-sm font-bold text-amber-900">
                        {selectedLandmark.name}
                      </p>
                      <p className="mt-0.5 text-xs text-amber-800">
                        Add a block, floor, room, or nearby description so the
                        rider can find you.
                      </p>
                      <input
                        type="text"
                        value={landmarkDetail}
                        onChange={(e) =>
                          setLandmarkDetail(e.target.value.slice(0, 120))
                        }
                        maxLength={120}
                        placeholder="e.g. Block C, Room 214"
                        className="mt-2 h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-sm outline-none focus:border-amber-500"
                      />
                    </div>
                  )}
                </>
              )}

              {!multiCampus && metaSettled && usingCustomAddress && (
                <div>
                  <label htmlFor="address" className="sr-only">
                    Delivery address
                  </label>
                  <input
                    type="text"
                    id="address"
                    placeholder="Enter your delivery address (e.g. Block 3, Room 14, Hostel A)"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border-2 border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition text-sm"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    A campus landmark is more reliable; use this only if your
                    building isn't listed.
                  </p>
                </div>
              )}

              {!multiCampus && metaSettled && (
                <>
                  <button
                    type="button"
                    onClick={handleUseLocation}
                    disabled={locationStatus === "loading"}
                    className={`mt-3 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-95 ${
                      locationStatus === "success"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {locationStatus === "success"
                        ? "check_circle"
                        : "my_location"}
                    </span>
                    {locationStatus === "loading"
                      ? "Getting your location..."
                      : locationStatus === "success"
                        ? "Location captured"
                        : "Use my current location"}
                  </button>

                  {locationStatus === "success" && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      {usingCustomAddress
                        ? "Location captured. The rider will use this pin with your written address."
                        : nearest
                          ? `You appear to be near ${nearest.landmark.name} (${nearest.distanceMeters} m). Confirm it above, or choose another landmark.`
                          : selectedLandmark &&
                              (selectedLandmark.lat == null ||
                                selectedLandmark.lng == null)
                            ? "Location captured. This landmark has no map pin yet, so your pin will guide the rider."
                            : "Choose the closest landmark from the list above."}
                    </p>
                  )}
                </>
              )}
            </div>

            {Object.values(grouped).map((group) => {
              const groupTotal = group.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
              const fees = feesByRestaurant[group.restaurantId];
              return (
                <div key={group.restaurantId} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-500">storefront</span>
                      <h3 className="font-bold text-slate-900">{group.restaurantName}</h3>
                    </div>
                    <button
                      onClick={() => navigate(`/restaurants/${group.restaurantId}`)}
                      className="text-xs text-amber-500 font-semibold hover:text-amber-600 transition"
                    >
                      Add more
                    </button>
                  </div>

                  <div className="divide-y divide-slate-50">
                    {group.items.map((item) => (
                      <div key={item.menuItemId} className="px-5 py-4 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                          <p className="text-sm text-slate-500">{formatCurrency(Number(item.price))} each</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => removeItem(item.menuItemId)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition active:scale-90">
                            <span className="material-symbols-outlined text-lg">remove</span>
                          </button>
                          <span className="text-sm font-bold text-slate-900 w-4 text-center">{item.quantity}</span>
                          <button
                            onClick={() => addItem({ id: item.menuItemId, name: item.name, price: item.price, imageUrl: item.imageUrl }, item.restaurantId, item.restaurantName)}
                            className="w-8 h-8 rounded-full bg-amber-500 text-slate-950 hover:bg-amber-600 flex items-center justify-center transition active:scale-90"
                          >
                            <span className="material-symbols-outlined text-lg">add</span>
                          </button>
                          <button onClick={() => clearItem(item.menuItemId)} className="ml-2 p-1 text-slate-300 hover:text-red-400 transition">
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Fee breakdown + Place Order */}
                  <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100">
                    <div className="space-y-1.5 mb-4 text-sm">
                      <div className="flex justify-between text-slate-500">
                        <span>Subtotal</span>
                        <span>{formatCurrency(groupTotal)}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Delivery fee</span>
                        <span>{fees ? formatCurrency(fees.deliveryFee) : "—"}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Service fee</span>
                        <span>{fees ? formatCurrency(fees.serviceFee) : "—"}</span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                        <span>Total</span>
                        <span>{fees ? formatCurrency(fees.totalAmount) : "—"}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {group.items.reduce((s, i) => s + i.quantity, 0)} {group.items.reduce((s, i) => s + i.quantity, 0) === 1 ? "item" : "items"}
                      </span>
                      <button
                        onClick={() => handlePlaceOrder(group.restaurantId, group.items)}
                        disabled={
                          placing ||
                          !landmarkFlowReady ||
                          (!usingCustomAddress &&
                            (!selectedLandmark ||
                              ((selectedLandmark.lat == null ||
                                selectedLandmark.lng == null) &&
                                deliveryLat === null)))
                        }
                        className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 disabled:opacity-60 text-slate-950 text-sm font-bold px-6 py-3 rounded-full transition active:scale-95"
                      >
                        {placing ? "Placing..." : "Place Order"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {Object.keys(grouped).length > 1 && (
              <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-5 py-4">
                <span className="font-bold text-slate-900">Total</span>
                <span className="font-bold text-lg text-slate-900">{formatCurrency(total)}</span>
              </div>
            )}

            <div className="text-center">
              <button onClick={clearCart} className="text-sm text-slate-400 hover:text-red-500 transition font-medium">Clear cart</button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Cart;