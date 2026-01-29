/**
 * Client-side billing utility functions
 * These are safe to use in client components (no Prisma dependencies)
 */

/**
 * Convert minutes to units
 * STRICT RULE: 1 Hour = 4 Units
 * Formula: Units = (Minutes / 60) × 4 = Hours × 4
 * 
 * @param minutes - Total service minutes
 * @returns Number of units (calculated as Hours × 4, rounded to 2 decimals)
 * 
 * Examples:
 * - 90 minutes = 1.5 hours × 4 = 6.00 units
 * - 120 minutes = 2 hours × 4 = 8.00 units
 * - 60 minutes = 1 hour × 4 = 4.00 units
 * - 30 minutes = 0.5 hours × 4 = 2.00 units
 */
export function minutesToUnits(minutes: number): number {
  if (minutes <= 0) return 0
  // Formula: Units = Hours × 4
  const hours = minutes / 60
  const units = hours * 4
  // Round to 2 decimal places
  return Math.round(units * 100) / 100
}

/**
 * Calculate invoice totals per entry (for line items) - Client version
 * 
 * @param entryMinutes - Minutes for a single entry
 * @param entryNotes - Notes field ('DR' or 'SV' or null)
 * @param ratePerUnit - Rate per unit from Insurance (as number)
 * @param isRegularTimesheet - True if regular timesheet (SV = $0), false if BCBA (all charged)
 * @returns Object with units and amount for this entry
 */
export function calculateEntryTotals(
  entryMinutes: number,
  entryNotes: string | null | undefined,
  ratePerUnit: number,
  isRegularTimesheet: boolean = true
): {
  units: number
  amount: number
} {
  const units = minutesToUnits(entryMinutes)
  const isSV = entryNotes === 'SV'
  
  // For regular timesheets: SV entries = $0
  // For BCBA timesheets: All entries charged normally
  const amount = (isRegularTimesheet && isSV)
    ? 0 // SV on regular = $0
    : units * ratePerUnit // Normal charge
  
  return {
    units,
    amount,
  }
}
