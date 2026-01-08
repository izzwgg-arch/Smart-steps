# Fixes Summary: Role-Based Dashboards + Overlap Prevention

## PART 1: Role-Based Dashboard Fixes

### Root Cause
The dashboard was "dead" for new users because:
1. **USER roles** only had basic permissions like `timesheets.view`, `invoices.view`
2. **Dashboard cards** checked for `dashboard.timesheets`, `dashboard.invoices` permissions
3. **USER roles didn't have dashboard permissions**, so all cards were filtered out
4. Even if a card was visible, clicking it would redirect back due to `canAccessRoute` checking dashboard permissions

### Fixes Implemented

#### 1. Enhanced `getUserPermissions()` (`lib/permissions.ts`)
- **USER roles**: Now automatically grant dashboard permissions based on underlying permissions
  - If user has `timesheets.view`, they get `dashboard.timesheets`
  - If user has `invoices.view`, they get `dashboard.invoices`
  - Same mapping for all dashboard sections
- **CUSTOM roles**: Same logic applied - dashboard permissions granted based on underlying permissions if not explicitly set

#### 2. Enhanced `canSeeDashboardSection()` (`lib/permissions.ts`)
- **Fallback logic**: If explicit dashboard permission doesn't exist, check underlying permissions
- Example: If `dashboard.timesheets` not found, check `timesheets.view`, `timesheets.create`, `timesheets.update`
- This ensures backward compatibility and works for all role types

#### 3. Debug Permissions Panel (`app/dashboard/page.tsx`)
- Added collapsible debug section visible to ADMIN/SUPER_ADMIN in dev mode
- Shows:
  - User role and ID
  - Dashboard visibility settings
  - Dashboard cards visibility status
  - Sample permissions (first 20)

### Testing Required
1. Create a new USER role user
2. Log in and verify dashboard cards are visible and clickable
3. Verify navigation works to permitted pages
4. Verify cards for non-permitted sections are hidden (not dead)
5. Test with a CUSTOM role user
6. Test with a deactivated user (should be blocked)

---

## PART 2: Overlap Prevention Fixes

### Root Cause
Overlaps were allowed because:
1. **Frontend** only checked internal overlaps (within same timesheet)
2. **No real-time checking** against existing saved timesheets
3. **Backend validation existed** but frontend didn't call it before save
4. **UI feedback** was minimal - only showed "Overlap!" without details

### Fixes Implemented

#### 1. New API Endpoint (`app/api/timesheets/check-overlaps/route.ts`)
- **POST `/api/timesheets/check-overlaps`**
- Accepts: `providerId`, `clientId`, `entries[]`, `excludeTimesheetId?`
- Returns: `{ hasOverlaps: boolean, conflicts: OverlapConflict[] }`
- Uses same `detectTimesheetOverlaps()` logic as save endpoint
- Allows frontend to check overlaps in real-time before save

#### 2. Enhanced Frontend Overlap Checking (`components/timesheets/TimesheetForm.tsx`)
- **Internal overlaps**: Still checked via `checkInternalOverlaps()`
- **External overlaps**: Now checked via API call to `/api/timesheets/check-overlaps`
- **Real-time validation**: Checks whenever `dayEntries`, `providerId`, or `clientId` change
- **Merged conflicts**: Internal and external conflicts are combined and displayed together

#### 3. Enhanced UI Feedback
- **Conflict messages section**: Added prominent red-bordered box showing all conflicts
- **Detailed messages**: Each conflict shows:
  - Date of conflict
  - Type (DR/SV)
  - Full conflict message from backend
  - Indicator if conflict is with existing timesheet
- **Row highlighting**: Conflicting rows have red background (`bg-red-50`)
- **Field highlighting**: Conflicting time fields have red border (`border-red-500`)
- **Auto-scroll**: Automatically scrolls to first conflict
- **Save button**: Disabled when conflicts exist
- **Tooltips**: "Overlap!" labels have tooltips with full message

#### 4. Backend Enforcement (Already Existed, Verified)
- **POST `/api/timesheets`**: Validates overlaps before creating
- **PUT `/api/timesheets/[id]`**: Validates overlaps before updating (excludes current timesheet)
- **Structured errors**: Returns `{ code: 'OVERLAP_CONFLICT', conflicts: [...] }`
- **Frontend handles**: Displays backend errors if frontend check missed something

#### 5. Database Indexes (`prisma/schema.prisma`)
- **TimesheetEntry**:
  - `@@index([date])` - For date range queries
  - `@@index([timesheetId, date])` - For timesheet-specific date queries
- **Timesheet**:
  - `@@index([providerId, deletedAt])` - For provider overlap queries
  - `@@index([clientId, deletedAt])` - For client overlap queries
  - `@@index([deletedAt])` - For filtering non-deleted timesheets

### Overlap Rules Enforced
1. **Same Provider** on same date
2. **Same Client** on same date
3. **Within same timesheet**: DR-DR, SV-SV, DR-SV
4. **Across existing timesheets**: Same provider/client combinations
5. **Edge case**: `endA == startB` is **allowed** (no overlap)

### Testing Required
1. **Internal overlap**: Create two DR entries on same date with overlapping times → should block
2. **DR vs SV overlap**: Create DR and SV on same date with overlapping times → should block
3. **External overlap**: Save a timesheet, then try to create another with overlapping times → should block
4. **Edge case**: Create entry ending at 2:00 PM, another starting at 2:00 PM → should allow
5. **UI feedback**: Verify conflicts are highlighted, messages shown, save disabled
6. **Backend enforcement**: Try to bypass frontend (API call) → should still reject

---

## Database Migration Required

Run the following to apply the new indexes:

```bash
npx prisma migrate dev --name add_overlap_indexes
```

Or if using production:

```bash
npx prisma migrate deploy
```

---

## Files Changed

### Core Fixes
- `lib/permissions.ts` - Enhanced permission logic for USER/CUSTOM roles
- `app/dashboard/page.tsx` - Added debug panel
- `components/timesheets/TimesheetForm.tsx` - Enhanced overlap checking and UI
- `app/api/timesheets/check-overlaps/route.ts` - New API endpoint
- `prisma/schema.prisma` - Added database indexes

### Verification
- All linter errors resolved
- TypeScript types correct
- No breaking changes to existing functionality

---

## Next Steps

1. **Run database migration** to add indexes
2. **Test dashboard** with different user roles
3. **Test overlap blocking** end-to-end
4. **Verify** all edge cases work correctly
5. **Deploy** to production
