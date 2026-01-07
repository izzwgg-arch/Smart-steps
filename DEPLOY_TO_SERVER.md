# Deploy Timesheet Fix to Server

## ✅ Code Pushed to GitHub

Repository: https://github.com/izzwgg-arch/Smart-steps.git  
Branch: `main`  
Status: ✅ Pushed successfully

## 🚀 Deploy to Server

### Step 1: SSH into Server

```bash
ssh -i ~/.ssh/id_ed25519_smartsteps -o IdentitiesOnly=yes root@66.94.105.43
```

### Step 2: Deploy Commands

Run these commands on the server:

```bash
cd /var/www/aplus-center

# If this is the first time, clone the repository:
# git clone https://github.com/izzwgg-arch/Smart-steps.git .

# Otherwise, pull latest changes:
git pull origin main

# Install/update dependencies
npm install --production --legacy-peer-deps

# Generate Prisma client (important!)
npx prisma generate

# Build the application
npm run build

# Restart the application
pm2 restart aplus-center

# Check status
pm2 status

# View recent logs
pm2 logs aplus-center --lines 20
```

## 📋 One-Line Deployment Command

You can also run this single command from your local machine:

```powershell
ssh -i $env:USERPROFILE\.ssh\id_ed25519_smartsteps -o IdentitiesOnly=yes root@66.94.105.43 "cd /var/www/aplus-center && git pull origin main && npm install --production --legacy-peer-deps && npx prisma generate && npm run build && pm2 restart aplus-center && pm2 status"
```

## ✅ What's Being Deployed

### New Files
- `lib/timeParts.ts` - Time conversion utilities
- `components/timesheets/TimePartsInput.tsx` - New time input component
- `lib/__tests__/timeParts.test.ts` - Unit tests

### Modified Files
- `components/timesheets/TimesheetForm.tsx` - Complete refactor
- `components/timesheets/TimeInput.tsx` - Marked as deprecated

### Key Features
- ✅ Dropdown-based time input (no more typing bugs)
- ✅ "Apply Default Times to Dates" button
- ✅ "Reset row to default" functionality
- ✅ No race conditions
- ✅ No NaN values
- ✅ Better state management

## 🔍 Post-Deployment Verification

1. Navigate to `/timesheets/new` in browser
2. Verify new time input component (dropdowns for hour/minute/AM-PM)
3. Test setting default times
4. Test "Apply Default Times to Dates" button
5. Test manual override and "Reset" button
6. Check debug panel (dev mode) shows no NaN values

## 🐛 Troubleshooting

### If git pull fails:
```bash
# Check if directory is a git repo
cd /var/www/aplus-center
git status

# If not, clone fresh:
cd /var/www
rm -rf aplus-center
git clone https://github.com/izzwgg-arch/Smart-steps.git aplus-center
cd aplus-center
```

### If build fails:
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install --production --legacy-peer-deps
npx prisma generate
npm run build
```

### If app won't start:
```bash
# Check logs
pm2 logs aplus-center --lines 50

# Check environment
cat .env | grep DATABASE_URL

# Restart
pm2 restart aplus-center
pm2 save
```

---

**Ready to deploy!** Run the deployment commands above.
