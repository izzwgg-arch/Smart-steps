# Services and Modules

## A Plus Scheduling: App Shell
- Purpose: clinic admin UI, scheduling, billing, files, integrations.
- Important files: `aplus-center-scheduling/client/src/App.jsx`, `client/src/components/layout`, `server/src/app.js`.
- Risk: medium overall; high when touching mounted routes, auth middleware, or static production serving.
- Dependencies: Express route mounts, React Router, JWT auth.
- Failure modes: wrong route mounted/unmounted; SPA fallback broken; public webhook accidentally protected.

## Auth / Users
- Purpose: login, invitations, password reset, user management.
- Important files: `server/src/routes/auth.routes.js`, `server/src/routes/user.routes.js`, `server/src/middleware/auth.js`, `server/src/utils/jwt.js`, `client/src/context/AuthContext.jsx`.
- Risk: extreme.
- Dependencies: `JWT_SECRET`, bcrypt, localStorage token in client.
- Failure modes: invalid tokens, role mismatch, UI exposing pages that API denies, accidental broadening/narrowing of admin-only endpoints.

## Scheduling / Appointments
- Purpose: create, update, cancel, reschedule, complete appointments; pricing snapshots; recurrence.
- Important files: `server/src/routes/appointment.routes.js`, `server/src/services/clinic/appointments/appointmentService.js`, `client/src/pages/aplus/AppointmentsPage.jsx`, `client/src/pages/aplus/AppointmentDetailsDrawer.jsx`.
- Risk: high.
- Dependencies: Client, Provider, Service, ReminderJob, Invoice.
- Failure modes: provider conflicts, silent skipped recurrence occurrences, invoice generation after completion, duration/pricing mismatches.

## Billing / Invoices
- Purpose: invoice CRUD, line items, invoice emails, HTML view, duplicate/void/delete, QB sync.
- Important files: `server/src/routes/invoice.routes.js`, `server/src/services/invoices/*`, `client/src/pages/aplus/InvoicesPage.jsx`.
- Risk: high.
- Dependencies: Payment, QuickBooks, Payment Hub, mailer, appointment completion.
- Failure modes: wrong balance after edits, paid/partial status wrong, QB sync failures, deleting paid invoices.

## Payments
- Purpose: manual payment, card charge, hosted checkout/browser post, receipts, refunds.
- Important files: `server/src/routes/payment.routes.js`, `server/src/services/payments/*`, `client/src/components/payments/SolaPaymentModal.jsx`, `client/src/pages/aplus/PaymentsPage.jsx`.
- Risk: extreme for webhooks/provider flows.
- Dependencies: Payment Hub, Sola Payments, invoice balance recalculation, receipt email.
- Failure modes: duplicate webhook processing, external payment ID collision, public webhook auth broken, double receipts, wrong payment method in QB.

## QuickBooks
- Purpose: OAuth connect, customer/invoice/payment sync, audit/call logs.
- Important files: `server/src/routes/integration.routes.js`, `server/src/services/integrations/quickbooks/*`.
- Risk: high/extreme.
- Dependencies: IntegrationAccount encrypted tokens, QuickBooks API, QB rate limiter, invoice/payment models.
- Failure modes: expired tokens, missing item refs, rate limit/safe mode, duplicate payment sync dedupe, failed sparse updates.

## Client Files
- Purpose: folder tree, uploads, downloads, rename/move/delete, default document roots.
- Important files: `server/src/routes/clientFiles.routes.js`, `server/src/services/documentRootsService.js`, `client/src/pages/aplus/ClientFilesTab.jsx`.
- Risk: high.
- Dependencies: filesystem under `UPLOAD_DIR`, `ClientFile`, `ClientDocumentRoot`, auth.
- Failure modes: wrong client folder, broken file path, large uploads, soft-delete cascade mistakes, data leak.

## Reminders / Messaging
- Purpose: reminder templates, jobs, scheduler, provider integrations.
- Important files: `server/src/routes/reminder.routes.js`, `server/src/services/reminderService.js`, `server/src/jobs/scheduler.js`, VoIP.ms services.
- Risk: medium/high.
- Dependencies: Appointment, ReminderJob, VoIP.ms, email/SMS settings.
- Failure modes: duplicate reminders, wrong timezone, webhook auth issue.

## SmartSteps ABA
- Purpose: ABA clients, goals/targets, sessions, data capture, assessments, reports.
- Important files: `smart-steps/src/app`, `smart-steps/src/store/abaStore.ts`, `smart-steps/prisma/schema.prisma`.
- Risk: high for data linkage and auth; medium for UI-only.
- Dependencies: NextAuth, Prisma, Zustand/offline store, React Query, scheduling database bridge.
- Failure modes: local/server ID mismatch, trial data not linked to target/session/client, broad API reads, demo auth path.

## Payroll / Timesheets
- Purpose: UNKNOWN in A Plus scheduling app; root app package says timesheet platform.
- Important files: `UNKNOWN — verify before changing.`
- Risk: high/extreme if found.
- Failure modes: date pairing/off-by-one, batch calculation, PDF/export inaccuracies.
