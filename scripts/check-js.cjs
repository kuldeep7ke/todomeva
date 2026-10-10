const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const jsDir = path.join(__dirname, '..', 'js');
const files = fs.readdirSync(jsDir).filter((f) => f.endsWith('.js')).sort();

if (files.length === 0) {
  console.error(`No JS files found in ${jsDir}`);
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const check = spawnSync(process.execPath, ['--check', path.join(jsDir, file)], { stdio: 'inherit' });
  if (check.status !== 0) {
    console.error(`Syntax error: js/${file}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`${failed} of ${files.length} files failed node --check`);
  process.exit(1);
}
console.log(`node --check passed for ${files.length} files in js/`);
