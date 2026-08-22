-- CreateEnum
CREATE TYPE "RestaurantApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "Campus" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- Seed a default campus so existing rows have something to belong to (idempotent guard).
INSERT INTO "Campus" ("name", "address", "createdAt", "updatedAt")
SELECT 'Main Campus', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Campus");

-- AlterTable
ALTER TABLE "User" ADD COLUMN "campusId" INTEGER;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN "campusId" INTEGER,
ADD COLUMN "approvalStatus" "RestaurantApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- Backfill existing restaurants into the default campus, then make the column required.
UPDATE "Restaurant" SET "campusId" = (SELECT "id" FROM "Campus" WHERE "name" = 'Main Campus' LIMIT 1)
WHERE "campusId" IS NULL;
ALTER TABLE "Restaurant" ALTER COLUMN "campusId" SET NOT NULL;

-- Existing restaurants were live before this change; approve them so the demo stays populated.
-- (New restaurants default to PENDING via the column default and must be approved.)
UPDATE "Restaurant" SET "approvalStatus" = 'APPROVED';

-- AlterTable
ALTER TABLE "Rider" ADD COLUMN "campusId" INTEGER,
ADD COLUMN "isSuspended" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing riders into the default campus, then make the column required.
UPDATE "Rider" SET "campusId" = (SELECT "id" FROM "Campus" WHERE "name" = 'Main Campus' LIMIT 1)
WHERE "campusId" IS NULL;
ALTER TABLE "Rider" ALTER COLUMN "campusId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Restaurant_campusId_idx" ON "Restaurant"("campusId");

-- CreateIndex
CREATE INDEX "Rider_campusId_idx" ON "Rider"("campusId");

-- CreateIndex
CREATE INDEX "User_campusId_idx" ON "User"("campusId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rider" ADD CONSTRAINT "Rider_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
