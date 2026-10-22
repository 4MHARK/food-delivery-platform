-- AlterEnum
-- transfer.reversed webhooks move a SUCCESS payout to REVERSED. The value is
-- added here only; it is first used by application queries after this
-- migration commits.
ALTER TYPE "PayoutStatus" ADD VALUE 'REVERSED';
