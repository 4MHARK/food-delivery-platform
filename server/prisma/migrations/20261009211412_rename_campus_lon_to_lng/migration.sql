/*
  Warnings:

  - You are about to drop the column `lon` on the `Campus` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Campus" DROP COLUMN "lon",
ADD COLUMN     "lng" DOUBLE PRECISION;
