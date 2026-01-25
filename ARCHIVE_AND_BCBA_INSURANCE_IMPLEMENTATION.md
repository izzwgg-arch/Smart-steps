# Archive Controls + BCBA Insurance Implementation Summary

## ✅ COMPLETED - PART A: Archive Controls + Checkbox Actions

### 1. Database Schema Changes
- ✅ Added `archived` boolean field to `Timesheet` model (default: false)
- ✅ Added `bcbaInsuranceId` field to `Timesheet` model
- ✅ Added `BcbaInsurance` model with fields:
  - `name` (string, unique)
  - `ratePerUnit` (decimal)
  - `unitMinutes` (int, default: 15)
  - `active` (boolean, default: true)
  - `notes` (string, optional)
- ✅ Added indexes for archive filtering

### 2. API Endpoints Created
- ✅ `POST /api/timesheets/batch/archive` - Batch archive/unarchive regular timesheets
- ✅ `POST /api/bcba-timesheets/batch/archive` - Batch archive/unarchive BCBA timesheets
- ✅ `POST /api/timesheets/batch/generate-invoice` - Generate invoices from selected regular timesheets (archive)
- ✅ `POST /api/bcba-timesheets/batch/generate-invoice` - Generate invoices from selected BCBA timesheets (archive) using BCBA Insurance rates

### 3. Archive Query Updates
- ✅ Updated `/api/timesheets` route to check `archived` flag:
  - Active list: shows non-invoiced AND non-archived timesheets
  - Archive list: shows timesheets that are invoiced OR manually archived

### 4. UI Components Updated

#### Regular Timesheets (`TimesheetsList.tsx`)
- ✅ Added checkboxes to archive view (previously only in active view)
- ✅ Added batch action buttons:
  - **Active page**: "Move to archive" button (shown when items selected)
  - **Archive page**: "Move out of archive" and "Generate invoice" buttons
  - "Clear selection" button
- ✅ Batch actions appear when >= 1 item is selected

#### BCBA Timesheets (`BCBATimesheetsList.tsx`)
- ✅ Added checkboxes to archive view (previously only in active view)
- ✅ Added batch action buttons:
  - **Active page**: "Move to archive" button (shown when items selected)
  - **Archive page**: "Move out of archive" and "Generate invoice" buttons
  - "Clear selection" button
- ✅ Updated "Generate Invoice" to require checkbox selection (shows toast if nothing selected)
- ✅ Generate Invoice now uses `/api/bcba-timesheets/batch/generate-invoice` endpoint

## ✅ COMPLETED - PART B: BCBA Insurance Module (Partial)

### 1. Database Schema
- ✅ `BcbaInsurance` model created (see above)

### 2. API Endpoints Created
- ✅ `GET /api/bcba-insurance` - List all BCBA insurance records
- ✅ `POST /api/bcba-insurance` - Create new BCBA insurance
- ✅ `GET /api/bcba-insurance/[id]` - Get single BCBA insurance
- ✅ `PUT /api/bcba-insurance/[id]` - Update BCBA insurance
- ✅ `DELETE /api/bcba-insurance/[id]` - Delete BCBA insurance (soft delete)

### 3. BCBA Invoice Generation
- ✅ Updated `/api/bcba-timesheets/batch/generate-invoice` to:
  - Use `bcbaInsuranceId` from timesheet
  - Get rate from `BcbaInsurance.ratePerUnit`
  - Use `unitMinutes` (15 minutes) for unit calculation
  - Store BCBA insurance info in invoice notes

## ⚠️ REMAINING TASKS

### PART B: BCBA Insurance UI Pages
- ⏳ Create `app/bcba-insurance/page.tsx` (list page)
- ⏳ Create `app/bcba-insurance/new/page.tsx` (create page)
- ⏳ Create `app/bcba-insurance/[id]/edit/page.tsx` (edit page)
- ⏳ Create `components/bcba-insurance/BcbaInsuranceList.tsx` (list component)
- ⏳ Create `components/bcba-insurance/BcbaInsuranceForm.tsx` (form component)
- ⏳ Add navigation link to BCBA Insurance in dashboard/nav

### PART B: Link BCBA Timesheets to BCBA Insurance
- ⏳ Update BCBA timesheet creation form to include BCBA Insurance dropdown
- ⏳ Update BCBA timesheet edit form to include BCBA Insurance dropdown
- ⏳ Ensure BCBA Insurance dropdown only shows active records
- ⏳ Validate that BCBA timesheets have BCBA Insurance before allowing invoice generation

