-- AlterTable
-- null stockQuantity = not tracked (unlimited); 0 = sold out.
ALTER TABLE "MenuItem" ADD COLUMN "stockQuantity" INTEGER;

-- AlterTable
-- True while an order is holding reserved stock; released once on cancellation.
ALTER TABLE "Order" ADD COLUMN "stockReserved" BOOLEAN NOT NULL DEFAULT false;
