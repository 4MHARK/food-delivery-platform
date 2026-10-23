-- AlterEnum
-- PostgreSQL 12+ allows ADD VALUE inside a transaction; the new value is only
-- used by the application after this migration commits.
ALTER TYPE "DeliveryFailureKind" ADD VALUE IF NOT EXISTS 'STALE';
