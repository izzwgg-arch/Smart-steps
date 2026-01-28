import { Decimal } from '@prisma/client/runtime/library'

/**
 * Billing utility functions for invoice calculations
 * Ensures consistent unit conversion and calculation logic across all invoice generation
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
 * Calculate invoice totals from timesheet entries
 * 
 * @param timesheetEntries - Array of timesheet entries with minutes and notes (DR/SV)
 * @param ratePerUnit - Rate per unit from Insurance
 * @param isRegularTimesheet - True if regular timesheet (SV entries = $0), false if BCBA (all entries charged)
 * @returns Object with totalMinutes, totalUnits (all units), billableUnits (charged units), and amount
 */
export function calculateInvoiceTotals(
  timesheetEntries: Array<{ minutes: number; notes?: string | null }>,
  ratePerUnit: Decimal | number,
  isRegularTimesheet: boolean = true
): {
  totalMinutes: number
  totalUnits: number // All units (DR + SV) for display
  billableUnits: number // Only charged units (DR for regular, all for BCBA)
  amount: Decimal
} {
  const rate = ratePerUnit instanceof Decimal ? ratePerUnit : new Decimal(ratePerUnit)
  
  let totalMinutes = 0
  let totalUnits = 0 // All units (for display)
  let billableUnits = 0 // Only charged units
  let amount = new Decimal(0)
  
  for (const entry of timesheetEntries) {
    const minutes = entry.minutes || 0
    const units = minutesToUnits(minutes)
    const isSV = entry.notes === 'SV'
    
    totalMinutes += minutes
    totalUnits += units // Always add to total units (for display)
    
    // For regular timesheets: SV entries = $0 (not added to billable)
    // For BCBA timesheets: All entries are billable
    if (isRegularTimesheet && isSV) {
      // SV on regular timesheet: count units for display but $0 charge
      billableUnits += 0 // Don't add to billable
      // amount stays the same (no charge)
    } else {
      // DR entries on regular, or all entries on BCBA
      billableUnits += units
      amount = amount.plus(new Decimal(units).times(rate))
    }
  }
  
  return {
    totalMinutes,
    totalUnits,
    billableUnits,
    amount,
  }
}

/**
 * Calculate invoice totals per entry (for line items)
 * 
 * @param entryMinutes - Minutes for a single entry
 * @param entryNotes - Notes field ('DR' or 'SV' or null)
 * @param ratePerUnit - Rate per unit from Insurance
 * @param isRegularTimesheet - True if regular timesheet (SV = $0), false if BCBA (all charged)
 * @returns Object with units and amount for this entry
 */
export function calculateEntryTotals(
  entryMinutes: number,
  entryNotes: string | null | undefined,
  ratePerUnit: Decimal | number,
  isRegularTimesheet: boolean = true
): {
  units: number
  amount: Decimal
} {
  const units = minutesToUnits(entryMinutes)
  const rate = ratePerUnit instanceof Decimal ? ratePerUnit : new Decimal(ratePerUnit)
  const isSV = entryNotes === 'SV'
  
  // For regular timesheets: SV entries = $0
  // For BCBA timesheets: All entries charged normally
  const amount = (isRegularTimesheet && isSV)
    ? new Decimal(0) // SV on regular = $0
    : new Decimal(units).times(rate) // Normal charge
  
  return {
    units,
    amount,
  }
}
