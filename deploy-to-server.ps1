# Smart Steps Migration - Automated Deployment Script
# This script helps deploy the migration to the server

param(
    [string]$Server = "root@66.94.105.43",
    [string]$AppDir = "/var/www/aplus-center"
)

Write-Host "🚀 Smart Steps Migration Deployment" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Copy server script to server
Write-Host "📤 Step 1: Uploading migration script to server..." -ForegroundColor Yellow
$serverScript = "deploy-migration-server.sh"
if (Test-Path $serverScript) {
    Write-Host "   Copying $serverScript to server..." -ForegroundColor Gray
    scp $serverScript "${Server}:/tmp/$serverScript"
    Write-Host "   ✅ Script uploaded" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Script not found, will use inline commands" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Step 2: Ready to execute on server" -ForegroundColor Yellow
Write-Host ""
Write-Host "Choose an option:" -ForegroundColor Cyan
Write-Host "  1. Execute migration automatically via SSH" -ForegroundColor White
Write-Host "  2. Show commands to run manually" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Enter choice (1 or 2)"

if ($choice -eq "1") {
    Write-Host ""
    Write-Host "🔄 Executing migration on server..." -ForegroundColor Yellow
    Write-Host ""
    
    if (Test-Path $serverScript) {
        $commands = @"
cd $AppDir
bash /tmp/$serverScript
"@
        ssh $Server $commands
    } else {
        $commands = @"
cd $AppDir && npx prisma generate && (npx prisma migrate deploy --name add_role_dashboard_visibility || npx prisma db push) && pm2 restart aplus-center && pm2 logs aplus-center --lines 10
"@
        ssh $Server $commands
    }
    
    Write-Host ""
    Write-Host "✅ Migration complete!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "📝 Manual Commands:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "SSH into server:" -ForegroundColor Yellow
    Write-Host "  ssh $Server" -ForegroundColor White
    Write-Host ""
    Write-Host "Then run:" -ForegroundColor Yellow
    if (Test-Path $serverScript) {
        Write-Host "  bash /tmp/$serverScript" -ForegroundColor White
    } else {
        Write-Host "  cd $AppDir" -ForegroundColor White
        Write-Host "  npx prisma generate" -ForegroundColor White
        Write-Host "  npx prisma migrate deploy --name add_role_dashboard_visibility || npx prisma db push" -ForegroundColor White
        Write-Host "  pm2 restart aplus-center" -ForegroundColor White
        Write-Host "  pm2 logs aplus-center --lines 20" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "✅ Deployment instructions ready!" -ForegroundColor Green
Write-Host ""
Write-Host "📚 For detailed instructions, see: DEPLOY_EVERYTHING.md" -ForegroundColor Cyan
