const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const logo = path.join(__dirname, '..', 'src', 'assets', 'logo-homens-de-fe.png');

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
if (fs.existsSync(logo)) {
  fs.copyFileSync(logo, path.join(publicDir, 'pwa-192.png'));
  fs.copyFileSync(logo, path.join(publicDir, 'pwa-512.png'));
  console.log('PWA icons copied from logo.');
}
