-- AlterTable
ALTER TABLE "Rider"
  ADD COLUMN "accountNameMismatch" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bankDetailsUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "bankDetailsReviewRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN "riderId" INTEGER;

-- CreateIndex
CREATE INDEX "Payout_riderId_status_idx" ON "Payout"("riderId", "status");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_riderId_fkey"
  FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing RIDER payout belongs to the rider on the order's
-- (current) delivery. A delivered order is never reassigned, so this is exact.
UPDATE "Payout" p
SET "riderId" = d."riderId"
FROM "Delivery" d
WHERE p."orderId" = d."orderId"
  AND p."type" = 'RIDER'
  AND p."riderId" IS NULL;
