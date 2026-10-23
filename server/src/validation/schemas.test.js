import test from "node:test";
import assert from "node:assert/strict";
import { checkoutSchema, deliveryStatusSchema } from "./schemas.js";

const base = {
  restaurantId: 1,
  idempotencyKey: "test-key",
  items: [{ menuItemId: 1, quantity: 1 }],
};

test("checkout accepts a landmark and optional detail", () => {
  const result = checkoutSchema.safeParse({
    ...base,
    deliveryLandmarkId: 5,
    deliveryDetail: "Block C, Room 214",
  });
  assert.equal(result.success, true);
});

test("checkout accepts client coordinates as the landmark no-pin fallback", () => {
  const result = checkoutSchema.safeParse({
    ...base,
    deliveryLandmarkId: 5,
    deliveryLat: 6.8,
    deliveryLng: 3.45,
  });
  assert.equal(result.success, true);
});

test("checkout rejects landmark + deliveryAddress", () => {
  const result = checkoutSchema.safeParse({
    ...base,
    deliveryLandmarkId: 5,
    deliveryAddress: "Esther Building",
  });
  assert.equal(result.success, false);
});

test("checkout rejects saved location + landmark", () => {
  const result = checkoutSchema.safeParse({
    ...base,
    savedLocationId: 1,
    deliveryLandmarkId: 5,
  });
  assert.equal(result.success, false);
});

test("checkout rejects saved location + custom address/coordinates", () => {
  const result = checkoutSchema.safeParse({
    ...base,
    savedLocationId: 1,
    deliveryAddress: "Somewhere",
    deliveryLat: 6.8,
    deliveryLng: 3.45,
  });
  assert.equal(result.success, false);
});

test("checkout accepts a custom address with both coordinates", () => {
  const result = checkoutSchema.safeParse({
    ...base,
    deliveryAddress: "Somewhere",
    deliveryLat: 6.8,
    deliveryLng: 3.45,
  });
  assert.equal(result.success, true);
});

test("checkout rejects a custom address without coordinates", () => {
  const result = checkoutSchema.safeParse({
    ...base,
    deliveryAddress: "Somewhere",
  });
  assert.equal(result.success, false);
});

test("checkout rejects landmark detail without a landmark", () => {
  const result = checkoutSchema.safeParse({
    ...base,
    deliveryAddress: "Somewhere",
    deliveryLat: 6.8,
    deliveryLng: 3.45,
    deliveryDetail: "Room 2",
  });
  assert.equal(result.success, false);
});

test("delivery status accepts coordinates with capturedAt", () => {
  const result = deliveryStatusSchema.safeParse({
    status: "CLOSE_BY",
    lat: 6.8,
    lng: 3.45,
    accuracy: 10,
    capturedAt: "2026-10-23T10:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("delivery status rejects coordinates without capturedAt", () => {
  const result = deliveryStatusSchema.safeParse({
    status: "CLOSE_BY",
    lat: 6.8,
    lng: 3.45,
    accuracy: 10,
  });
  assert.equal(result.success, false);
});

test("delivery status rejects one coordinate", () => {
  const result = deliveryStatusSchema.safeParse({
    status: "CLOSE_BY",
    lat: 6.8,
    capturedAt: "2026-10-23T10:00:00.000Z",
  });
  assert.equal(result.success, false);
});

test("delivery status allows missing accuracy; the server flags it", () => {
  const result = deliveryStatusSchema.safeParse({
    status: "DELIVERED",
    lat: 6.8,
    lng: 3.45,
    capturedAt: "2026-10-23T10:00:00.000Z",
  });
  assert.equal(result.success, true);
});

test("delivery status requires a reason of at least 5 characters when supplied", () => {
  const result = deliveryStatusSchema.safeParse({
    status: "CLOSE_BY",
    locationUnverifiedReason: "no",
  });
  assert.equal(result.success, false);
});
