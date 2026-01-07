# A Plus Center Deployment Script for Windows
# This script uploads the deployment package to the server

$SERVER = "root@66.94.105.43"
$ZIP_FILE = "aplus-center-deploy.zip"
$REMOTE_PATH = "/tmp/"

Write-Host "🚀 Starting A Plus Center Deployment..." -ForegroundColor Cyan
Write-Host ""

# Check if zip file exists
if (-not (Test-Path $ZIP_FILE)) {
    Write-Host "❌ Error: $ZIP_FILE not found!" -ForegroundColor Red
    Write-Host "Please ensure the deployment package exists." -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Found deployment package: $ZIP_FILE" -ForegroundColor Green
Write-Host ""

# Upload to server
Write-Host "📤 Uploading $ZIP_FILE to server..." -ForegroundColor Cyan
try {
    scp $ZIP_FILE "${SERVER}:${REMOTE_PATH}"
    Write-Host "✅ Upload successful!" -ForegroundColor Green
} catch {
    Write-Host "❌ Upload failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ Upload Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. SSH into the server:" -ForegroundColor White
Write-Host "   ssh root@66.94.105.43" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Run these commands on the server:" -ForegroundColor White
Write-Host ""
Write-Host "   cd /var/www/aplus-center" -ForegroundColor Gray
Write-Host "   unzip -o /tmp/aplus-center-deploy.zip" -ForegroundColor Gray
Write-Host "   npm install --production --legacy-peer-deps" -ForegroundColor Gray
Write-Host "   npx prisma generate" -ForegroundColor Gray
Write-Host "   npx prisma db push" -ForegroundColor Gray
Write-Host "   npm run build" -ForegroundColor Gray
Write-Host "   pm2 restart aplus-center || pm2 start deploy/pm2.config.js" -ForegroundColor Gray
Write-Host "   pm2 save" -ForegroundColor Gray
Write-Host "   pm2 logs aplus-center --lines 20" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Verify deployment:" -ForegroundColor White
Write-Host "   curl http://localhost:3000" -ForegroundColor Gray
Write-Host "   pm2 status" -ForegroundColor Gray
Write-Host ""
Write-Host "🌐 Then open in browser: http://66.94.105.43:3000" -ForegroundColor Cyan
Write-Host ""
