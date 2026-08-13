# Billing / Payment Change Template

Use for invoices, line items, balance, payment collection, receipts, webhooks, payment providers.

1. Read `CURSOR_START_HERE.md`, `BILLING_PAYMENTS.md`, `QUICKBOOKS.md`, `DATA_MODEL.md`.
2. Identify invoice/payment lifecycle side effects.
3. For invoice edits, verify balance recalculation and QuickBooks sync.
4. For payment edits, verify webhook/idempotency and receipt behavior.
5. Never move public payment routes behind auth unless explicitly required and provider-compatible.
6. Run client build and server syntax checks.
7. Update billing/QuickBooks docs.

Risk default: high; payment webhooks/provider auth are extreme.
