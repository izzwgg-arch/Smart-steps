#!/bin/bash

# Deploy A Plus Center to server
# Usage: ./scripts/deploy-to-server.sh

set -e

SERVER="root@66.94.105.43"
APP_DIR="/var/www/aplus-center"
REMOTE_USER="root"

echo "🚀 Deploying A Plus Center to server..."

# Build locally first
echo "📦 Building application..."
npm run build

# Create deployment archive
echo "📦 Creating deployment archive..."
tar -czf /tmp/aplus-center-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='*.log' \
  .

# Copy to server
echo "📤 Copying files to server..."
scp /tmp/aplus-center-deploy.tar.gz $SERVER:/tmp/

# Run deployment on server
echo "🔧 Running deployment on server..."
ssh $SERVER << 'ENDSSH'
set -e
APP_DIR="/var/www/aplus-center"
mkdir -p $APP_DIR

echo "📦 Extracting files..."
cd $APP_DIR
tar -xzf /tmp/aplus-center-deploy.tar.gz
rm /tmp/aplus-center-deploy.tar.gz

echo "📥 Installing dependencies..."
npm install --production

echo "🔨 Generating Prisma client..."
npx prisma generate

echo "🔄 Running database migrations..."
npx prisma migrate deploy || echo "⚠️  Migration failed - may need manual intervention"

echo "✅ Deployment complete!"
echo "📝 Don't forget to:"
echo "   1. Update .env file with production credentials"
echo "   2. Restart PM2: pm2 restart aplus-center"
echo "   3. Check logs: pm2 logs aplus-center"
ENDSSH

echo "✅ Deployment script complete!"
echo "📝 Next steps on server:"
echo "   1. cd $APP_DIR"
echo "   2. Update .env file"
echo "   3. pm2 restart aplus-center"
