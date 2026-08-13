# Scheduling Change Template

Use for appointments, calendar, recurrence, completion, reminders, appointment invoices.

1. Read `CURSOR_START_HERE.md`, `SCHEDULING.md`, `DATA_MODEL.md`, `BILLING_PAYMENTS.md` if completion/invoices are involved.
2. Identify:
   - UI page/component
   - `appointment.routes.js`
   - `appointmentService.js`
   - Appointment model fields
3. Check effects on reminders, reports, invoices, and dashboard stats.
4. For recurrence, verify single appointment vs series behavior.
5. Run focused checks.
6. Update `SCHEDULING.md`.

Risk default: high.
