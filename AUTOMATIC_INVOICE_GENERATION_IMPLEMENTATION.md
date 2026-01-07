# Automatic Weekly Invoice Generation - Implementation Summary

## ✅ Status: COMPLETE

All requirements for automatic weekly invoice generation have been implemented.

## 🎯 Implementation Details

### 1. Schedule Configuration
- **Schedule**: Every Tuesday at 7:00 AM ET (America/New_York)
- **Cron Expression**: `0 7 * * 2`
- **Location**: `lib/cron.ts`
- **Implementation**: Uses `node-cron` with timezone support

### 2. Billing Period Calculation
- **Period**: Monday 12:00 AM → Monday 11:59 PM (whole week, Monday to Monday)
- **Location**: `lib/billingPeriodUtils.ts`
- **Function**: `calculateWeeklyBillingPeriod()`
- **Logic**:
  - If today is Tuesday after 7 AM: Last Monday → Yesterday (Monday)
  - Otherwise: Find most recent completed period (Monday → Monday)
- **Timezone**: America/New_York (configurable)

### 3. Invoice Generation Rules

#### Grouping
- **Groups by**: Client (one invoice per client)
- **Location**: `lib/jobs/invoiceGeneration.ts`
- **Function**: `generateInvoicesForApprovedTimesheets()`
- **Note**: All timesheets for a client are aggregated into one invoice

#### Eligibility
- Only **APPROVED** timesheets are included
- Only entries **NOT already invoiced** are included
- Only entries within the billing period are included
- Timesheets must overlap with billing period

#### Unit Calculation
- **1 unit = 15 minutes**
- **Policy**: Round UP to nearest 15 minutes
- **Function**: `calculateUnitsRounded()` from `lib/timesheetUtils.ts`
- **Formula**: `Math.ceil(minutes / 15) * 15 / 15`
- **Consistency**: Matches exactly with Timesheet page rounding policy

#### Rate Snapshot
- **Rate**: Insurance rate per unit (from client's insurance)
- Insurance rate is **snapshotted** at invoice generation time
- Stored in `InvoiceEntry.rate` field
- Future rate changes do NOT affect past invoices
- All timesheets for a client use the same insurance rate

### 4. Idempotency
- **Check**: Verifies if invoice already exists for Client + Insurance + Billing Period
- **Prevention**: Skips generation if all eligible entries are already invoiced
- **Safety**: Safe to run multiple times without creating duplicates
- **Location**: `generateInvoiceForClientAndInsurance()` function

### 5. Post-Generation Behavior
- ✅ Marks all included entries as `invoiced: true`
- ✅ Locks timesheets (`status: 'LOCKED'`, `lockedAt: timestamp`)
- ✅ Stores invoice ID reference (via `InvoiceEntry.timesheetId`)
- ✅ Prevents duplicate billing under all circumstances

### 6. Error Handling
- ✅ Full error logging with context
- ✅ Transaction rollback on failure (atomic operation)
- ✅ Partial failures logged but don't stop other invoices
- ✅ NaN validation before creating invoice
- ✅ 30-second transaction timeout

### 7. Manual Invoice Generation (Admin)
- **UI Location**: `components/invoices/InvoicesList.tsx`
- **API Location**: `app/api/invoices/generate/route.ts`
- **Features**:
  - Shows current billing period
  - Option for custom date range
  - Same logic as automatic generation
  - Admin-only access
  - Real-time feedback

## 📁 Files Created/Modified

### New Files
- `lib/billingPeriodUtils.ts` - Billing period calculation utilities
- `app/api/invoices/generate/route.ts` - Manual invoice generation API
- `AUTOMATIC_INVOICE_GENERATION_IMPLEMENTATION.md` - This file

### Modified Files
- `lib/cron.ts` - Updated schedule to Tuesday 7:00 AM
- `lib/jobs/invoiceGeneration.ts` - Complete rewrite with new requirements
- `components/invoices/InvoicesList.tsx` - Added manual generation UI
- `app/api/cron/invoice-generation/route.ts` - Updated schedule info

## 🔍 Key Functions

### `calculateWeeklyBillingPeriod(referenceDate?)`
Calculates the weekly billing period (Previous Tuesday 12:00 AM → Monday 11:59 PM)

### `generateInvoicesForApprovedTimesheets(customBillingPeriod?)`
Main invoice generation function. Groups by Client + Insurance, uses rounding policy, marks entries as invoiced.

### `generateInvoiceForClient(clientId, timesheets, billingPeriod)`
Generates a single invoice for a Client. Aggregates all timesheets for the client. Uses client's insurance rate. Idempotent.

## 🧪 Testing Checklist

- [ ] Verify invoices auto-generate every Tuesday at 7:00 AM
- [ ] Verify correct billing period boundaries (Monday 12:00 AM → Monday 11:59 PM)
- [ ] Verify insurance rate accuracy (snapshot at generation time)
- [ ] Verify no duplicate invoices are created (idempotency)
- [ ] Verify manual generation matches automatic results exactly
- [ ] Verify entries are marked as invoiced
- [ ] Verify timesheets are locked after invoicing
- [ ] Verify rounding policy matches Timesheet page (round UP to 15 minutes)
- [ ] Verify grouping by Client works correctly (one invoice per client)
- [ ] Verify error handling and transaction rollback

## 📋 Invoice Content

Each generated invoice includes:
- ✅ Client details
- ✅ Insurance name
- ✅ Billing period (start date → end date)
- ✅ Provider(s) (from timesheet entries)
- ✅ BCBA(s) (from timesheet entries)
- ✅ Line-item breakdown (via InvoiceEntry relationship to TimesheetEntry)
- ✅ Totals:
  - Total minutes
  - Total units (rounded up)
  - Rate per unit (snapshot)
  - Total amount due

## 🔒 Safety Features

1. **Atomic Transactions**: All-or-nothing invoice creation
2. **Idempotency**: Safe to run multiple times
3. **Duplicate Prevention**: Checks for existing invoices
4. **NaN Guards**: Validates all calculations
5. **Invoiced Flag**: Prevents double billing
6. **Timesheet Locking**: Prevents edits after invoicing

## 🚀 Deployment Notes

1. **Cron Job**: The cron job runs automatically when the server starts
2. **External Cron**: Can also use external cron service calling `/api/cron/invoice-generation`
3. **Environment**: Set `CRON_SECRET` in production for API security
4. **Timezone**: Default is `America/New_York`, can be configured

## 📝 Next Steps

1. Test the automatic generation on next Tuesday
2. Verify billing period calculations with real dates
3. Test manual generation with various date ranges
4. Monitor logs for any errors
5. Verify invoice content matches requirements

---

**Implementation Date**: Current session  
**Status**: ✅ Complete - Ready for Testing  
**Schedule**: Every Tuesday at 7:00 AM ET
