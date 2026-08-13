# Scheduling

## Purpose

The A Plus scheduling app manages appointments, providers, services, reminders, reports, completion, and invoice creation.

## Important Files
- API: `aplus-center-scheduling/server/src/routes/appointment.routes.js`.
- Service logic: `aplus-center-scheduling/server/src/services/clinic/appointments/appointmentService.js`.
- UI: `aplus-center-scheduling/client/src/pages/aplus/AppointmentsPage.jsx`.
- Details/payment drawer: `aplus-center-scheduling/client/src/pages/aplus/AppointmentDetailsDrawer.jsx`.
- Dashboard: `server/src/routes/dashboard.routes.js`.
- Prisma model: `Appointment` in `server/prisma/schema.prisma`.

## Lifecycle

Observed statuses include:
- `SCHEDULED`, `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `RESCHEDULED`, `NO_SHOW`, `PAID`, `RUNNING_LATE`, `CUSTOM`.

Observed endpoints:
- Create/list/update/delete appointments.
- Cancel.
- Reschedule.
- Complete.
- Create invoice.
- Preview pricing.
- Sync billing amount.

## Completion Behavior

`POST /api/appointments/:id/complete`:
- Cancels queued reminder jobs.
- Marks appointment `COMPLETED`.
- Creates an invoice if missing via invoice-from-appointment logic.
- Writes audit log.

Reports route can also create invoice after report upload. Exact intended workflow order is `UNKNOWN — verify before changing`.

## Invoice After Completion

Appointment details UI supports:
- Complete appointment.
- Create invoice before collecting payment.
- Edit invoice lines/hours/services before payment.
- Pay by card.
- Record cash/check/manual payment.

Invoice edits tied to appointments may use first invoice line quantity as hours and update appointment duration.

## Recurring Appointments

Evidence:
- `RecurrenceType`: `NONE`, `WEEKLY`, `MONTHLY`.
- Creation materializes multiple appointment rows with `recurrenceGroupId`.
- Conflicts may cause occurrences to be skipped.
- Update service updates one appointment by ID; series-wide update was not confirmed.

## Edge Cases
- Provider conflict overlaps.
- Silent recurrence skips.
- Date/time and timezone.
- Completion vs report upload invoice duplication.
- Appointment duration vs invoice line hours.
- Reminder cancellation on completion.

## Risk
High. Changes can affect calendar, reminders, billing, invoice status, and client records.
