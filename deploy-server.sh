#!/bin/bash
# Server-side deployment script
# This script is meant to be run on the server after uploading the zip file

set -e

echo "🚀 Starting A Plus Center deployment on server..."
echo ""

# Navigate to app directory (create if doesn't exist)
APP_DIR="/var/www/aplus-center"
mkdir -p $APP_DIR
mkdir -p /var/log/aplus-center
cd $APP_DIR

# Backup current .next if exists
if [ -d ".next" ]; then
    echo "📦 Backing up existing build..."
    mv .next .next.backup.$(date +%Y%m%d_%H%M%S)
fi

# Extract new version
echo "📦 Extracting deployment package..."
unzip -o /tmp/aplus-center-deploy.zip

# Install dependencies
echo "📥 Installing dependencies..."
npm install --production --legacy-peer-deps

# Generate Prisma Client
echo "🔨 Generating Prisma client..."
npx prisma generate

# Push database schema
echo "🔄 Updating database schema..."
npx prisma db push

# Build application
echo "🏗️  Building application..."
npm run build

# Restart or start PM2
echo "🔄 Managing PM2 process..."
if pm2 list | grep -q "aplus-center"; then
    echo "Restarting existing PM2 process..."
    pm2 restart aplus-center
else
    echo "Starting new PM2 process..."
    pm2 start deploy/pm2.config.js
    pm2 save
fi

# Show status
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Deployment complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
pm2 status
echo ""
echo "📋 Recent logs:"
pm2 logs aplus-center --lines 20 --nostream
echo ""
echo "🌐 Application should be available at: http://66.94.105.43:3000"
echo ""
