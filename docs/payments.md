# GH Motive — Payments Architecture

## Overview

Payments in GH Motive are high-risk. Every payment operation must be:
- **Idempotent** — duplicate requests do not create duplicate transactions
- **Auditable** — every movement has a complete record
- **Verified** — backend determines success, never the frontend
- **Reconcilable** — GH Motive ledger can be compared to provider

## Payment Flow

```
Driver
   ↓ initiates payment
GH Motive Backend
   ↓ creates Payment record (INITIATED)
   ↓ generates idempotency key
MTN MoMo / Provider
   ↓ processes payment
Provider Webhook → GH Motive Backend
   ↓ verifies webhook authenticity
   ↓ updates Payment record (SUCCESSFUL/FAILED)
   ↓ creates Transaction in Ledger
   ↓ updates PaymentSchedule
   ↓ triggers Settlement
   ↓ sends Notification
Owner/Company receives settlement
```

## Idempotency

Every payment request generates a unique `idempotencyKey` stored in the `payments` table.

If the same key arrives again (duplicate webhook, user retry), the existing payment record is returned without creating a new transaction.

## Payment States

```
INITIATED → PENDING → PROCESSING → SUCCESSFUL → SETTLED
                     ↓            ↓
                   FAILED      REVERSED
                                ↓
                             REFUNDED
```

## Financial Ledger

The `transactions` table is the source of financial truth.

Never use:
```
user.balance += amount
```

Every financial operation creates a Transaction record with:
- Amount + direction (DEBIT/CREDIT)
- Type (PAYMENT_IN, PAYMENT_OUT, FEE, REFUND, etc.)
- Status
- Reference to Payment
- Reference to Contract
- Settlement status

## MTN MoMo Integration

GH Motive uses the MTN MoMo API through an abstraction layer.

```
PaymentProvider (interface)
    ↓
MTNMoMoProvider (adapter)
```

All MTN-specific code lives in:
```
apps/backend/src/integrations/payments/mtn/
```

Never call MTN APIs directly from business modules.

## Development (Mock Provider)

In development, use `MockPaymentProvider`. 

The mock provider is **impossible to enable in production** — it is guarded by:
```
NODE_ENV !== 'production' && PAYMENT_MOCK_MODE === 'true'
```

## Webhook Security

All incoming webhooks must be verified for authenticity before processing.
MTN MoMo webhooks must be validated using the provider's signature/secret mechanism.

Duplicate webhook IDs must be detected and ignored (idempotency).

## Reconciliation

A background job (BullMQ) runs periodically to compare:
- GH Motive ledger entries
- MTN MoMo transaction history

Discrepancies are logged and flagged for manual review.
