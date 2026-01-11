#!/bin/bash
# Quick Fix for ERR_EMPTY_RESPONSE - Run this on server: 66.94.105.43
# Copy and paste this entire script into your server terminal

set -e

echo "🔧 Fixing prerender-manifest.json issue..."
echo ""

APP_DIR="/var/www/aplus-center"
cd "$APP_DIR" || { echo "❌ Cannot find $APP_DIR"; exit 1; }

echo "📁 Current directory: $(pwd)"
echo ""

# Ensure .next directory exists
if [ ! -d ".next" ]; then
    echo "⚠️  .next directory not found. Creating it..."
    mkdir -p .next
fi

# Create prerender-manifest.json
MANIFEST_PATH=".next/prerender-manifest.json"
echo "📝 Creating prerender-manifest.json..."

cat > "$MANIFEST_PATH" << 'EOF'
{
  "version": 4,
  "routes": {},
  "dynamicRoutes": {},
  "notFoundRoutes": [],
  "preview": {
    "previewModeId": "",
    "previewModeSigningKey": "",
    "previewModeEncryptionKey": ""
  }
}
EOF

echo "✅ prerender-manifest.json created"
echo ""

# Verify file was created
if [ -f "$MANIFEST_PATH" ]; then
    echo "✅ File verified: $MANIFEST_PATH"
    ls -lh "$MANIFEST_PATH"
else
    echo "❌ File creation failed!"
    exit 1
fi

echo ""
echo "🔄 Restarting PM2..."

# Restart PM2
if command -v pm2 &> /dev/null; then
    pm2 restart aplus-center || pm2 restart all
    echo "✅ PM2 restarted"
    echo ""
    echo "📊 PM2 Status:"
    pm2 status
    echo ""
    echo "📋 Recent logs:"
    pm2 logs aplus-center --lines 10 --nostream || echo "⚠️  Could not fetch logs"
else
    echo "⚠️  PM2 not found. Please restart manually."
fi

echo ""
echo "✅ Fix complete!"
echo ""
echo "🌐 Test the server: http://66.94.105.43:3000"
echo "📋 Check logs: pm2 logs aplus-center --lines 50"
