#!/bin/bash

# Quick fix for ERR_EMPTY_RESPONSE - Prerender Manifest Issue
# Run this on the server: 66.94.105.43

set -e

echo "🔧 Fixing prerender-manifest.json issue..."

APP_DIR="/var/www/aplus-center"
cd "$APP_DIR"

# Check if .next directory exists
if [ ! -d ".next" ]; then
    echo "❌ .next directory not found. Running build..."
    npm run build
    exit 0
fi

# Create prerender-manifest.json if missing
NEXT_DIR=".next"
MANIFEST_PATH="$NEXT_DIR/prerender-manifest.json"

if [ ! -f "$MANIFEST_PATH" ]; then
    echo "📝 Creating missing prerender-manifest.json..."
    
    # Create the manifest content
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
else
    echo "✅ prerender-manifest.json already exists"
    
    # Validate JSON
    if ! python3 -m json.tool "$MANIFEST_PATH" > /dev/null 2>&1; then
        echo "⚠️  Manifest file is corrupted, recreating..."
        rm "$MANIFEST_PATH"
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
        echo "✅ Manifest file recreated"
    fi
fi

# Restart PM2
echo "🔄 Restarting PM2..."
pm2 restart aplus-center

echo ""
echo "✅ Fix applied! The server should be working now."
echo "📋 Check logs: pm2 logs aplus-center --lines 20"
