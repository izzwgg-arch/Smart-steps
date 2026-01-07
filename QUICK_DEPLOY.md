# Quick Deploy - Smart Steps Migration

## 🚀 One-Line Deployment (Easiest)

**Copy and paste this entire command:**

```bash
ssh root@66.94.105.43 "cd /var/www/aplus-center && npx prisma generate && (npx prisma migrate deploy --name add_role_dashboard_visibility || npx prisma db push) && pm2 restart aplus-center && pm2 logs aplus-center --lines 10"
```

This will:
1. ✅ Generate Prisma Client
2. ✅ Apply database migration
3. ✅ Restart the application
4. ✅ Show recent logs

## 📋 Alternative: Step-by-Step

**1. SSH into server:**
```bash
ssh root@66.94.105.43
```

**2. Navigate to app:**
```bash
cd /var/www/aplus-center
```

**3. Generate Prisma Client:**
```bash
npx prisma generate
```

**4. Apply migration:**
```bash
npx prisma migrate deploy --name add_role_dashboard_visibility
```

**If that fails, use:**
```bash
npx prisma db push
```

**5. Restart app:**
```bash
pm2 restart aplus-center
```

**6. Check status:**
```bash
pm2 status
pm2 logs aplus-center --lines 20
```

## ✅ Verification

After deployment, verify it worked:

```bash
# Check if table exists
sudo -u postgres psql -d apluscenter -c "\d \"RoleDashboardVisibility\""

# Check app is running
curl http://localhost:3000

# Check PM2
pm2 status
```

## 🎉 Done!

Your Smart Steps updates are now live:
- ✅ Application renamed to "Smart Steps"
- ✅ Dashboard layout reordered (Quick Access on top)
- ✅ Header simplified (Home, Notifications, Sign Out only)
- ✅ Role-based dashboard visibility enabled
- ✅ Route protection active
- ✅ Custom roles with dashboard visibility controls

## 📚 More Details

See `DEPLOY_EVERYTHING.md` for:
- Troubleshooting guide
- Rollback instructions
- Post-deployment checklist
