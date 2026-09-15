const fs = require('fs');
const path = require('path');
const type = process.argv[2] || 'patch';

const versionFile = path.join(__dirname, '..', 'VERSION');
let current = fs.readFileSync(versionFile, 'utf-8').trim();
const match = current.match(/^v?(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/);

if (!match) {
  console.error('Invalid version format:', current);
  process.exit(1);
}

let major = Number(match[1]);
let minor = Number(match[2]);
let patch = Number(match[3]);
let build = Number(match[4] || 0);

if (type === 'major') { major++; minor = 0; patch = 0; build = 0; }
else if (type === 'minor') { minor++; patch = 0; build = 0; }
else { build++; }

const next = `v${major}.${minor}.${patch}.${build}`;
fs.writeFileSync(versionFile, `${next}\n`, 'utf-8');
console.log(`Bumped: ${current} → ${next}`);