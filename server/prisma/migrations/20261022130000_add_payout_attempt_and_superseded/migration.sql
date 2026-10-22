-- AlterTable
-- attempt: 1 for the original payout, 2+ for retries (also encoded in reference).
-- supersededBy: id of the retry that replaced this row; excluded from "unpaid".
ALTER TABLE "Payout" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "supersededBy" INTEGER;
