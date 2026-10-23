-- Brute-force protection for the customer handoff code.
-- Stored on "Order" so reassigning the delivery does not reset the counter.
ALTER TABLE "Order" ADD COLUMN "deliveryCodeAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "deliveryCodeLockedUntil" TIMESTAMP(3);
