-- Add indexes on foreign-key columns that power frequent lookups:
--   "orders for a restaurant", "menu items for a restaurant", "items for an order", etc.
-- PostgreSQL creates indexes for @unique/@id automatically, but NOT for plain foreign keys,
-- so these queries would otherwise sequential-scan at scale.

CREATE INDEX "Restaurant_ownerId_idx" ON "Restaurant"("ownerId");
CREATE INDEX "MenuItem_restaurantId_idx" ON "MenuItem"("restaurantId");
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");
CREATE INDEX "Delivery_riderId_idx" ON "Delivery"("riderId");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");
