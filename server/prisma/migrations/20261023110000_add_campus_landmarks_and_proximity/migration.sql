-- Campus-owned landmark directory (building-level drop-off without a paid geocoder).
CREATE TABLE "CampusLandmark" (
    "id" SERIAL NOT NULL,
    "campusId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CampusLandmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CampusLandmark_campusId_name_key" ON "CampusLandmark"("campusId", "name");
CREATE INDEX "CampusLandmark_campusId_isActive_sortOrder_idx" ON "CampusLandmark"("campusId", "isActive", "sortOrder");
ALTER TABLE "CampusLandmark" ADD CONSTRAINT "CampusLandmark_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The order records the selected landmark + room/block detail. Address and
-- coordinates remain for legacy/custom-address orders.
ALTER TABLE "Order" ADD COLUMN "deliveryLandmarkId" INTEGER;
ALTER TABLE "Order" ADD COLUMN "deliveryDetail" TEXT;
CREATE INDEX "Order_deliveryLandmarkId_idx" ON "Order"("deliveryLandmarkId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryLandmarkId_fkey" FOREIGN KEY ("deliveryLandmarkId") REFERENCES "CampusLandmark"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Optional link for the future saved-locations UI; the existing checkout path is unchanged.
ALTER TABLE "CustomerDeliveryLocation" ADD COLUMN "landmarkId" INTEGER;
CREATE INDEX "CustomerDeliveryLocation_landmarkId_idx" ON "CustomerDeliveryLocation"("landmarkId");
ALTER TABLE "CustomerDeliveryLocation" ADD CONSTRAINT "CustomerDeliveryLocation_landmarkId_fkey" FOREIGN KEY ("landmarkId") REFERENCES "CampusLandmark"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Proximity evidence captured when the rider marks Close By / Delivered.
ALTER TABLE "Delivery"
  ADD COLUMN "closeByLat" DOUBLE PRECISION,
  ADD COLUMN "closeByLng" DOUBLE PRECISION,
  ADD COLUMN "closeByAccuracy" DOUBLE PRECISION,
  ADD COLUMN "closeByAt" TIMESTAMP(3),
  ADD COLUMN "closeByVerified" BOOLEAN,
  ADD COLUMN "deliveredLat" DOUBLE PRECISION,
  ADD COLUMN "deliveredLng" DOUBLE PRECISION,
  ADD COLUMN "deliveredAccuracy" DOUBLE PRECISION,
  ADD COLUMN "deliveredVerified" BOOLEAN,
  ADD COLUMN "proximityDistanceMeters" DOUBLE PRECISION,
  ADD COLUMN "locationVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "locationUnverifiedReason" TEXT;
