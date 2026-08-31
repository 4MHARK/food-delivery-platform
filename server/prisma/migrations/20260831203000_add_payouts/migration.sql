-- CreateEnum
CREATE TYPE "PayoutType" AS ENUM ('RESTAURANT', 'RIDER');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "accountName" TEXT,
ADD COLUMN     "recipientCode" TEXT;

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankCode" TEXT,
ADD COLUMN     "accountNumber" TEXT,
ADD COLUMN     "accountName" TEXT,
ADD COLUMN     "recipientCode" TEXT;

-- CreateTable
CREATE TABLE "Payout" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "type" "PayoutType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "recipientCode" TEXT,
    "reference" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payout_orderId_idx" ON "Payout"("orderId");

-- CreateIndex
CREATE INDEX "Payout_type_status_idx" ON "Payout"("type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_reference_key" ON "Payout"("reference");

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