### PART B: Permissions
- ⏳ Add `bcbaInsurance.view` permission to permission system
- ⏳ Add `bcbaInsurance.manage` permission (create/edit/delete)
- ⏳ Update role editor to show BCBA Insurance permissions
- ⏳ Set default permissions for existing roles (admins should have access)

## 📋 Files Changed

### Schema & Database
- `prisma/schema.prisma` - Added `archived`, `bcbaInsuranceId`, `BcbaInsurance` model

### API Routes
- `app/api/timesheets/batch/archive/route.ts` (NEW)
- `app/api/bcba-timesheets/batch/archive/route.ts` (NEW)
- `app/api/timesheets/batch/generate-invoice/route.ts` (NEW)
- `app/api/bcba-timesheets/batch/generate-invoice/route.ts` (NEW)
- `app/api/bcba-insurance/route.ts` (NEW)
- `app/api/bcba-insurance/[id]/route.ts` (NEW)
- `app/api/timesheets/route.ts` - Updated archive query logic

### UI Components
- `components/timesheets/TimesheetsList.tsx` - Added checkboxes, batch actions
- `components/timesheets/BCBATimesheetsList.tsx` - Added checkboxes, batch actions, updated Generate Invoice

## 🧪 Testing Checklist

### Part A - Archive Controls
- [ ] Select timesheets in active list → Click "Move to archive" → Verify they appear in archive
- [ ] Select timesheets in archive → Click "Move out of archive" → Verify they return to active
- [ ] Select timesheets in archive → Click "Generate invoice" → Verify invoices created
- [ ] Select timesheets in active BCBA list → Click "Generate Invoice" → Verify requires selection (toast if none)
- [ ] Verify checkboxes work in both active and archive views
- [ ] Verify "Select all" checkbox works

### Part B - BCBA Insurance (After UI is created)
- [ ] Create BCBA Insurance record with rate per unit
- [ ] Edit BCBA Insurance record
- [ ] Delete BCBA Insurance record (soft delete)
- [ ] Create BCBA timesheet → Select BCBA Insurance from dropdown
- [ ] Edit BCBA timesheet → Change BCBA Insurance
- [ ] Generate invoice from BCBA timesheets → Verify uses BCBA Insurance rate
- [ ] Verify regular timesheets still use regular Insurance (unchanged)

## 📝 Migration Required

Before deploying, run:
```bash
npx prisma migrate dev --name add_archive_and_bcba_insurance
```

Or create manual migration SQL:
```sql
-- Add archived field
ALTER TABLE "Timesheet" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Timesheet" ADD COLUMN "bcbaInsuranceId" TEXT;

-- Create BcbaInsurance table
CREATE TABLE "BcbaInsurance" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ratePerUnit" DECIMAL(10,2) NOT NULL,
  "unitMinutes" INTEGER NOT NULL DEFAULT 15,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "BcbaInsurance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BcbaInsurance_name_key" ON "BcbaInsurance"("name");
CREATE INDEX "BcbaInsurance_name_idx" ON "BcbaInsurance"("name");
CREATE INDEX "BcbaInsurance_active_deletedAt_idx" ON "BcbaInsurance"("active", "deletedAt");

-- Add foreign key
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_bcbaInsuranceId_fkey" 
  FOREIGN KEY ("bcbaInsuranceId") REFERENCES "BcbaInsurance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX "Timesheet_archived_deletedAt_idx" ON "Timesheet"("archived", "deletedAt");
CREATE INDEX "Timesheet_isBCBA_archived_deletedAt_idx" ON "Timesheet"("isBCBA", "archived", "deletedAt");
```

## ⚠️ Important Notes

1. **Regular Insurance Unchanged**: Regular timesheets continue to use regular Insurance. No changes to regular Insurance logic.

2. **BCBA Invoice Generation**: BCBA invoices now use BCBA Insurance rates. The invoice notes field stores the BCBA insurance name and rate for reference.

3. **Archive Logic**: Archives now show timesheets that are either:
   - Invoiced (has invoiceEntries), OR
   - Manually archived (archived = true)

4. **Permissions**: BCBA Insurance permissions need to be added to the permission system. Currently, API routes check for `bcbaInsurance.view` and `bcbaInsurance.manage` permissions.

5. **Migration**: The Prisma schema has been updated but migration needs to be created and applied.
