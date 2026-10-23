# Campus Landmarks + Rider Proximity — Implementation Notes

**Date:** 2026-10-23
**Status:** Implemented, tested locally, migration applied to Supabase.
**Feature commit:** `49d2f51` — `feat: add rider profile management, campus landmarks, and delivery-code protection`
**Still uncommitted:** the final Cart UX polish in `client/src/pages/Cart.jsx`
**Not deployed yet:** backend (Render) and client (Vercel)

---

## Why this exists

Free reverse geocoding (Nominatim/OSM) returns only broad areas such as
“Osun State, Agbandudu, Nigeria”. It cannot reliably say **“Esther Building,
Girls Hostel, Room 204”**. Google Maps could, but requires a billing account and
API key.

The solution is to **own the campus data**:

- A campus landmark directory lists buildings, hostels, gates, faculties, etc.
- Customers pick a landmark and add a room/block detail.
- The server derives the address and coordinates from the landmark.
- The rider must submit a fresh GPS reading within **150 m** of the drop-off
  point before `CLOSE_BY`/`DELIVERED`.

**No Google Maps API key is used.** Leaflet + OpenStreetMap tiles already drive
the map, and the existing Google Maps directions link is a free URL handoff.

---

## What was built

### Database

New `CampusLandmark` model:

| Field | Notes |
|---|---|
| `name` | e.g. “Esther Building (Girls Hostel)” |
| `category` | `RESIDENCE`, `ACADEMIC`, `ADMINISTRATION`, `FOOD`, `SPORTS`, `HEALTH`, `RELIGIOUS`, `TRANSPORT`, `OTHER` |
| `aliases` | Search helpers, e.g. `["Esther", "Girls Hostel"]` |
| `lat`, `lng` | **Nullable** — names can ship before coordinates |
| `isActive`, `sortOrder` | Picker ordering / soft disable |
| `campusId` | Unique per `(campusId, name)` |

Order additions:
- `deliveryLandmarkId` (nullable relation)
- `deliveryDetail` (block/room/floor)

Delivery audit fields (kept separate per handoff event — never overwritten):
- CLOSE_BY: `closeByLat`, `closeByLng`, `closeByAccuracy`,
  `closeByCapturedAt`, `closeByAt`, `closeByVerified`,
  `closeByDistanceMeters`, `closeByUnverifiedReason`
- DELIVERED: `deliveredLat`, `deliveredLng`, `deliveredAccuracy`,
  `deliveredCapturedAt`, `deliveredVerified`, `deliveredDistanceMeters`,
  `deliveredUnverifiedReason` (plus the existing `deliveredAt`)

`*CapturedAt` is the client's GPS fix time. `closeByAt` / `deliveredAt` are the
server receipt/completion times.

Migrations applied:
- `20261023110000_add_campus_landmarks_and_proximity`
- `20261023130000_split_proximity_audit_fields`

### Backend

- `GET /campuses/:campusId/landmarks` — public, active landmarks only.
- Checkout accepts `deliveryLandmarkId` + `deliveryDetail`.
  - Validates the landmark is active and belongs to the restaurant's campus.
  - Composes `deliveryAddress = "<landmark> — <detail>"`.
  - Uses the landmark's coordinates; **ignores client coordinates** when the
    landmark has them.
  - Falls back to the customer's coordinates only when the landmark has no pin.
  - Keeps the legacy custom-address path working.
- Checkout precedence is **strictly exclusive**:
  - `savedLocationId` cannot be combined with a landmark or custom
    address/coordinates.
  - `deliveryLandmarkId` cannot be combined with `deliveryAddress`; client
    coordinates are allowed only as the no-pin fallback.
  - With neither, a custom address + both coordinates is required.
- Proximity gate runs at `CLOSE_BY` and `DELIVERED`, before the delivery-code
  check, so a far/blocked rider does not spend a code attempt.
- `server/src/utils/geo.js`:
  - `haversineMeters`
  - `getProximityConfig`
  - `evaluateDropoffLocation`
