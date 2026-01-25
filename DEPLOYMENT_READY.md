# Archive Controls + BCBA Insurance - Ready for Deployment

## ✅ Implementation Complete

All code has been implemented and is ready for deployment.

## 📋 Deployment Steps

### 1. Run Database Migration

On the server, run:
```bash
cd /var/www/aplus-center
npx prisma migrate deploy
```

Or manually run the SQL from:
`prisma/migrations/add_archive_and_bcba_insurance/migration.sql`

### 2. Regenerate Prisma Client

```bash
npx prisma generate
```

### 3. Build and Restart

```bash
npm run build
pm2 restart aplus-center
```

## ✅ What's Included

### Part A: Archive Controls
- ✅ Checkboxes on all timesheet pages (active + archive)
- ✅ Batch actions: Move to/from archive, Generate invoice
- ✅ Archive queries updated to check archived flag
- ✅ Generate Invoice requires selection for BCBA

### Part B: BCBA Insurance
- ✅ BCBA Insurance CRUD pages
- ✅ BCBA Insurance dropdown in BCBA timesheet forms
- ✅ BCBA invoice generation uses BCBA Insurance rates
- ✅ Dashboard navigation link added

## 🧪 Testing Checklist

After deployment:
1. ✅ Navigate to Dashboard → BCBA Insurance
2. ✅ Create a BCBA Insurance record
3. ✅ Create/edit BCBA timesheet → Select BCBA Insurance
4. ✅ Test archive controls:
   - Select timesheets → Move to archive
   - Go to archive → Select → Move out of archive
   - Select in archive → Generate invoice
5. ✅ Verify BCBA invoices use BCBA Insurance rates

## 📝 Notes

- Regular Insurance and timesheets remain unchanged
- Admins have full access to BCBA Insurance by default
- Migration includes all necessary indexes for performance
