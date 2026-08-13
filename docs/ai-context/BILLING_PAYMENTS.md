# Billing, Invoices, and Payments

## Purpose

The A Plus scheduling app creates invoices, manages line items, tracks balances/statuses, collects payments, sends receipts, generates hosted payment links, and syncs invoices/payments to QuickBooks.

## Important Files
- Routes: `server/src/routes/invoice.routes.js`, `server/src/routes/payment.routes.js`.
- Invoice services: `server/src/services/invoices/invoiceDomainService.js`, `invoiceActivityService.js`, `invoiceHtmlService.js`.
- Balance service: `server/src/services/payments/paymentService.js`.
- Payment processor services: `server/src/services/payments/*`.
- Payment Hub integration: `server/src/services/integrations/payment-hub/paymentHubService.js`.
- Sola integration/provider: `server/src/services/payments/provider/solaPaymentsProviderService.js`.
- UI: `client/src/pages/aplus/InvoicesPage.jsx`, `client/src/pages/aplus/PaymentsPage.jsx`, `client/src/components/payments/SolaPaymentModal.jsx`, `client/src/pages/aplus/AppointmentDetailsDrawer.jsx`.

## Invoice Generation
- Manual invoice creation: `POST /api/invoices`.
- Appointment completion invoice: `POST /api/appointments/:id/complete` creates invoice if missing.
- Appointment detail can create invoice before payment.
- Invoice duplication exists.
- Delete is blocked if payments exist; void instead.

## Invoice Editing
- `PUT /api/invoices/:id` updates dates, notes, status, tax, discount, and line items.
- If `lineItems` is present, server deletes existing line items and recreates them.
- Totals recalculate from line item amounts.
- Balance is recalculated after payments are considered.
- For appointment invoices, first line quantity can update appointment duration.
- QuickBooks sync is queued after invoice update.

## Payment Status
- Payment statuses come from `PaymentStatus` enum.
- Invoice balance recalculation sums payments with statuses `AUTHORIZED`, `SUCCEEDED`, `PARTIALLY_REFUNDED`, `REFUNDED`, minus refunded amount.
- Invoice status becomes `PAID`, `PARTIAL`, or `OPEN` based on balance/paid amount unless other lifecycle rules intervene.

## Payment Methods
- Manual payment methods in UI: Cash, Check, External Card, ACH, Other.
- Manual payment endpoint: `POST /api/invoices/:id/pay`.
- Manual payment method edit endpoint exists: `PATCH /api/invoices/:id/payments/:paymentId`.
- Card/provider payments should keep processor method and are not edited through manual method endpoint.

## Payment Providers
- Payment Hub hosted checkout / browser post.
- Sola Payments card flows.
- Webhooks under `payment.routes.js` are public before auth middleware.

## Do-Not-Break Rules
- Do not move public webhook/browser-post routes behind `requireAuth`.
- Do not remove payment idempotency.
- Do not alter `externalPaymentId` uniqueness.
- Do not skip `recalculateInvoiceBalance` after payment/invoice changes.
- Do not change invoice delete/void rules without review.
- Do not change receipt sending side effects without review.
- Do not change payment provider payload parsing without production payload evidence.
