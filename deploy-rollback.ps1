$SSH_KEY = "$env:USERPROFILE\.ssh\id_ed25519_smartsteps"
$SERVER = "root@66.94.105.43"
$APP_DIR = "/var/www/aplus-center"
$COMMIT = "c77cc56"

Write-Host "Starting rollback deployment to commit $COMMIT..." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $SSH_KEY)) {
    Write-Host "ERROR: SSH key not found at $SSH_KEY" -ForegroundColor Red
    exit 1
}

Write-Host "Found SSH key: $SSH_KEY" -ForegroundColor Green
Write-Host ""

$deployCommands = @"
cd $APP_DIR
echo 'Fetching latest refs...'
git fetch --all
echo 'Checking out commit $COMMIT...'
git checkout $COMMIT
echo 'Installing dependencies...'
npm install --production --legacy-peer-deps
echo 'Generating Prisma client...'
npx prisma generate
echo 'Building application...'
npm run build
echo 'Restarting application...'
pm2 restart aplus-center
echo 'Rollback deployment complete!'
echo ''
echo 'Application status:'
pm2 status
echo ''
echo 'Recent logs:'
pm2 logs aplus-center --lines 20 --nostream
"@

Write-Host "Connecting to server and deploying rollback..." -ForegroundColor Cyan
Write-Host ""

ssh -i $SSH_KEY -o IdentitiesOnly=yes $SERVER $deployCommands

Write-Host ""
Write-Host "Rollback Deployment Complete!" -ForegroundColor Green
Write-Host "Verify deployment at: http://66.94.105.43:3000" -ForegroundColor Cyan