- Tests: `server/src/utils/geo.test.js` (Node's built-in test runner).

### Client

- `client/src/components/LandmarkPicker.jsx`
  - Search by name/aliases
  - Category groups
  - “No map pin yet” badge
- `client/src/pages/Cart.jsx`
  - Landmark selection + room/block detail
  - “Use my current location” suggests the nearest landmark (≤300 m)
  - Custom-address fallback (“My building isn't listed”)
  - Multi-campus carts are blocked
  - **Nominatim reverse-geocode call removed**
- `client/src/pages/RiderDashboard.jsx`
  - Fresh `navigator.geolocation` reading before `CLOSE_BY`/`DELIVERED`
  - Required-reason dialog when GPS is denied/unavailable/inaccurate
  - Keeps the entered code if the handoff is blocked
- `client/src/lib/geo.js`
  - `haversineMeters`, `getCurrentPosition`, `nearestLandmark`
- `client/src/lib/api.js`
  - `ApiError.data` now carries structured error bodies (`code`,
    `requiresReason`, `distanceMeters`, etc.)

---

## ⚠️ What you still need to do

- [ ] **Add every campus landmark name** to
      `server/prisma/data/campus-landmarks.js`.
- [ ] **Fill in lat/lng** for each landmark (see the workflow below).
- [ ] Run `cd server && npx prisma db seed` after editing the file.
- [ ] Test the Cart picker and rider proximity on a real Android device.
- [ ] Commit the final Cart UX polish in `client/src/pages/Cart.jsx`.
- [ ] Deploy the backend to Render and the client to Vercel.
- [ ] Confirm the deployed HTML no longer loads Google Fonts / Paystack on every
      page (see the earlier Lighthouse work).
- [ ] Optionally set `SEED_CAMPUS_NAME` on the seed environment if the target
      campus is not the first campus.

The seed currently has **one** landmark:

```js
{ name: "Esther Building (Girls Hostel)", category: "RESIDENCE",
  aliases: ["Esther", "Esther Hall", "Girls Hostel"], lat: null, lng: null }
```

It is attached to **Redeemers University** (the first/eXisting campus). It has
**no coordinates yet**, so customers must tap **Use my current location** until
you fill them in.

---

## How to collect landmark coordinates (no API key)

1. Open **Google Maps** or **openstreetmap.org** in a browser.
2. Search for the campus and switch to satellite view.
3. Right-click the **building entrance** (not the campus centre):
   - Google Maps: click the coordinates to copy them.
   - OSM: Share → copy the lat/lng.
4. Paste them into `server/prisma/data/campus-landmarks.js`:

```js
{
  name: "Esther Building (Girls Hostel)",
  category: "RESIDENCE",
  aliases: ["Esther", "Esther Hall", "Girls Hostel"],
  lat: 6.800337,
  lng: 3.452436,
  sortOrder: 10,
},
```

5. Re-run:

```bash
cd server
npx prisma db seed
```

The seed is idempotent and **preserves coordinates you have already filled in**
when the seed value is `null`.

---

## How the proximity gate behaves

Environment defaults (documented in `server/.env.example`):

| Variable | Default | Meaning |
|---|---:|---|
| `DELIVERY_RADIUS_METERS` | `150` | Max distance from the drop-off point |
| `DELIVERY_LOCATION_MAX_ACCURACY_METERS` | `100` | GPS accuracy treated as trustworthy |
| `DELIVERY_LOCATION_MAX_AGE_MS` | `120000` | Max age of the reading (ms) |
| `DELIVERY_CLOCK_SKEW_SECONDS` | `60` | Allowed future clock skew |
| `DELIVERY_PROXIMITY_ENFORCEMENT` | `enforce` | `enforce`, `warn`, or `off` |

The legacy names `DELIVERY_PROXIMITY_RADIUS_METERS`,
`DELIVERY_MAX_ACCURACY_METERS`, and `DELIVERY_LOCATION_MAX_AGE_SECONDS` are also
accepted.

**Missing data:** coordinates without `capturedAt` are rejected by the schema;
coordinates without `accuracy` are treated as `LOCATION_INACCURATE` and require
a reason. Neither is a silent success.

Decision order:

1. No drop-off coordinates → allow **only with a reason**, flagged.
2. No rider coordinates → allow **only with a reason**, flagged.
3. Stale reading → allow **only with a reason**, flagged.
4. Accuracy worse than the limit → allow **only with a reason**, flagged.
5. Distance > radius → **hard block** (`422 LOCATION_TOO_FAR`), status unchanged.
6. Otherwise verified; distance/accuracy/coordinates are stored on the Delivery.

The fallback is deliberately permissive so a dead GPS does not strand a rider.
It is a **risk signal and audit trail**, not cryptographic proof. A rider could
omit coordinates and type a reason; repeated unverified deliveries should be
reviewed. Photo proof is the next defense.

---

## Test results (local, 2026-10-23)

- `cd server && npm test` → **33/33 pass** (`node --test`):
  - haversine/radius/stale/inaccurate/missing-location branches
  - checkout schema precedence (saved vs landmark vs custom)
  - landmark resolution: coords precedence, no-pin fallback, wrong campus,
    inactive landmark, no coordinate mixing
  - `decideProximityAction` and per-event `buildProximityAudit` for CLOSE_BY and
    DELIVERED
- Landmark checkout:
  - No coordinates on the landmark → `400`
  - Coordinates present → `201`; order stored the landmark's coordinates, not
    the client-supplied ones; address composed correctly.
- Proximity:
  - Far `CLOSE_BY` → `422 LOCATION_TOO_FAR`
  - Missing location, no reason → `422 requiresReason`
  - Near, accurate, fresh → `200`, audit fields populated
  - Far `DELIVERED` → `422` **before** the code check
  - Near wrong code → `400`, attempts left
  - Near correct code → `200`, delivered, counters reset
  - No-map-pin order + reason → `200`, `closeByVerified=false`, reason stored in
    `closeByUnverifiedReason`
  - CLOSE_BY audit fields remained intact after DELIVERED; both event records
    were stored independently (no overwriting)
- Client production build passes.
- Cart landmark picker verified in a headless mobile browser.
- Rider dashboard loads successfully.
- Test orders, deliveries, and payouts were cleaned up; the landmark's temporary
  test coordinates were reset to `null`.

---

## Critical files

| File | Purpose |
|---|---|
| `server/prisma/schema.prisma` | `CampusLandmark`, order/delivery fields |
| `server/prisma/data/campus-landmarks.js` | **Edit this with the campus list** |
| `server/prisma/seed.js` | Idempotent landmark upsert |
| `server/src/routes/campus.routes.js` | Public landmark endpoint |
| `server/src/routes/order.routes.js` | Landmark checkout resolution |
| `server/src/routes/delivery.routes.js` | Proximity gate + audit fields |
| `server/src/utils/geo.js` | Haversine + evaluator |
| `server/src/validation/schemas.js` | Checkout/status schemas |
| `client/src/pages/Cart.jsx` | Landmark picker integration |
| `client/src/components/LandmarkPicker.jsx` | Searchable picker |
| `client/src/pages/RiderDashboard.jsx` | GPS capture + fallback dialog |
| `client/src/lib/geo.js` | Client geolocation helpers |
| `client/src/lib/api.js` | `ApiError.data` |

---

## Known limitations / next steps

- **No photo proof yet.** A rider can still be at the right location and not
  hand over the food. Add a handoff photo next.
- **No live rider tracking.** Proximity is checked only at `CLOSE_BY` and
  `DELIVERED`; there is no continuous `watchPosition` or rider map pin.
- **GPS is spoofable.** Mock-location detection (Play Integrity / native
  geolocation) and anomaly monitoring are future work.
- **No admin CRUD UI yet.** Landmarks are seed-only in this pass. Future routes
  should follow the existing campus-scoped admin pattern.
- **Landmark names are case-sensitive for uniqueness.** Normalize names in the
  future admin UI.
- **Nominatim is removed from the Cart.** If an area-label fallback is ever
  needed, proxy it server-side with an identifying User-Agent and caching.
- **Old clients** that do not send location will receive `422` at
  `CLOSE_BY`/`DELIVERED`. Use `DELIVERY_PROXIMITY_ENFORCEMENT=warn` during a
  rollout if needed.

---

## Deployment reminder

- The migration is already applied to the shared Supabase database.
- The backend still needs a **Render** deploy so the new endpoints and
  proximity logic are live.
- The client still needs a **Vercel** deploy.
- Local production builds use:
  ```bash
  cd client
  SENTRY_AUTH_TOKEN= npm run build
  ```
  (The local Sentry token in `.env` is rejected; the production token should be
  valid.)
