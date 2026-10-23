-- CreateEnum
CREATE TYPE "DeliveryFailureKind" AS ENUM ('REPORTED', 'CODE_ATTEMPTS');

-- AlterTable
ALTER TABLE "Rider"
  ADD COLUMN "failureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastFailureAt" TIMESTAMP(3),
  ADD COLUMN "flaggedForReview" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DeliveryFailure" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "riderId" INTEGER NOT NULL,
    "kind" "DeliveryFailureKind" NOT NULL,
    "reason" TEXT,
    "codeAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryFailure_orderId_idx" ON "DeliveryFailure"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryFailure_riderId_createdAt_idx" ON "DeliveryFailure"("riderId", "createdAt");

-- AddForeignKey
ALTER TABLE "DeliveryFailure" ADD CONSTRAINT "DeliveryFailure_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryFailure" ADD CONSTRAINT "DeliveryFailure_riderId_fkey"
  FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One ACTIVE delivery per rider, enforced by the database. The accept route's
-- findFirst guard is a friendly pre-check only: under Read Committed two
-- concurrent accepts can both pass it. This index makes the second commit fail.
-- Prisma cannot express partial indexes, so this lives in raw SQL.
CREATE UNIQUE INDEX "Delivery_one_active_per_rider"
  ON "Delivery" ("riderId")
  WHERE "status" NOT IN ('DELIVERED', 'FAILED');
