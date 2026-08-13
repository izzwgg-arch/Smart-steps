# Safe Change Zones

## Low Risk
- Copy text.
- Documentation.
- Styling that does not change data flow.
- Simple UI layout adjustments.
- Adding AI context docs.
- `.cursorignore` additions for generated artifacts only.

## Medium Risk
- Normal form validation.
- Non-critical CRUD.
- Reports and dashboards that read existing data.
- UI-only filters/sorting when data scope is unchanged.

## High Risk
- Permissions.
- Cross-client or tenant isolation.
- Scheduling and appointment lifecycle.
- Recurring appointments.
- Invoices and billing.
- Payments.
- Client files and uploads.
- QuickBooks sync.
- Reminder sending.
- SmartSteps goal/session/trial data linkage.

## Extreme Risk
- Auth/session implementation.
- Database migrations and schema changes.
- Production deployment.
- Payment webhooks.
- Payroll calculations.
- Cross-tenant/cross-client data access.
- Server/nginx/PM2 changes.
- Payment provider credentials/tokens.
- QuickBooks OAuth token handling.

## Rule
If a task starts low risk but touches a high/extreme file, reclassify before editing.
