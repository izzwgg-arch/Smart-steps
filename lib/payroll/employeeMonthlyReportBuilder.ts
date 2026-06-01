import { format } from 'date-fns'
import { prisma } from '@/lib/prisma'

export type PunchStatus = 'complete' | 'partial' | 'missing'

export interface EmployeeMonthlyTimeEntry {
  date: string
  inTime: string | null
  outTime: string | null
  inTimeDisplay: string
  outTimeDisplay: string
  hours: number
  sourceImport: string | null
  punchStatus: PunchStatus
}

export interface EmployeeMonthlyReportPayload {
  employee: {
    id: string
    fullName: string
    email?: string | null
    phone?: string | null
    defaultHourlyRate: number
  }
  period: {
    year: number
    month: number
    monthName: string
  }
  summary: {
    totalHours: number
    hourlyRate: number
    grossPay: number
    totalPaid: number
    amountOwed: number
  }
  timeEntries: EmployeeMonthlyTimeEntry[]
  payments: Array<{
    date: string
    amount: number
    method: string
    reference?: string | null
  }>
  validation: {
    warnings: string[]
  }
}

const MISSING_PUNCH_LABEL = 'Missing punch data'
const HOURS_TOLERANCE = 0.05

export function parseMonthParam(monthParam: string): { year: number; month: number } {
  const [yearStr, monthStr] = monthParam.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  if (!year || !month || month < 1 || month > 12) {
    throw new Error('Invalid month format. Use YYYY-MM')
  }
  return { year, month }
}

export function getCalendarMonthRange(year: number, month: number): { periodStart: Date; periodEnd: Date } {
  return {
    periodStart: new Date(year, month - 1, 1),
    periodEnd: new Date(year, month, 0, 23, 59, 59, 999),
  }
}

export function formatPunchTime(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return format(date, 'h:mm a')
}

export function getImportRowHours(row: {
  hoursWorked?: unknown
  minutesWorked?: number | null
  inTime?: Date | string | null
  outTime?: Date | string | null
}): number {
  if (row.hoursWorked != null && row.hoursWorked !== '') {
    const hours = parseFloat(String(row.hoursWorked))
    if (!Number.isNaN(hours) && hours > 0) return hours
  }
  if (row.minutesWorked != null && row.minutesWorked > 0) {
    return row.minutesWorked / 60
  }
  if (row.inTime && row.outTime) {
    const inTime = new Date(row.inTime)
    const outTime = new Date(row.outTime)
    if (outTime < inTime) {
      outTime.setDate(outTime.getDate() + 1)
    }
    return (outTime.getTime() - inTime.getTime()) / (1000 * 60 * 60)
  }
  return 0
}

export function buildTimeEntryFromImportRow(row: {
  workDate: Date | string
  inTime?: Date | string | null
  outTime?: Date | string | null
  hoursWorked?: unknown
  minutesWorked?: number | null
  import?: { originalFileName?: string | null } | null
}): EmployeeMonthlyTimeEntry {
  const hours = getImportRowHours(row)
  const inTimeIso = row.inTime ? new Date(row.inTime).toISOString() : null
  const outTimeIso = row.outTime ? new Date(row.outTime).toISOString() : null
  const inTimeFormatted = formatPunchTime(row.inTime)
  const outTimeFormatted = formatPunchTime(row.outTime)

  let punchStatus: PunchStatus = 'complete'
  if (!inTimeIso && !outTimeIso && hours > 0) {
    punchStatus = 'missing'
  } else if (!inTimeIso || !outTimeIso) {
    punchStatus = 'partial'
  }

  const inTimeDisplay =
    inTimeFormatted ?? (hours > 0 && !inTimeIso ? MISSING_PUNCH_LABEL : '-')
  const outTimeDisplay =
    outTimeFormatted ?? (hours > 0 && !outTimeIso ? MISSING_PUNCH_LABEL : '-')

  return {
    date: new Date(row.workDate).toISOString(),
    inTime: inTimeIso,
    outTime: outTimeIso,
    inTimeDisplay,
    outTimeDisplay,
    hours,
    sourceImport: row.import?.originalFileName ?? null,
    punchStatus,
  }
}

