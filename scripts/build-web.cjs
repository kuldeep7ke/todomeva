const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

const entries = ['index.html', 'css', 'js', 'assets', 'vendor'];

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(www, { recursive: true });
for (const entry of entries) {
  const src = path.join(root, entry);
  const dst = path.join(www, entry);
  if (!fs.existsSync(src)) {
    console.error(`Missing web asset: ${entry}`);
    process.exit(1);
  }
  fs.cpSync(src, dst, { recursive: true });
}

console.log(`Staged www/ from: ${entries.join(', ')}`);