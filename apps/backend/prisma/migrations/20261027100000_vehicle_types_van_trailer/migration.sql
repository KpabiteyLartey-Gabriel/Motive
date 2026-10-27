-- Every motor vehicle kind an owner can upload: vans and trailers join
-- cars, trucks, motorbikes and tricycles.
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'VAN';
ALTER TYPE "VehicleType" ADD VALUE IF NOT EXISTS 'TRAILER';
