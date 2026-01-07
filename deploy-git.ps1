# Git-based Deployment Script for Timesheet Fix
# Uses SSH with specific key and git pull

$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519_smartsteps"
$SERVER = "root@66.94.105.43"
$APP_DIR = "/var/www/aplus-center"

Write-Host "🚀 Starting Git-based Deployment..." -ForegroundColor Cyan
Write-Host ""

# Check if SSH key exists
if (-not (Test-Path $SSH_KEY)) {
    Write-Host "❌ Error: SSH key not found at $SSH_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Found SSH key: $SSH_KEY" -ForegroundColor Green
Write-Host ""

# Deploy commands
$deployCommands = @"
cd $APP_DIR
echo '📥 Pulling latest changes...'
git pull
echo '📦 Installing dependencies...'
npm install --production --legacy-peer-deps
echo '🔧 Generating Prisma client...'
npx prisma generate
echo '🏗️  Building application...'
npm run build
echo '🔄 Restarting application...'
pm2 restart aplus-center
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
