/*
  Warnings:

  - The values [ASSIGNED,PICKED_UP,IN_TRANSIT] on the enum `DeliveryStatus` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[customerId,idempotencyKey]` on the table `Order` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[matricNumber]` on the table `Rider` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DeliveryStatus_new" AS ENUM ('ZILLA_ON_IT', 'AT_KITCHEN', 'BAGGED', 'MOVING', 'CLOSE_BY', 'DELIVERED', 'FAILED');
ALTER TABLE "public"."Delivery" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Delivery" ALTER COLUMN "status" TYPE "DeliveryStatus_new" USING ("status"::text::"DeliveryStatus_new");
ALTER TYPE "DeliveryStatus" RENAME TO "DeliveryStatus_old";
ALTER TYPE "DeliveryStatus_new" RENAME TO "DeliveryStatus";
DROP TYPE "public"."DeliveryStatus_old";
ALTER TABLE "Delivery" ALTER COLUMN "status" SET DEFAULT 'ZILLA_ON_IT';
COMMIT;

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "failureReason" TEXT,
ALTER COLUMN "status" SET DEFAULT 'ZILLA_ON_IT';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN     "matricNumber" TEXT,
ALTER COLUMN "licensePlate" DROP NOT NULL,
ALTER COLUMN "licenseNumber" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "RejectedOrder" (
    "id" SERIAL NOT NULL,
    "riderId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RejectedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RejectedOrder_riderId_orderId_key" ON "RejectedOrder"("riderId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_customerId_idempotencyKey_key" ON "Order"("customerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Rider_matricNumber_key" ON "Rider"("matricNumber");

-- AddForeignKey
ALTER TABLE "RejectedOrder" ADD CONSTRAINT "RejectedOrder_riderId_fkey" FOREIGN KEY ("riderId") REFERENCES "Rider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RejectedOrder" ADD CONSTRAINT "RejectedOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
