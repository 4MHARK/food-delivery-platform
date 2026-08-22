-- Backfill: copy each rider's phone onto their User record before dropping it,
-- so no contact numbers are lost.
UPDATE "User" u
SET phone = r.phone
FROM "Rider" r
WHERE r."userId" = u."id";

-- Drop the now-redundant duplicate column
ALTER TABLE "Rider" DROP COLUMN "phone";
