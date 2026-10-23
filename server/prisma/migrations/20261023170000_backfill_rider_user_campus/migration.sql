-- Align legacy rider accounts with their rider profile's campus. Before this
-- change the User and Rider campus could diverge (all existing riders have
-- User.campusId = NULL), which made the new rider-campus check vacuous.
-- Existing riders already deliver on rider.campusId, so that is the truth.
UPDATE "User" u
SET "campusId" = r."campusId"
FROM "Rider" r
WHERE r."userId" = u.id
  AND u."campusId" IS NULL;
