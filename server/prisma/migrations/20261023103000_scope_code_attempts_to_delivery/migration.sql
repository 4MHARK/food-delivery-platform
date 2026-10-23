-- Scope the code-attempt limit to the current rider assignment, so releasing
-- the order to another rider does not carry the lock over to them.
ALTER TABLE "Delivery" ADD COLUMN "codeAttempts" INTEGER NOT NULL DEFAULT 0;

-- The order-level counter remains a lifetime abuse counter, but the time lock
-- on the whole order is gone (it delayed the customer).
ALTER TABLE "Order" DROP COLUMN "deliveryCodeLockedUntil";
