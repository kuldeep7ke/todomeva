#!/usr/bin/env node
// Todo Meva announcements publish tool (jsonbin.io v3) — single combined bin.
//
// The app reads ONE bin that holds BOTH the broadcast toasts and the promo
// banner (News Meva pattern, see docs/ANNOUNCEMENTS-EDGE-PROXY-GUIDE.md):
//   { broadcasts: [...], banner: {...} }
//
// Usage:
//   node scripts/broadcast-tool.cjs setup    create ONE bin ('Announcements for
//                                            ToDo Meva') from scripts/content/announcements.json,
//                                            then write the id into js/broadcast.js AND into the
//                                            FALLBACK_BIN_ID of functions/api/announcements.js
//   node scripts/broadcast-tool.cjs bake     write bin id from BAKED_BIN_ID env into
//                                            js/broadcast.js + functions/api/announcements.js
//                                            (no key needed — for bins created in the dashboard)
//   node scripts/broadcast-tool.cjs publish  push current scripts/content/announcements.json
//                                            into the existing bin (id read from js/broadcast.js)
//   node scripts/broadcast-tool.cjs help
//
// Env required:  JSONBIN_MASTER_KEY   (your jsonbin.io API key)
// Optional env:  BAKED_BIN_ID         (override for publish)
//
// The bin is created with X-Bin-Private=false so site visitors can read it
// without any key. The client bin id is written into js/broadcast.js
// XOR+base64-obfuscated (same scheme as Money Meva) so it never appears as
// plain text in the deployed bundle, while the Cloudflare proxy fallback id is
// written in plain text into functions/api/announcements.js so the edge
// function works with no environment variables.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BROADCAST_JS = path.join(ROOT, 'js', 'broadcast.js');
const FUNCTIONS_API = path.join(ROOT, 'functions', 'api', 'announcements.js');
const CONTENT_DIR = path.join(__dirname, 'content');
const ANNOUNCEMENTS_FILE = path.join(CONTENT_DIR, 'announcements.json');
const API = 'https://api.jsonbin.io/v3/b';
const OBFUSCATE_KEY = 'todomeva';

function obfuscateId(plain) {
  let out = '';
  for (let i = 0; i < plain.length; i++) out += String.fromCharCode(plain.charCodeAt(i) ^ OBFUSCATE_KEY.charCodeAt(i % OBFUSCATE_KEY.length));
  return Buffer.from(out, 'binary').toString('base64');
}

function deobfuscateId(obf) {
  const bin = Buffer.from(obf, 'base64').toString('binary');
  let out = '';
  for (let i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ OBFUSCATE_KEY.charCodeAt(i % OBFUSCATE_KEY.length));
  return out;
}

function masterKey() {
  const key = process.env.JSONBIN_MASTER_KEY;
  if (!key) {
    console.error('Set the JSONBIN_MASTER_KEY environment variable (jsonbin.io API key).');
    process.exit(1);
  }
  return key;
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function readBinId() {
  const fromEnv = (process.env.BAKED_BIN_ID || '').trim();
  if (fromEnv) return fromEnv;
  const src = readText(BROADCAST_JS);
  const match = src.match(/const BAKED_BIN_ID\s*=\s*_d\('([^']*)'\)/);
  return match && match[1] ? deobfuscateId(match[1]).trim() : '';
}

function readContent() {
  return JSON.parse(fs.readFileSync(ANNOUNCEMENTS_FILE, 'utf8'));
}

async function createBin(name, content) {
  const headers = {
    'X-Master-Key': masterKey(),
    'Content-Type': 'application/json',
    'X-Bin-Name': name,
    'X-Bin-Private': 'false',
  };
  const res = await fetch(API, { method: 'POST', headers, body: JSON.stringify(content) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`create "${name}" failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  const id = (json.metadata && json.metadata.id) || (json.record && json.record.id) || json.id;
  if (!id) throw new Error(`create "${name}": no bin id in response: ${JSON.stringify(json)}`);
  return id;
}

async function updateBin(id, content) {
  if (!id) throw new Error('Bin id is empty. Run setup first (or set BAKED_BIN_ID).');
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: {
      'X-Master-Key': masterKey(),
      'Content-Type': 'application/json',
      'X-Bin-Updated': Date.now().toString(),
    },
    body: JSON.stringify(content),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`update "${id}" failed (${res.status}): ${body}`);
  }
  return res.json();
}

// Writes the bin id into BOTH:
//   js/broadcast.js             -> BAKED_BIN_ID (XOR+base64 obfuscated)
//   functions/api/announcements.js -> FALLBACK_BIN_ID (plain, so the edge
//                                      function works without env vars)
function writeBinId(id) {
  const jsSrc = readText(BROADCAST_JS);
  const jsNext = jsSrc.replace(/(const BAKED_BIN_ID\s*=\s*_d\()'[^']*'\)/, `$1'${obfuscateId(id)}')`);
  if (jsNext === jsSrc) throw new Error('Could not write bin id into js/broadcast.js (BAKED_BIN_ID marker not found).');

  const fnSrc = readText(FUNCTIONS_API);
  const fnNext = fnSrc.replace(/const FALLBACK_BIN_ID = '[^']*';/, `const FALLBACK_BIN_ID = '${id}';`);
  if (fnNext === fnSrc) throw new Error('Could not write fallback bin id into functions/api/announcements.js (FALLBACK_BIN_ID marker not found).');

  fs.writeFileSync(BROADCAST_JS, jsNext);
  fs.writeFileSync(FUNCTIONS_API, fnNext);
}

async function setup() {
  const content = readContent();
  console.log('Creating one combined bin on jsonbin.io (public reads, no-key needed for visitors)...');
  const id = await createBin('Announcements for ToDo Meva', content);
  writeBinId(id);
  console.log('Done.');
  console.log('  bin id:', id);
  console.log('Wrote the id into js/broadcast.js (XOR+base64 obfuscated) and functions/api/announcements.js (FALLBACK_BIN_ID).');
  console.log('\nTest read (no auth):');
  console.log('  curl ' + `https://api.jsonbin.io/v3/b/${id}/latest`);
}

async function publish() {
  const id = readBinId();
  if (!id) {
    console.error('No bin id found. Run setup first or set BAKED_BIN_ID env.');
    process.exit(1);
  }
  await updateBin(id, readContent());
  console.log(`Updated combined bin (${id}).`);
  console.log('Publish complete — visitors see changes within the 60s poll. Banner shows on next fresh load.');
}

async function bake() {
  const id = (process.env.BAKED_BIN_ID || '').trim();
  if (!id) {
    console.error('Set the BAKED_BIN_ID env var (the bin id from your jsonbin dashboard).');
    process.exit(1);
  }
  writeBinId(id);
  console.log(`Wrote bin id ${id} into js/broadcast.js (obfuscated) and functions/api/announcements.js (FALLBACK_BIN_ID).`);
}

async function main() {
  const cmd = process.argv[2] || 'help';
  if (cmd === 'setup') await setup();
  else if (cmd === 'bake') await bake();
  else if (cmd === 'publish') await publish();
  else {
    console.log('Todo Meva announcements publish tool (single combined bin)');
    console.log('  setup   — create the combined jsonbin bin from scripts/content/announcements.json, write id into js/broadcast.js + functions/api/announcements.js');
    console.log('  bake    — write bin id from BAKED_BIN_ID env into both files (no key, for dashboard-created bins)');
    console.log('  publish — update the existing bin with current scripts/content/announcements.json');
    console.log('  help    — show this help');
    console.log('\nEnv: JSONBIN_MASTER_KEY required for setup/publish. Publish can override the id via BAKED_BIN_ID.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});