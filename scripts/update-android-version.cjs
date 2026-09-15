const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', 'VERSION');
const gradleFile = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

const current = fs.readFileSync(versionFile, 'utf-8').trim();
const match = current.match(/^v?(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$/);

if (!match) {
  console.error('Invalid version format:', current);
  process.exit(1);
}

const major = Number(match[1]);
const minor = Number(match[2]);
const patch = Number(match[3]);
const build = Number(match[4] || 0);

const versionCode =
  major * 100_000_000 + minor * 1_000_000 + patch * 10_000 + build;
const versionName = `${major}.${minor}.${patch}.${build}`;

let gradle = fs.readFileSync(gradleFile, 'utf-8');
gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`);
gradle = gradle.replace(/versionName "[^"]+"/, `versionName "${versionName}"`);
fs.writeFileSync(gradleFile, gradle);

console.log(`Android: versionCode → ${versionCode}, versionName → "${versionName}" (from ${current})`);