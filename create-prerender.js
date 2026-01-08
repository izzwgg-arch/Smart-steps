const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '.next', 'prerender-manifest.json');

// Create the manifest if it doesn't exist
if (!fs.existsSync(manifestPath)) {
  const manifest = {
    version: 3,
    routes: {},
    dynamicRoutes: {},
    notFoundRoutes: [],
    preview: {
      previewModeId: '',
      previewModeSigningKey: '',
      previewModeEncryptionKey: ''
    }
  };

  // Ensure .next directory exists
  const nextDir = path.join(__dirname, '.next');
  if (!fs.existsSync(nextDir)) {
    fs.mkdirSync(nextDir, { recursive: true });
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('✅ Created prerender-manifest.json');
} else {
  console.log('✅ prerender-manifest.json already exists');
}
