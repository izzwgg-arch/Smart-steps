# Community Classes Module - Implementation Status

## ✅ COMPLETED

### 1. Database Schema (Prisma)
- ✅ Added `CommunityClient` model with firstName, lastName, address fields, status enum
- ✅ Added `CommunityClass` model with name, ratePerUnit (Decimal), isActive
- ✅ Added `CommunityInvoice` model with clientId, classId, units, ratePerUnit snapshot, totalAmount, status enum
- ✅ Extended `EmailQueueEntityType` enum to include `COMMUNITY_INVOICE`
- ✅ Added relations: CommunityInvoice → CommunityClient, CommunityInvoice → CommunityClass
- ✅ Added User relations for approvedBy/rejectedBy

### 2. Permissions
- ✅ Added all community permissions to `scripts/seed-permissions.ts`:
  - `community.view`
  - `community.clients.*` (view, create, update, delete)
  - `community.classes.*` (view, create, update, delete)
  - `community.invoices.*` (view, create, update, delete, approve, reject)
  - `community.invoices.emailqueue.*` (view, send)
- ✅ Added `dashboard.community` permission

### 3. Main Dashboard
- ✅ Added "Community Classes" tile to main dashboard (next to Insurance)
- ✅ Added icon (GraduationCap) and styling
- ✅ Added permission check and dashboard visibility mapping

### 4. Community Dashboard
- ✅ Created `/community` page with 3 tiles:
  - Classes
  - Clients
  - Invoices
- ✅ Permission-based visibility

### 5. API Routes - COMPLETED
- ✅ `/api/community/clients` (GET, POST)
- ✅ `/api/community/clients/[id]` (GET, PATCH, DELETE)
- ✅ `/api/community/classes` (GET, POST)
- ✅ `/api/community/classes/[id]` (GET, PATCH, DELETE)
- ✅ `/api/community/invoices` (GET, POST)
- ✅ `/api/community/invoices/[id]/approve` (POST) - transactional, creates email queue item
- ✅ `/api/community/invoices/[id]/reject` (POST) - updates status, logs audit

## 🚧 REMAINING WORK

### 1. UI Pages (Clone/Adapt Existing)

#### Community Clients Page (`/community/clients`)
**Status:** Pending
**Action:** Clone `app/clients/page.tsx` and `components/clients/ClientsList.tsx`
- Change API endpoints to `/api/community/clients`
- Update form fields to use firstName/lastName instead of name
- Update status field to use `ACTIVE/INACTIVE` enum
- Remove insurance field (not needed for community clients)
- Keep all other UI/UX exactly the same

#### Community Classes Page (`/community/classes`)
**Status:** Pending
**Action:** Create new page similar to Insurance or BCBAs page
- List table: Name, Rate Per Unit (formatted as currency), Status (Active/Inactive), Actions
- Add New Class modal/form:
  - Name (text input)
  - Rate per unit (money/decimal input)
  - Save button
- Edit/Delete via 3-dot menu
- Use same styling as other CRUD pages

#### Community Invoices Page (`/community/invoices`)
**Status:** Pending
**Action:** Create new page similar to main Invoices page
- List table showing: Client, Class, Units, Total Amount, Status, Actions
- Create Invoice form:
  - Select CommunityClient (dropdown)
  - Select CommunityClass (dropdown)
  - Enter Units (number input, 30-min units)
  - Show calculated Total = units * ratePerUnit (read-only)
  - Optional: Service Date, Notes
  - Save as DRAFT
- Actions menu per invoice:
  - Approve (only if DRAFT) → calls `/api/community/invoices/[id]/approve`
  - Reject (only if DRAFT) → calls `/api/community/invoices/[id]/reject`
  - Print/View (opens print preview)
  - Delete (soft delete)
- Status badges: DRAFT (gray), APPROVED (blue), REJECTED (red), QUEUED (yellow), EMAILED (green)

### 2. Email Queue System

#### Community Email Queue Page (`/community/email-queue`)
**Status:** Pending
**Action:** Clone `app/email-queue/page.tsx`
- Change API endpoint to `/api/community/email-queue`
- Filter EmailQueueItem by `entityType: 'COMMUNITY_INVOICE'`
- Display: Client Name, Class Name, Units, Total Amount, Status, Error (if failed)
- "Send All Queued" button → calls `/api/community/email-queue/send-batch`

#### Email Queue Send Batch API (`/api/community/email-queue/send-batch`)
**Status:** Pending
**Action:** Clone `app/api/email-queue/send-batch/route.ts`
- Fetch all QUEUED items with `entityType: 'COMMUNITY_INVOICE'`
- Update status to SENDING (transactional)
- Generate PDFs for each invoice (see Print/PDF section below)
- Send ONE email with:
  - Subject: "Smart Steps ABA – Approved Community Invoices Batch (YYYY-MM-DD)"
  - Body: Summary of invoices (count, total amount, list of items)
  - Attachments: All invoice PDFs
