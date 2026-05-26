import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseMonthParam,
  getCalendarMonthRange,
  getImportRowHours,
  buildTimeEntryFromImportRow,
  buildSummaryFromRunLines,
  validateEmployeeMonthlyReport,
} from '../employeeMonthlyReportBuilder'

test('parseMonthParam accepts YYYY-MM', () => {
  assert.deepEqual(parseMonthParam('2026-04'), { year: 2026, month: 4 })
})

test('parseMonthParam rejects invalid month', () => {
  assert.throws(() => parseMonthParam('2026-13'), /Invalid month format/)
})

test('getCalendarMonthRange covers full calendar month', () => {
  const { periodStart, periodEnd } = getCalendarMonthRange(2026, 4)
  assert.equal(periodStart.getFullYear(), 2026)
  assert.equal(periodStart.getMonth(), 3)
  assert.equal(periodStart.getDate(), 1)
  assert.equal(periodEnd.getFullYear(), 2026)
  assert.equal(periodEnd.getMonth(), 3)
  assert.equal(periodEnd.getDate(), 30)
})

test('getImportRowHours uses fingerprint punch pair', () => {
  const hours = getImportRowHours({
    inTime: new Date('2026-04-13T13:47:00'),
    outTime: new Date('2026-04-13T19:42:00'),
  })
  assert.equal(Number(hours.toFixed(2)), 5.92)
})

test('getImportRowHours uses manual hoursWorked when punches missing', () => {
  const hours = getImportRowHours({ hoursWorked: 4.5 })
  assert.equal(hours, 4.5)
})

test('buildTimeEntryFromImportRow formats fingerprint punches', () => {
  const entry = buildTimeEntryFromImportRow({
    workDate: new Date('2026-04-13T04:00:00Z'),
    inTime: new Date('2026-04-13T13:47:00'),
    outTime: new Date('2026-04-13T19:42:00'),
    hoursWorked: 5.92,
    import: { originalFileName: 'clock in april 2026_.xls' },
  })

  assert.equal(entry.punchStatus, 'complete')
  assert.equal(entry.inTimeDisplay, '1:47 PM')
  assert.equal(entry.outTimeDisplay, '7:42 PM')
  assert.equal(entry.sourceImport, 'clock in april 2026_.xls')
})

test('buildTimeEntryFromImportRow shows missing punch status for hours-only row', () => {
  const entry = buildTimeEntryFromImportRow({
    workDate: new Date('2026-04-13T04:00:00Z'),
    hoursWorked: 3,
    import: { originalFileName: 'manual-timesheet.xlsx' },
  })

  assert.equal(entry.punchStatus, 'missing')
  assert.equal(entry.inTimeDisplay, 'Missing punch data')
  assert.equal(entry.outTimeDisplay, 'Missing punch data')
})

test('buildSummaryFromRunLines matches April 2026 payroll totals', () => {
  const summary = buildSummaryFromRunLines(
    [
      {
        totalHours: 55.82,
        hourlyRateUsed: 25,
        grossPay: 1395.42,
        amountPaid: 0,
        payments: [],
      },
    ],
    25
  )

  assert.equal(Number(summary.totalHours.toFixed(2)), 55.82)
  assert.equal(Number(summary.grossPay.toFixed(2)), 1395.42)
  assert.equal(Number(summary.amountOwed.toFixed(2)), 1395.42)
  assert.equal(summary.hourlyRate, 25)
})

test('validateEmployeeMonthlyReport warns on non-zero totals with no detail rows', () => {
  const warnings = validateEmployeeMonthlyReport({
    summary: {
      totalHours: 55.82,
      hourlyRate: 25,
      grossPay: 1395.42,
      totalPaid: 0,
      amountOwed: 1395.42,
    },
    timeEntries: [],
  })

  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /no detail time entries/)
})

test('validateEmployeeMonthlyReport warns when detail hours do not match summary', () => {
  const warnings = validateEmployeeMonthlyReport({
    summary: {
      totalHours: 55.82,
      hourlyRate: 25,
      grossPay: 1395.42,
      totalPaid: 0,
      amountOwed: 1395.42,
    },
    timeEntries: [
      {
        date: '2026-04-13T04:00:00.000Z',
        inTime: null,
        outTime: null,
        inTimeDisplay: 'Missing punch data',
        outTimeDisplay: 'Missing punch data',
        hours: 10,
        sourceImport: null,
        punchStatus: 'missing',
      },
    ],
  })

  assert.ok(warnings.some((warning) => warning.includes('do not match summary total hours')))
})

test('validateEmployeeMonthlyReport accepts aligned summary and detail rows', () => {
  const warnings = validateEmployeeMonthlyReport({
    summary: {
      totalHours: 5.92,
      hourlyRate: 25,
      grossPay: 148,
      totalPaid: 0,
      amountOwed: 148,
    },
    timeEntries: [
      {
        date: '2026-04-13T04:00:00.000Z',
        inTime: '2026-04-13T13:47:00.000Z',
        outTime: '2026-04-13T19:42:00.000Z',
        inTimeDisplay: '1:47 PM',
        outTimeDisplay: '7:42 PM',
        hours: 5.92,
        sourceImport: 'clock in april 2026_.xls',
        punchStatus: 'complete',
      },
    ],
  })

  assert.equal(warnings.length, 0)
})

test('month boundary range handles previous month correctly', () => {
  const current = getCalendarMonthRange(2026, 4)
  const previous = getCalendarMonthRange(2026, 3)

  assert.equal(previous.periodEnd.getMonth(), 2)
  assert.equal(previous.periodEnd.getDate(), 31)
  assert.notEqual(current.periodStart.toISOString(), previous.periodStart.toISOString())
})
