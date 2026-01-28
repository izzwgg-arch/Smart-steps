import { Decimal } from '@prisma/client/runtime/library'

/**
 * Billing utility functions for invoice calculations
 * Ensures consistent unit conversion and calculation logic across all invoice generation
 */

/**
 * Convert minutes to billable units
 * Formula: Units = Hours × 4 (based on 15-minute unit standard)
 * 1 hour = 60 minutes = 4 units
 * 
 * @param minutes - Total service minutes
 * @param unitMinutes - Minutes per unit (default: 15, used for validation only)
 * @returns Number of billable units (calculated as Hours × 4)
 * 
 * Examples:
 * - 90 minutes = 1.5 hours × 4 = 6 units
 * - 60 minutes = 1 hour × 4 = 4 units
 * - 30 minutes = 0.5 hours × 4 = 2 units
 * - 15 minutes = 0.25 hours × 4 = 1 unit
 */
export function minutesToUnits(minutes: number, unitMinutes: number = 15): number {
  if (minutes <= 0) return 0
  if (unitMinutes <= 0) throw new Error('unitMinutes must be greater than 0')
  // Formula: Units = (Minutes / 60) × 4 = Hours × 4
  const hours = minutes / 60
  const units = hours * 4
  // Round to 2 decimal places for precision, then round up to nearest whole unit
  return Math.ceil(Math.round(units * 100) / 100)
}

/**
 * Calculate invoice totals from timesheet entries
 * 
 * @param timesheetEntries - Array of timesheet entries with minutes
 * @param ratePerUnit - Rate per unit from Insurance
 * @param unitMinutes - Minutes per unit (default: 15)
 * @returns Object with totalMinutes, unitsBilled, and amount
 */
export function calculateInvoiceTotals(
  timesheetEntries: Array<{ minutes: number }>,
  ratePerUnit: Decimal | number,
  unitMinutes: number = 15
): {
  totalMinutes: number
  unitsBilled: number
  amount: Decimal
} {
  // Sum all minutes
  const totalMinutes = timesheetEntries.reduce((sum, entry) => sum + (entry.minutes || 0), 0)
  
  // Convert to units (round UP)
  const unitsBilled = minutesToUnits(totalMinutes, unitMinutes)
  
  // Calculate amount
  const rate = ratePerUnit instanceof Decimal ? ratePerUnit : new Decimal(ratePerUnit)
  const amount = new Decimal(unitsBilled).times(rate)
  
  return {
    totalMinutes,
    unitsBilled,
    amount,
  }
}

/**
 * Calculate invoice totals per entry (for line items)
 * 
 * @param entryMinutes - Minutes for a single entry
 * @param ratePerUnit - Rate per unit from Insurance
 * @param unitMinutes - Minutes per unit (default: 15)
 * @returns Object with unitsBilled and amount for this entry
 */
export function calculateEntryTotals(
  entryMinutes: number,
  ratePerUnit: Decimal | number,
  unitMinutes: number = 15
): {
  unitsBilled: number
  amount: Decimal
} {
  const unitsBilled = minutesToUnits(entryMinutes, unitMinutes)
  const rate = ratePerUnit instanceof Decimal ? ratePerUnit : new Decimal(ratePerUnit)
  const amount = new Decimal(unitsBilled).times(rate)
  
  return {
    unitsBilled,
    amount,
  }
}
