# Payroll and Timesheets

## Employee Monthly Report (Root Next.js App)

### Data flow
1. Fingerprint/manual imports are saved to `PayrollImportRow` (`inTime`, `outTime`, `hoursWorked`, `minutesWorked`, `workDate`, `linkedEmployeeId`).
2. Payroll runs aggregate import rows into `PayrollRunLine` totals (`totalHours`, `grossPay`, `amountPaid`, `amountOwed`).
3. Shared builder: `lib/payroll/employeeMonthlyReportBuilder.ts`
   - Summary totals come from overlapping `PayrollRunLine` records for the selected calendar month.
   - Detail rows come from `PayrollImportRow` records for the same employee/month (never from run-line aggregates).
4. Browser preview and PDF export both consume the same payload from `buildEmployeeMonthlyReport()`.

### Routes
| Route | Purpose |
|-------|---------|
| `GET /api/payroll/reports/employee/[employeeId]?month=YYYY-MM` | JSON payload for browser preview |
| `GET /api/payroll/reports/employee/[employeeId]/pdf?month=YYYY-MM` | PDF export (same builder) |
| `GET /api/payroll/employee-reports/[employeeId]?month=&year=` | Legacy PDF endpoint (same builder) |

UI page: `app/payroll/reports/employee/[employeeId]/page.tsx`
Component: `components/payroll/EmployeeMonthlyReport.tsx`

### Payload contract
`EmployeeMonthlyReportPayload` includes:
- `employee`, `period`
- `summary`: `totalHours`, `hourlyRate`, `grossPay`, `totalPaid`, `amountOwed`
- `timeEntries[]`: `date`, `inTime`, `outTime`, display strings, `hours`, `sourceImport`, `punchStatus`
- `payments[]`
- `validation.warnings[]`

### Detail row rules
- One detail row per `PayrollImportRow` in the selected calendar month.
- Do **not** synthesize a single aggregate row from `PayrollRunLine.periodStart` + `totalHours`.
- Punch mapping uses DB fields `inTime` / `outTime` populated by import save logic (`app/api/payroll/import/save/route.ts`).
- If a row has hours but missing punches, display `Missing punch data` (not silent `-`).
- Orphan import rows (`importId` without parent `PayrollImport`) are excluded via `import: {}` existence filter.

### Validation behavior
Warnings are logged and returned in payload when:
- Summary totals are non-zero but no detail rows exist.
- Detail hours total differs from summary total hours (tolerance 0.05h).
- One or more detail rows have incomplete punch data.

Run tests: `npm run test:payroll-report`

## Scheduling App Status

In `aplus-center-scheduling`, static search found no implementation for payroll/timesheet/fingerprint features.

## Risk Areas
- Fingerprint scanner import and in/out pairing
- Overnight shifts and timezone/date boundaries
- Payroll batch save and run aggregation
- PDF/export formatting
- Employee/provider mapping

## Do-Not-Break Rules
- Do not alter payroll calculations without tests or explicit examples.
- Do not change date parsing without fixture data.
- Do not run migrations casually.
- Do not deploy payroll changes without production verification plan.