- On success: Mark queue items SENT, update invoices to EMAILED
- On failure: Mark queue items FAILED with error message
- Use existing `sendMailSafe()` from `lib/email.ts`
- Reuse SMTP env vars (EMAIL_FROM, EMAIL_APPROVAL_RECIPIENTS or COMMUNITY_INVOICE_RECIPIENTS)

#### Email Queue List API (`/api/community/email-queue`)
**Status:** Pending
**Action:** Clone `app/api/email-queue/route.ts`
- Filter by `entityType: 'COMMUNITY_INVOICE'`
- Include invoice details (client, class)
- Return queued items with status

### 3. Print/PDF Generation

#### Community Invoice Print Preview
**Status:** Pending
**Action:** Create `components/community/CommunityInvoicePrintPreview.tsx`
- Similar to `TimesheetPrintPreview.tsx`
- Header: "Smart Steps ABA" (centered, bold)
- Client Info: Name (firstName + lastName), Address, Phone, Email
- Class Info: Class Name, Rate Per Unit
- Invoice Details:
  - Units: X units (30 minutes each)
  - Rate Per Unit: $XX.XX
  - Total Amount: $XX.XX
  - Service Date (if provided)
  - Invoice Date (createdAt)
- Notes section (if provided)
- Print button, Close button
- Use same print styles from `app/globals.css`

#### Community Invoice PDF Generator
**Status:** Pending
**Action:** Create `lib/pdf/communityInvoicePDFGenerator.ts`
- Similar to `timesheetPDFGenerator.ts`
- Use PDFKit
- Same layout as print preview
- Export function: `generateCommunityInvoicePDF(invoice: CommunityInvoiceForPDF): Promise<Buffer>`

### 4. Role Permissions UI

#### Add Community Permissions to RoleForm
**Status:** Pending
**Action:** Update `components/roles/RoleForm.tsx`
- Add new section: "Community Classes Module"
- Permissions to show:
  - View Community Classes Module
  - Community Clients (View, Create, Update, Delete)
  - Community Classes (View, Create, Update, Delete)
  - Community Invoices (View, Create, Update, Delete, Approve, Reject)
  - Community Email Queue (View, Send Batch)
- Use same checkbox pattern as existing permissions

### 5. Audit Logging

#### Update AuditAction Enum
**Status:** Pending (if needed)
**Action:** Check if we need new audit actions:
- Currently using `APPROVE` and `REJECT` (generic)
- May want: `COMMUNITY_INVOICE_APPROVED`, `COMMUNITY_INVOICE_REJECTED`
- Check `lib/audit.ts` to see if logApprove/logReject handle CommunityInvoice correctly

## 📋 DEPLOYMENT CHECKLIST

### Before Deployment:
1. ✅ Run `npx prisma generate` to update Prisma client
2. ✅ Run `npx prisma migrate dev --name add_community_classes_module` (or `prisma db push` for dev)
3. ✅ Run `npx tsx scripts/seed-permissions.ts` to seed new permissions
4. ⚠️ Test locally:
   - Create community client
   - Create community class
   - Create community invoice
   - Approve invoice (should queue for email)
   - View email queue
   - Send batch email

### Server Deployment:
1. Pull latest code
2. Run `npm install` (if new dependencies)
3. Run `npx prisma generate`
4. Run `npx prisma migrate deploy` (production-safe migration)
5. Run `npx tsx scripts/seed-permissions.ts`
6. Run `npm run build`
7. Restart PM2: `pm2 restart aplus-center`

### Environment Variables:
- ✅ Reuse existing SMTP vars:
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_SECURE`
  - `SMTP_USER`
  - `SMTP_PASS`
  - `EMAIL_FROM`
  - `EMAIL_APPROVAL_RECIPIENTS`
- Optional: Add `COMMUNITY_INVOICE_RECIPIENTS` (falls back to `EMAIL_APPROVAL_RECIPIENTS` if not set)

## 🎯 ACCEPTANCE TESTS

1. ✅ Main dashboard shows "Community Classes" tile (only for permitted roles)
2. ✅ Community dashboard loads with 3 tiles
3. ⚠️ Community Clients page works (clone existing, separate data)
4. ⚠️ Create class "Yoga" rate $25.00 → shows in table
5. ⚠️ Create invoice for client X, class Yoga, 2 units → Total $50.00, Status DRAFT
6. ⚠️ Approve invoice → Status QUEUED, appears in email queue
7. ⚠️ Email queue loads without errors
8. ⚠️ Send batch → sends ONE email with all queued invoices, marks SENT
9. ⚠️ Print invoice → shows correct format with Smart Steps ABA header
10. ⚠️ No regressions to existing BCBA timesheets/email queue

## 📝 NOTES

- All community data is completely separate from main ABA data
- Email queue reuses existing `EmailQueueItem` table with `COMMUNITY_INVOICE` entity type
- Permissions follow same pattern as timesheets module
- UI styling matches existing pages exactly
- Print/PDF uses same "Smart Steps ABA" header as timesheets
