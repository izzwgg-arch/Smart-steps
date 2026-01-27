/**
 * Test script to verify billing calculations
 * Run with: npx ts-node scripts/test-billing-calculations.ts
 */

import { minutesToUnits, calculateEntryTotals } from '../lib/billing'
import { Decimal } from '@prisma/client/runtime/library'

console.log('Testing Billing Calculations\n')
console.log('=' .repeat(50))

// Test cases
const testCases = [
  { minutes: 323, expectedUnits: 22, description: '323 minutes (should round UP to 22 units)' },
  { minutes: 30, expectedUnits: 2, description: '30 minutes (exactly 2 units)' },
  { minutes: 15, expectedUnits: 1, description: '15 minutes (exactly 1 unit)' },
  { minutes: 16, expectedUnits: 2, description: '16 minutes (should round UP to 2 units)' },
  { minutes: 1, expectedUnits: 1, description: '1 minute (should round UP to 1 unit)' },
  { minutes: 14, expectedUnits: 1, description: '14 minutes (should round UP to 1 unit)' },
  { minutes: 29, expectedUnits: 2, description: '29 minutes (should round UP to 2 units)' },
  { minutes: 45, expectedUnits: 3, description: '45 minutes (exactly 3 units)' },
]

const ratePerUnit = new Decimal(50.00) // Example rate

let allPassed = true

for (const testCase of testCases) {
  const units = minutesToUnits(testCase.minutes, 15)
  const { amount } = calculateEntryTotals(testCase.minutes, ratePerUnit, 15)
  const expectedAmount = new Decimal(testCase.expectedUnits).times(ratePerUnit)
  
  const passed = units === testCase.expectedUnits
  allPassed = allPassed && passed
  
  console.log(`\nTest: ${testCase.description}`)
  console.log(`  Input: ${testCase.minutes} minutes`)
  console.log(`  Expected: ${testCase.expectedUnits} units`)
  console.log(`  Got: ${units} units`)
  console.log(`  Expected Amount: $${expectedAmount.toNumber().toFixed(2)}`)
  console.log(`  Calculated Amount: $${amount.toNumber().toFixed(2)}`)
  console.log(`  Status: ${passed ? '✅ PASS' : '❌ FAIL'}`)
  
  if (!passed) {
    console.log(`  ERROR: Expected ${testCase.expectedUnits} units but got ${units}`)
  }
}

console.log('\n' + '='.repeat(50))
console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)

// Verify the formula
console.log('\nFormula Verification:')
console.log('  ceil(323 / 15) = ceil(21.5333) = 22 ✅')
console.log('  ceil(30 / 15) = ceil(2.0) = 2 ✅')
console.log('  ceil(15 / 15) = ceil(1.0) = 1 ✅')
console.log('  ceil(16 / 15) = ceil(1.067) = 2 ✅')

process.exit(allPassed ? 0 : 1)
