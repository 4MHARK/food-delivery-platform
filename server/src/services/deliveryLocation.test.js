import test from "node:test";
import assert from "node:assert/strict";
import { resolveLandmarkLocation } from "./deliveryLocation.js";

const landmark = {
  id: 1,
  name: "Esther Building",
  lat: 6.8,
  lng: 3.45,
  campusId: 1,
  isActive: true,
};

test("uses landmark coordinates and composes the address", () => {
  const result = resolveLandmarkLocation({
    landmark,
    restaurantCampusId: 1,
    deliveryDetail: "Room 204",
    deliveryLat: 1,
    deliveryLng: 1,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.location.landmarkId, 1);
  assert.equal(result.location.lat, 6.8);
  assert.equal(result.location.lng, 3.45);
  assert.equal(result.location.detail, "Room 204");
  assert.equal(result.location.address, "Esther Building — Room 204");
});

test("falls back to client coordinates when the landmark has no pin", () => {
  const result = resolveLandmarkLocation({
    landmark: { ...landmark, lat: null, lng: null },
    restaurantCampusId: 1,
    deliveryDetail: "",
    deliveryLat: 6.81,
    deliveryLng: 3.46,
  });

  assert.equal(result.location.lat, 6.81);
  assert.equal(result.location.lng, 3.46);
  assert.equal(result.location.detail, null);
  assert.equal(result.location.address, "Esther Building");
});

test("does not mix a landmark latitude with a client longitude", () => {
  const result = resolveLandmarkLocation({
    landmark: { ...landmark, lat: 6.8, lng: null },
    restaurantCampusId: 1,
    deliveryLat: 1,
    deliveryLng: 1,
  });

  assert.equal(result.location.lat, 1);
  assert.equal(result.location.lng, 1);
});

test("rejects a landmark with no pin and no client coordinates", () => {
  const result = resolveLandmarkLocation({
    landmark: { ...landmark, lat: null, lng: null },
    restaurantCampusId: 1,
  });

  assert.match(result.error, /no map pin/i);
});

test("rejects a wrong-campus landmark", () => {
  const result = resolveLandmarkLocation({
    landmark: { ...landmark, campusId: 2 },
    restaurantCampusId: 1,
  });

  assert.match(result.error, /not available/i);
});

test("rejects an inactive landmark", () => {
  const result = resolveLandmarkLocation({
    landmark: { ...landmark, isActive: false },
    restaurantCampusId: 1,
  });

  assert.match(result.error, /not available/i);
});
