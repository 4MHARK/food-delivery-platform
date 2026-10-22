-- AlterTable
-- refundedAt is the "refund claimed" marker that serializes cancellation and
-- late-payment verification; refundReference records the Paystack refund id.
ALTER TABLE "Payment" ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundReference" TEXT;
