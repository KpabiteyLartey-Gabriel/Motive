-- Servicing renewal tracking: insurance and roadworthiness expiry dates
-- per vehicle (dates only, no documents collected).
ALTER TABLE "vehicles" ADD COLUMN "insuranceExpiryDate" TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN "roadWorthinessExpiryDate" TIMESTAMP(3);
