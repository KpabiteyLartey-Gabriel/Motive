-- Engine number is not part of vehicle verification or registration on +Motive.
ALTER TABLE "vehicles" DROP COLUMN IF EXISTS "engineNumber";
