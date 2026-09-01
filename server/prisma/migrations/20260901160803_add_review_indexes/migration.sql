-- CreateIndex
CREATE INDEX "RestaurantReview_restaurantId_createdAt_idx" ON "RestaurantReview"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "RiderReview_riderId_createdAt_idx" ON "RiderReview"("riderId", "createdAt");
