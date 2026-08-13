# Cursor Start Here

Purpose: reduce AI wandering, token use, and production risk for the A Plus Center / SmartSteps ABA repo.

## First 2 Minutes
- Identify which app is involved:
  - Root Next.js app: `app/`, `components/`, root `prisma/schema.prisma`.
  - A Plus scheduling app: `aplus-center-scheduling/server` and `aplus-center-scheduling/client`.
  - SmartSteps ABA tracker: `aplus-center-scheduling/smart-steps`.
  - Mobile/backup: `smart-steps-android`, `smart-steps-android-backup`.
- Determine task type: bug, feature, UI-only, API change, database change, deployment, permissions, scheduling, billing/payment, payroll/timesheet, client files.
- Determine risk level using `SAFE_CHANGE_ZONES.md`.
- Load only the relevant context docs. Do not scan the whole repo unless the task spans apps.
- List candidate files before editing.
- Root cause before coding. For bugs, find the exact page, route, service, model, and data path.

## Required Guardrails
- Do not change runtime behavior for documentation-only tasks.
- Do not change database schema or run migrations unless explicitly requested and reviewed.
- Do not change auth, permissions, tenant/data visibility, deployment, nginx, PM2, payment webhooks, payroll calculations, QuickBooks sync, billing, scheduling, or client files without treating the task as high/extreme risk.
- Preserve production behavior. Prefer small, reversible edits.
- Update affected AI docs after meaningful changes.

## Fast Routing
- Scheduling/calendar: read `SCHEDULING.md`, `SERVICES.md`, `API_ROUTES.md`, `DATA_MODEL.md`.
- Billing/payments/QuickBooks: read `BILLING_PAYMENTS.md`, `QUICKBOOKS.md`, `API_ROUTES.md`, `DATA_MODEL.md`.
- Client files: read `CLIENT_FILES.md`.
- Payroll/timesheets: read `PAYROLL_TIMESHEETS.md`.
- Permissions/auth: read `PERMISSIONS.md`, `RULES.md`.
- Deployment/debugging: read `DEPLOYMENT.md`, `DEBUGGING.md`.
- Token control: read `TOKEN_COST_HOTSPOTS.md` and `.cursorignore`.

## Unknown Policy
If repo evidence is unclear, write: `UNKNOWN — verify before changing.`
