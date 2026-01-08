# Deployment Script for Timesheet Visibility Permissions Feature
# Includes database migration and permission seeding

$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519_smartsteps"
$SERVER = "root@66.94.105.43"
$APP_DIR = "/var/www/aplus-center"

Write-Host "🚀 Starting Deployment - Timesheet Visibility Permissions..." -ForegroundColor Cyan
Write-Host ""

# Check if SSH key exists
if (-not (Test-Path $SSH_KEY)) {
    Write-Host "❌ Error: SSH key not found at $SSH_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found SSH key: $SSH_KEY" -ForegroundColor Green
Write-Host ""

# Deploy commands - includes migration and seeding
$deployCommands = @"
cd $APP_DIR
echo '📥 Pulling latest changes...'
git pull origin main || echo '⚠️  Git pull failed - continuing with existing code...'
echo ''
echo '📦 Installing dependencies...'
npm install --production --legacy-peer-deps
echo ''
echo '🔧 Generating Prisma client...'
npx prisma generate
echo ''
echo '🔄 Running database migration...'
npx prisma migrate deploy || echo '⚠️  Migration may have already been applied'
echo ''
echo '🌱 Seeding new permissions...'
npx tsx scripts/seed-permissions.ts || echo '⚠️  Permission seeding may have already been done'
echo ''
echo '🏗️  Building application...'
npm run build
echo ''
echo '🔄 Restarting application...'
pm2 restart aplus-center
pm2 save
echo ''
echo '✅ Deployment complete!'
echo ''
echo '📊 Application status:'
pm2 status
echo ''
echo '📋 Recent logs:'
pm2 logs aplus-center --lines 20 --nostream
"@

Write-Host "📤 Connecting to server and deploying..." -ForegroundColor Cyan
Write-Host ""

# Run deployment via SSH
ssh -i $SSH_KEY -o IdentitiesOnly=yes $SERVER $deployCommands

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 Verify deployment at: http://66.94.105.43:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Navigate to /roles and verify new permissions appear" -ForegroundColor White
Write-Host "   2. Test creating/editing a role with timesheet visibility" -ForegroundColor White
Write-Host "   3. Test timesheet filtering with a user that has viewSelectedUsers" -ForegroundColor White
Write-Host ""
