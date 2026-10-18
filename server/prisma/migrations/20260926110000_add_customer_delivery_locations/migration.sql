CREATE TABLE "CustomerDeliveryLocation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDeliveryLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerDeliveryLocation_userId_idx" ON "CustomerDeliveryLocation"("userId");

ALTER TABLE "CustomerDeliveryLocation" ADD CONSTRAINT "CustomerDeliveryLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;