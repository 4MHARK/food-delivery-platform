// Campus landmark seed data — names/categories first, coordinates later.
//
// Coordinates are intentionally null until collected manually:
//   1. Open Google Maps or openstreetmap.org in a browser.
//   2. Find the exact building entrance (satellite view, not the campus centre).
//   3. Google: right-click -> copy coordinates. OSM: Share -> copy lat/lng.
//   4. Paste 6-decimal lat/lng below. Leave null if unsure.
//   5. Run `npx prisma db seed` (idempotent; existing non-null coords are preserved).
//
// Add the rest of the campus buildings here. Do not invent coordinates.
export const CAMPUS_LANDMARKS = [
  {
    name: "Esther Building (Girls Hostel)",
    category: "RESIDENCE",
    aliases: ["Esther", "Esther Hall", "Girls Hostel"],
    lat: null,
    lng: null,
    sortOrder: 10,
  },
  // Examples of the shape:
  // { name: "Main Gate", category: "TRANSPORT", aliases: ["Gate"], lat: null, lng: null, sortOrder: 20 },
  // { name: "Faculty of Science", category: "ACADEMIC", aliases: ["Science"], lat: null, lng: null, sortOrder: 30 },
  // { name: "Campus Cafeteria", category: "FOOD", aliases: ["Cafeteria", "Canteen"], lat: null, lng: null, sortOrder: 40 },
];
