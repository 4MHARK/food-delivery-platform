/*
  Warnings:

  - A unique constraint covering the columns `[emailDomain]` on the table `Campus` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Campus" ADD COLUMN     "emailDomain" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lon" DOUBLE PRECISION;

-- CreateIndex
CREATE UNIQUE INDEX "Campus_emailDomain_key" ON "Campus"("emailDomain");
