-- Chat usernames + direct (non-Explore) chat threads + contract cards in chat.
-- A direct Work & Pay contract is built on a private vehicle (no licence or
-- photo upload), then shared to one driver found by their chat username.

ALTER TABLE "users" ADD COLUMN "chatUsername" TEXT;
CREATE UNIQUE INDEX "users_chatUsername_key" ON "users"("chatUsername");

-- Direct threads are not born from an Explore interest, so vehicle/interest
-- become optional and a thread may be tied to one shared contract.
ALTER TABLE "chat_threads" ALTER COLUMN "vehicleId" DROP NOT NULL;
ALTER TABLE "chat_threads" ALTER COLUMN "interestId" DROP NOT NULL;
ALTER TABLE "chat_threads" ADD COLUMN "contractId" TEXT;
CREATE INDEX "chat_threads_contractId_idx" ON "chat_threads"("contractId");

-- Contract cards sent in chat carry the contract they point at.
ALTER TABLE "chat_messages" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'TEXT';
ALTER TABLE "chat_messages" ADD COLUMN "contractId" TEXT;
