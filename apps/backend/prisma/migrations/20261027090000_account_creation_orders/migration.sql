-- Paid account creation orders (Driver / Owner)
CREATE TYPE "AccountCreationStatus" AS ENUM ('PENDING_VERIFICATION', 'AWAITING_PAYMENT', 'COMPLETED', 'EXPIRED');

CREATE TABLE "account_creation_orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "status" "AccountCreationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "codeHash" TEXT,
    "codeExpiresAt" TIMESTAMP(3),
    "codeUsedAt" TIMESTAMP(3),
    "paymentId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_creation_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_creation_orders_paymentId_key" ON "account_creation_orders"("paymentId");
CREATE INDEX "account_creation_orders_userId_kind_idx" ON "account_creation_orders"("userId", "kind");
CREATE INDEX "account_creation_orders_status_idx" ON "account_creation_orders"("status");

ALTER TABLE "account_creation_orders" ADD CONSTRAINT "account_creation_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
