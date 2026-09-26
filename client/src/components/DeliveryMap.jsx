import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet's default marker icons break under Vite's bundler unless pointed
// at CDN-hosted images explicitly — this is the standard fix.
const restaurantIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
const customerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  className: "hue-rotate-180", // visually distinguish from the restaurant pin
});

// Opens the device's own Maps app for real turn-by-turn — we don't build
// navigation ourselves, just hand off coordinates to what's already on the phone.
function openDirections(lat, lng) {
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
}

export default function DeliveryMap({ restaurant, delivery }) {
  const hasRestaurant = restaurant?.lat != null && restaurant?.lng != null;
  const hasCustomer = delivery?.deliveryLat != null && delivery?.deliveryLng != null;

  if (!hasRestaurant && !hasCustomer) {
    return (
      <div className="bg-slate-50 rounded-xl p-4 text-center text-xs text-slate-400">
        No location pin available for this order yet — use the written address above.
      </div>
    );
  }

  // Center the map on whichever pin exists; if both exist, center on the customer
  // (that's where the rider is usually heading during the active-delivery phase).
  const center = hasCustomer
    ? [delivery.deliveryLat, delivery.deliveryLng]
    : [restaurant.lat, restaurant.lng];

  return (
    <div className="rounded-xl overflow-hidden border border-slate-200">
      <MapContainer center={center} zoom={15} style={{ height: "220px", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        {hasRestaurant && (
          <Marker position={[restaurant.lat, restaurant.lng]} icon={restaurantIcon}>
            <Popup>{restaurant.name} (pickup)</Popup>
          </Marker>
        )}
        {hasCustomer && (
          <Marker position={[delivery.deliveryLat, delivery.deliveryLng]} icon={customerIcon}>
            <Popup>Customer (drop-off)</Popup>
          </Marker>
        )}
      </MapContainer>

      <div className="flex gap-2 p-2 bg-white">
        {hasRestaurant && (
          <button
            onClick={() => openDirections(restaurant.lat, restaurant.lng)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition"
          >
            <span className="material-symbols-outlined text-sm">storefront</span>
            Navigate to restaurant
          </button>
        )}
        {hasCustomer && (
          <button
            onClick={() => openDirections(delivery.deliveryLat, delivery.deliveryLng)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition"
          >
            <span className="material-symbols-outlined text-sm">person_pin_circle</span>
            Navigate to customer
          </button>
        )}
      </div>
    </div>
  );
}