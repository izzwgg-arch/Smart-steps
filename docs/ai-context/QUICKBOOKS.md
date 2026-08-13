# QuickBooks

## Purpose

QuickBooks integration syncs customers, invoices, and payments from A Plus scheduling to QuickBooks Online.

## Important Files
- Routes: `aplus-center-scheduling/server/src/routes/integration.routes.js`, `server/src/routes/invoice.routes.js`.
- Service: `server/src/services/integrations/quickbooks/quickbooksService.js`.
- API client/logging: `server/src/services/integrations/quickbooks/quickbooksApiClient.js`.
- Auth: `server/src/services/integrations/quickbooks/quickbooksAuth.js`.
- Audit: `server/src/services/integrations/quickbooks/quickbooksAuditService.js`.
- Models: `IntegrationAccount`, `IntegrationSyncLog`, `QuickBooksApiCallLog`, invoice QB fields, client `quickbooksCustomerId`.

## Sync Flow
- OAuth callback stores encrypted QuickBooks tokens in `IntegrationAccount`.
- Customer sync uses `Client.quickbooksCustomerId` or creates/queries QuickBooks Customer.
- Invoice sync:
  - Finds invoice with client and line items.
  - Ensures QB customer.
  - If `quickbooksInvoiceId` exists, reads QB invoice and posts an update with `SyncToken`.
  - Otherwise creates a new QB invoice.
  - Updates `quickbooksInvoiceId`, `qbSyncStatus`, `qbSyncError`.
- Payment sync:
  - Ensures invoice is synced first.
  - Creates QB Payment linked to invoice.
  - Stores `qbPaymentId` on invoice.
  - Uses `IntegrationSyncLog` SUCCESS rows for dedupe.
- Manual payment update:
  - Can update method/date for manual payment rows and attempts QB payment update.

## Known Payload Details
- Invoice line payload uses `SalesItemLineDetail`.
- Quantity comes from invoice line item quantity.
- Unit price comes from invoice line item unit price.
- ItemRef is hardcoded as `{ value: "1", name: "Services" }`.

## Failure Modes
- QuickBooks disconnected: invoice marked not synced or returns local invoice.
- Expired/invalid tokens.
- Rate limits/safe mode from `quickbooksApiClient.js`.
- Missing QBO item/customer/invoice IDs.
- Payment already considered synced because `IntegrationSyncLog` has successful payment sync.
- Payment update support depends on QuickBooks API client feature allowance; confirm before changing.

## Do-Not-Break Rules
- Do not change OAuth redirect paths without matching Intuit app config.
- Do not hard-code secrets.
- Do not change ItemRef unless the target QuickBooks company has matching item setup.
- Do not delete sync logs casually.
- Do not bypass rate limits/dedupe.
- Do not alter invoice/payment sync side effects without testing both create and update.