/** Calendar month key for matching payroll run periodStart to a report month. */
export function calendarMonthKey(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

/**
 * Pick run lines for an employee monthly report.
 * - Only runs whose periodStart falls in the requested calendar month (avoids prior-month pay periods that end on the 1st).
 * - When duplicate runs share the same period window, keep the newest by createdAt.
 */
export function selectRunLinesForCalendarMonth<
  T extends {
    run: { periodStart: Date; periodEnd: Date; createdAt: Date }
  },
>(runLines: T[], year: number, month: number): T[] {
  const targetKey = year * 12 + (month - 1)
  const startingInMonth = runLines.filter(
    (line) => calendarMonthKey(line.run.periodStart) === targetKey
  )

  const byPeriod = new Map<string, T>()
  for (const line of startingInMonth) {
    const key = `${line.run.periodStart.toISOString()}|${line.run.periodEnd.toISOString()}`
    const existing = byPeriod.get(key)
    if (!existing || line.run.createdAt > existing.run.createdAt) {
      byPeriod.set(key, line)
    }
  }

  return [...byPeriod.values()]
}

export function buildSummaryFromRunLines(
  runLines: Array<{
    totalHours: unknown
    hourlyRateUsed: unknown
    grossPay: unknown
    amountPaid: unknown
    payments?: Array<{ amount: unknown }>
  }>,
  defaultHourlyRate: number
): EmployeeMonthlyReportPayload['summary'] {
  const totalHours = runLines.reduce((sum, line) => sum + parseFloat(String(line.totalHours)), 0)
  const grossPay = runLines.reduce((sum, line) => sum + parseFloat(String(line.grossPay)), 0)
  const totalPaidFromLines = runLines.reduce(
    (sum, line) => sum + parseFloat(String(line.amountPaid)),
    0
  )
  const totalPaidFromPayments = runLines.reduce(
    (sum, line) =>
      sum +
      (line.payments ?? []).reduce(
        (paymentSum, payment) => paymentSum + parseFloat(String(payment.amount)),
        0
      ),
    0
  )
  const totalPaid = totalPaidFromPayments > 0 ? totalPaidFromPayments : totalPaidFromLines
  const amountOwed = grossPay - totalPaid

  const hourlyRate =
    totalHours > 0
      ? runLines.reduce(
          (sum, line) =>
            sum + parseFloat(String(line.hourlyRateUsed)) * parseFloat(String(line.totalHours)),
          0
        ) / totalHours
      : defaultHourlyRate

  return {
    totalHours,
    hourlyRate,
    grossPay,
    totalPaid,
    amountOwed,
  }
}

export function validateEmployeeMonthlyReport(payload: {
  summary: EmployeeMonthlyReportPayload['summary']
  timeEntries: EmployeeMonthlyTimeEntry[]
}): string[] {
  const warnings: string[] = []
  const detailHours = payload.timeEntries.reduce((sum, entry) => sum + entry.hours, 0)

  if (payload.summary.totalHours > 0 && payload.timeEntries.length === 0) {
    warnings.push(
      `[EMPLOYEE MONTHLY REPORT] Non-zero summary totals (${payload.summary.totalHours.toFixed(2)} hours) but no detail time entries were found for this period.`
    )
  }

  if (
    payload.summary.totalHours > 0 &&
    payload.timeEntries.length > 0 &&
    Math.abs(detailHours - payload.summary.totalHours) > HOURS_TOLERANCE
  ) {
    warnings.push(
      `[EMPLOYEE MONTHLY REPORT] Detail hours (${detailHours.toFixed(2)}) do not match summary total hours (${payload.summary.totalHours.toFixed(2)}).`
    )
  }

  const missingPunchCount = payload.timeEntries.filter((entry) => entry.punchStatus !== 'complete').length
  if (missingPunchCount > 0) {
    warnings.push(
      `[EMPLOYEE MONTHLY REPORT] ${missingPunchCount} detail row(s) are missing complete punch in/out data.`
    )
  }

  return warnings
}

export async function fetchImportRowsForEmployeePeriod(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<
  Array<{
    workDate: Date
    inTime: Date | null
    outTime: Date | null
    hoursWorked: unknown
    minutesWorked: number | null
    import: { originalFileName: string | null }
  }>
> {
  const rows = await prisma.payrollImportRow.findMany({
    where: {
      linkedEmployeeId: employeeId,
      workDate: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    orderBy: [{ workDate: 'asc' }, { inTime: 'asc' }],
  })

  if (rows.length === 0) {
    return []
  }

  const importIds = [...new Set(rows.map((row) => row.importId))]
  const imports = await prisma.payrollImport.findMany({
    where: { id: { in: importIds } },
    select: { id: true, originalFileName: true },
  })
  const importById = new Map(imports.map((entry) => [entry.id, entry]))

  const orphanedCount = rows.filter((row) => !importById.has(row.importId)).length
  if (orphanedCount > 0) {
    console.warn(
      `[EMPLOYEE MONTHLY REPORT] Skipped ${orphanedCount} orphaned PayrollImportRow record(s) for employeeId=${employeeId}`
    )
  }

  return rows
    .filter((row) => importById.has(row.importId))
    .map((row) => ({
      workDate: row.workDate,
      inTime: row.inTime,
      outTime: row.outTime,
      hoursWorked: row.hoursWorked,
      minutesWorked: row.minutesWorked,
      import: {
        originalFileName: importById.get(row.importId)?.originalFileName ?? null,
      },
    }))
}

export async function buildEmployeeMonthlyReport(
  employeeId: string,
  monthParam: string
): Promise<EmployeeMonthlyReportPayload> {
  const { year, month } = parseMonthParam(monthParam)
  const { periodStart, periodEnd } = getCalendarMonthRange(year, month)

  const employee = await prisma.payrollEmployee.findUnique({
    where: { id: employeeId },
  })

  if (!employee) {
    throw new Error('Employee not found')
  }

  const overlappingRunLines = await prisma.payrollRunLine.findMany({
    where: {
      employeeId,
      run: {
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
      },
    },
    include: {
      run: true,
      payments: {
        orderBy: { paidAt: 'asc' },
      },
    },
    orderBy: { run: { periodStart: 'asc' } },
  })

  const runLines = selectRunLinesForCalendarMonth(overlappingRunLines, year, month)

  if (overlappingRunLines.length > runLines.length) {
    console.warn('[EMPLOYEE MONTHLY REPORT] Filtered duplicate/overlapping payroll runs for summary:', {
      employeeId,
      month: monthParam,
      overlappingCount: overlappingRunLines.length,
      selectedCount: runLines.length,
    })
  }

  const importRows = await fetchImportRowsForEmployeePeriod(employeeId, periodStart, periodEnd)

  const defaultHourlyRate = parseFloat(employee.defaultHourlyRate.toString())
  const summary = buildSummaryFromRunLines(runLines, defaultHourlyRate)

  const timeEntries = importRows.map((row) => buildTimeEntryFromImportRow(row))

  const payments = runLines
    .flatMap((line) =>
      (line.payments ?? []).map((payment) => ({
        date: payment.paidAt.toISOString(),
        amount: parseFloat(payment.amount.toString()),
        method: payment.method,
        reference: payment.reference,
      }))
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const validation = {
    warnings: validateEmployeeMonthlyReport({ summary, timeEntries }),
  }

  if (validation.warnings.length > 0) {
    console.warn('[EMPLOYEE MONTHLY REPORT] Validation warnings:', {
      employeeId,
      month: monthParam,
      warnings: validation.warnings,
    })
  }

  return {
    employee: {
      id: employee.id,
      fullName: employee.fullName,
      email: employee.email,
      phone: employee.phone,
      defaultHourlyRate,
    },
    period: {
      year,
      month,
      monthName: format(periodStart, 'MMMM'),
    },
    summary,
    timeEntries,
    payments,
    validation,
  }
}
