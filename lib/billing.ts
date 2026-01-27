import { Decimal } from '@prisma/client/runtime/library'

/**
 * Billing utility functions for invoice calculations
 * Ensures consistent unit conversion and calculation logic across all invoice generation
 */

/**
 * Convert minutes to billable units
 * Uses ceil() to round UP to the next whole unit (standard ABA billing practice)
 * 
 * @param minutes - Total service minutes
 * @param unitMinutes - Minutes per unit (default: 15)
 * @returns Number of billable units (always rounded UP)
 * 
 * Examples:
 * - 323 minutes / 15 = 21.533 → 22 units
 * - 30 minutes / 15 = 2.0 → 2 units
 * - 15 minutes / 15 = 1.0 → 1 unit
 * - 16 minutes / 15 = 1.067 → 2 units
 */
export function minutesToUnits(minutes: number, unitMinutes: number = 15): number {
  if (minutes <= 0) return 0
  if (unitMinutes <= 0) throw new Error('unitMinutes must be greater than 0')
  return Math.ceil(minutes / unitMinutes)
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
