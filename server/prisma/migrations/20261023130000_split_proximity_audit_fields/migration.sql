-- Keep CLOSE_BY and DELIVERED location evidence separate. The previous
-- summary fields were overwritten by the second check, which defeated the
-- audit trail.
ALTER TABLE "Delivery"
  ADD COLUMN "closeByCapturedAt" TIMESTAMP(3),
  ADD COLUMN "closeByDistanceMeters" DOUBLE PRECISION,
  ADD COLUMN "closeByUnverifiedReason" TEXT,
  ADD COLUMN "deliveredCapturedAt" TIMESTAMP(3),
  ADD COLUMN "deliveredDistanceMeters" DOUBLE PRECISION,
  ADD COLUMN "deliveredUnverifiedReason" TEXT;

ALTER TABLE "Delivery"
  DROP COLUMN "proximityDistanceMeters",
  DROP COLUMN "locationVerified",
  DROP COLUMN "locationUnverifiedReason";
