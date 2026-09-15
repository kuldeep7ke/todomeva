#!/usr/bin/env node
// Todo Meva broadcast + banner publish tool (jsonbin.io v3).
//
// Usage:
//   node scripts/broadcast-tool.cjs setup    create both bins from scripts/content/*.json,
//                                            then write the bin ids into js/broadcast.js
//   node scripts/broadcast-tool.cjs bake     write bin ids from BAKED_BROADCAST_BIN_ID /
//                                            BAKED_BANNER_BIN_ID env into js/broadcast.js
//                                            (no key needed — for bins created in the dashboard)
//   node scripts/broadcast-tool.cjs publish   push current scripts/content/*.json into the
//                                            existing bins (ids read from js/broadcast.js)
//   node scripts/broadcast-tool.cjs help
//
// Env required:  JSONBIN_MASTER_KEY   (your jsonbin.io API key)
// Optional env:  BAKED_BROADCAST_BIN_ID / BAKED_BANNER_BIN_ID  (override for publish)
//
// Bins are created with X-Bin-Private=false so site visitors can read them
// without any key. They are "publicly readable" like the Money Meva setup.
// Bin ids are written into js/broadcast.js XOR+base64-obfuscated (same scheme
// as Money Meva) so they never appear as plain text in the deployed bundle.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BROADCAST_JS = path.join(ROOT, 'js', 'broadcast.js');
const CONTENT_DIR = path.join(__dirname, 'content');
const BROADCAST_FILE = path.join(CONTENT_DIR, 'broadcast.json');
const BANNER_FILE = path.join(CONTENT_DIR, 'banner.json');
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

function readBroadcastJs() {
  return fs.readFileSync(BROADCAST_JS, 'utf8');
}

function readBinId(name) {
  const src = readBroadcastJs();
  const match = src.match(new RegExp(`const ${name}\\s*=\\s*_d\\('([^']*)'\\)`));
  const fromEnv = process.env[name];
  if (fromEnv) return fromEnv.trim();
  return (match && match[1] ? deobfuscateId(match[1]) : '').trim();
}

function readContent(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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
  if (!id) throw new Error('Bin id is empty. Run setup first (or set the env override).');
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

function writeBinIds(broadcastId, bannerId) {
  const src = readBroadcastJs();
  const next = src
    .replace(/(const BAKED_BROADCAST_BIN_ID\s*=\s*_d\()'[^']*'\)/, `$1'${obfuscateId(broadcastId)}')`)
    .replace(/(const BAKED_BANNER_BIN_ID\s*=\s*_d\()'[^']*'\)/, `$1'${obfuscateId(bannerId)}')`);
  if (next === src) throw new Error('Could not write bin ids into js/broadcast.js (markers not found).');
  fs.writeFileSync(BROADCAST_JS, next);
}

async function setup() {
  const broadcast = readContent(BROADCAST_FILE);
  const banner = readContent(BANNER_FILE);
  console.log('Creating bins on jsonbin.io (public reads, no-key needed for visitors)...');
  const broadcastId = await createBin('todo-meva-broadcast', broadcast);
  const bannerId = await createBin('todo-meva-banner', banner);
  writeBinIds(broadcastId, bannerId);
  console.log('Done.');
  console.log('  broadcast bin id:', broadcastId);
  console.log('  banner bin id:   ', bannerId);
  console.log('Wrote both ids (XOR+base64 obfuscated) into js/broadcast.js.');
  console.log('\nTest read (no auth):');
  console.log('  curl ' + `https://api.jsonbin.io/v3/b/${broadcastId}/latest`);
}

async function publish() {
  const broadcastId = readBinId('BAKED_BROADCAST_BIN_ID');
  const bannerId = readBinId('BAKED_BANNER_BIN_ID');
  if (!broadcastId && !bannerId) {
    console.error('No bin ids found. Run setup first or set BAKED_BROADCAST_BIN_ID / BAKED_BANNER_BIN_ID env.');
    process.exit(1);
  }
  const tasks = [];
  if (broadcastId) tasks.push(['broadcast', broadcastId, readContent(BROADCAST_FILE)]);
  if (bannerId) tasks.push(['banner', bannerId, readContent(BANNER_FILE)]);
  for (const [label, id, content] of tasks) {
    await updateBin(id, content);
    console.log(`Updated ${label} (${id}).`);
  }
  console.log('Publish complete — visitors see changes within the 60s poll. Banner shows on next fresh load.');
}

async function bake() {
  const broadcastId = (process.env.BAKED_BROADCAST_BIN_ID || '').trim();
  const bannerId = (process.env.BAKED_BANNER_BIN_ID || '').trim();
  if (!broadcastId || !bannerId) {
    console.error('Set both BAKED_BROADCAST_BIN_ID and BAKED_BANNER_BIN_ID env vars (the bin ids from your jsonbin dashboard).');
    process.exit(1);
  }
  writeBinIds(broadcastId, bannerId);
  console.log('Wrote both bin ids into js/broadcast.js (XOR+base64 obfuscated).');
  console.log('  broadcast bin id:', broadcastId);
  console.log('  banner bin id:   ', bannerId);
}

async function main() {
  const cmd = process.argv[2] || 'help';
  if (cmd === 'setup') await setup();
  else if (cmd === 'bake') await bake();
  else if (cmd === 'publish') await publish();
  else {
    console.log('Todo Meva broadcast/banner publish tool');
    console.log('  setup   — create both jsonbin bins from scripts/content/*.json, write ids into js/broadcast.js');
    console.log('  bake    — write bin ids from BAKED_*_BIN_ID env into js/broadcast.js (no key, for dashboard-created bins)');
    console.log('  publish — update the existing bins with current scripts/content/*.json');
    console.log('  help    — show this help');
    console.log('\nEnv: JSONBIN_MASTER_KEY required for setup/publish. Bake/publish can override ids via BAKED_BROADCAST_BIN_ID / BAKED_BANNER_BIN_ID.');
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});