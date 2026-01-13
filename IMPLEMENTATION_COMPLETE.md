# Community Email Queue Fixes - Implementation Complete

## Summary

Successfully implemented separation between MAIN and COMMUNITY email queues with proper recipient handling, attachment support, and scheduling.

## ✅ Completed Tasks

### 1. Database Schema ✅
- Added `EmailQueueContext` enum (MAIN | COMMUNITY)
- Added `context`, `attachmentKey`, `attachmentUrl`, `attachmentFilename` to `EmailQueueItem`
- Added granular permissions to `Role` model
- Created migration SQL file

### 2. Backend - Recipient Separation ✅
- **MAIN Email Queue:** Always uses fixed recipients (`info@productivebilling.com`, `jacobw@apluscenterinc.org`)
- **COMMUNITY Email Queue:** Requires user-entered recipients (no fallback)
- Both routes set `context` appropriately
- Scheduled email sender uses stored recipients for COMMUNITY (no fallback)

### 3. Backend - Attachment Support ✅
- Created `/api/community/email-queue/attachment-upload` endpoint
- Created `/api/community/email-queue/attachment/[key]` endpoint
- Updated send-batch route to load and attach additional PDF
- Updated scheduled email sender to include attachments
- Files stored in `uploads/community-email-attachments/`

### 4. Backend - Logging ✅
- `[EMAIL_MAIN]` prefix for main queue operations
- `[EMAIL_COMMUNITY]` prefix for community queue operations
- Logs include: recipients, context, attachment status

### 5. Frontend - UI Updates ✅
- Added "Attach PDF" button next to "Send Selected"
- File upload with validation (PDF only, max 10MB)
- Shows selected filename with remove option
- Attachment included in send/schedule requests
- Recipient field already present and validated

### 6. Context Setting ✅
- Timesheet approval → creates queue item with `context: 'MAIN'`
- Community invoice approval → creates queue item with `context: 'COMMUNITY'`
- Send operations set context on existing items

## Files Changed

### Modified (9 files):
1. `prisma/schema.prisma`
2. `app/api/community/email-queue/send-batch/route.ts`
3. `app/api/community/invoices/[id]/approve/route.ts`
4. `app/api/email-queue/send-batch/route.ts`
5. `app/api/email-queue/send-selected/route.ts`
6. `app/api/timesheets/[id]/approve/route.ts`
7. `lib/jobs/scheduledEmailSender.ts`
8. `app/community/email-queue/page.tsx`

### Created (4 files):
1. `app/api/community/email-queue/attachment-upload/route.ts`
2. `app/api/community/email-queue/attachment/[key]/route.ts`
3. `prisma/migrations/add_email_queue_context_and_attachments/migration.sql`
4. `COMMUNITY_EMAIL_QUEUE_FIXES_SUMMARY.md`

## Key Behaviors

### MAIN Email Queue
- Recipients: **ALWAYS** `info@productivebilling.com`, `jacobw@apluscenterinc.org`
- Context: `MAIN`
- No user input for recipients
- No attachment support

### COMMUNITY Email Queue
- Recipients: **User-entered** (REQUIRED, no fallback)
- Context: `COMMUNITY`
- Attachment support: Yes (optional additional PDF)
- Scheduling: Yes (with user-entered recipients)
- Validation: Fails with 400 if recipients missing

## Next Steps

1. **Deploy:**
   ```bash
   git add .
   git commit -m "Fix Community Email Queue: separate recipients, add attachment support"
   git push origin main
   ```

2. **On Server:**
   ```bash
   cd /var/www/aplus-center
   git pull origin main
   npx prisma migrate deploy
   npx prisma generate
   mkdir -p uploads/community-email-attachments
   npm run build
   node create-prerender.js
   pm2 restart aplus-center
   ```

3. **Verify:**
   - Test MAIN queue sends to fixed recipients
   - Test COMMUNITY queue sends to user-entered recipients
   - Test attachment upload and inclusion
   - Test scheduled sends use stored recipients

## Verification Commands

```bash
# Check logs
pm2 logs aplus-center --lines 200 | grep -E "EMAIL_MAIN|EMAIL_COMMUNITY"

# Check database
psql -d apluscenter -c "SELECT context, COUNT(*) FROM \"EmailQueueItem\" GROUP BY context;"
psql -d apluscenter -c "SELECT \"toEmail\", context FROM \"EmailQueueItem\" WHERE context = 'COMMUNITY' LIMIT 5;"
```

## Expected Log Output

**Main Queue:**
```
[EMAIL_MAIN] Sending batch email {
  recipients: 'info@productivebilling.com, jacobw@apluscenterinc.org',
  source: 'MAIN',
  ...
}
```

**Community Queue:**
```
[EMAIL_COMMUNITY] Sending batch email {
  recipients: 'user@example.com',
  source: 'COMMUNITY',
  context: 'COMMUNITY',
  hasAttachment: true,
  ...
}
```

**Scheduled Community:**
```
[EMAIL_COMMUNITY] Processing scheduled email {
  recipients: 'user@example.com',
  source: 'COMMUNITY',
  context: 'COMMUNITY',
  fromStoredToEmail: 'user@example.com',
  hasAdditionalAttachment: true,
  ...
}
```
