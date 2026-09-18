import { t } from './i18n.js?v=15';

// Live broadcast toasts + promo banner, delivered from jsonbin.io bins.
// Any authorized third-party site can edit the bins on jsonbin.io and the
// message shows here within the poll interval — no app update needed.
//
// Fetch path (quota protection, mirrors Money Meva — see
// docs/ANNOUNCEMENTS-EDGE-PROXY-GUIDE.md):
//   app -> https://todomeva.pages.dev/api/announcements?type=broadcast|banner
//   (Cloudflare Pages Function, edge-cached) -> jsonbin. The proxy URL is its
//   own constant, deliberately NOT derived from location.origin — one canonical
//   URL serves CF Pages, GitHub Pages and the APK (via CORS `*`). Direct
//   jsonbin URLs below stay as an automatic fallback if the proxy is down.
//
// Records:
//   broadcast: { id, title?, message, type?('info'|'warning'|'success'|'error'),
//                pinned?, expires?, link?, targetId? }
//   banner:    { id, title?, content, image?, href?, width?(px), startDate?,
//                expires?, targetId? }
// Optional targeting: set "targetId" on a record to this device's ID (shown in
// Settings → Broadcasts) to show it only on that device. No targetId = everyone.
//
// Dev/testing overrides (localStorage, no rebuild needed):
//   todoMeva_announcementsApi  announcements proxy endpoint if not todomeva.pages.dev
//   todoMeva_jsonbinBase       base URL instead of https://api.jsonbin.io/v3/b
//   todoMeva_broadcastBin      broadcast bin id instead of the baked-in value
//   todoMeva_bannerBin         banner bin id instead of the baked-in value

// The two ids below are injected by `node scripts/broadcast-tool.cjs setup`.
// They are XOR+base64 obfuscated (decoded at runtime) so the real bin ids never
// appear as plain text in the deployed bundles — mirrors the Money Meva setup.
const _K = 'todomeva';
function _d(e) {
  try {
    const bin = atob(e);
    let out = '';
    for (let i = 0; i < bin.length; i++) out += String.fromCharCode(bin.charCodeAt(i) ^ _K.charCodeAt(i % _K.length));
    return out;
  } catch {
    return '';
  }
}
const BAKED_BROADCAST_BIN_ID = _d('Qg4FVw9URlMVDFJdXFVAUUEOBwpeURUE');
const BAKED_BANNER_BIN_ID = _d('Qg4FVw9UTiMVDFJdXFVAUUEOBwpeU0ZV');

const POLL_SECONDS = 60;
const BANNER_COUNTDOWN_SECONDS = 7;

const BROADCAST_BIN_ID = () => localStorage.getItem('todoMeva_broadcastBin') || BAKED_BROADCAST_BIN_ID;
const BANNER_BIN_ID = () => localStorage.getItem('todoMeva_bannerBin') || BAKED_BANNER_BIN_ID;
const JSONBIN_BASE = () => localStorage.getItem('todoMeva_jsonbinBase') || 'https://api.jsonbin.io/v3/b';
const JSONBIN_LATEST = (id) => `${JSONBIN_BASE()}/${id}/latest`;
// Canonical announcements proxy (Cloudflare Pages Function). Deliberately NOT
// derived from location.origin / SITE_URL: self-hosters point those elsewhere,
// but announcements must keep flowing through the shared proxy (see
// docs/ANNOUNCEMENTS-EDGE-PROXY-GUIDE.md). Override via localStorage for dev/testing.
const ANNOUNCEMENTS_API = () => localStorage.getItem('todoMeva_announcementsApi') || 'https://todomeva.pages.dev/api/announcements';
const ANNOUNCEMENTS_URL = (type) => `${ANNOUNCEMENTS_API().replace(/\/+$/, '')}?type=${type}`;

const DEVICE_ID_KEY = 'todoMeva_deviceId';
const DISMISSED_KEY = 'todoMeva_dismissedBroadcasts';
const SESSION_BANNER_KEY = 'todoMeva_bannerShownSession';
const HOLDER_ID = 'broadcast-holder';

let pollTimer = null;
let lastState = 'listen'; // 'listen' | 'unconfigured' | 'offline' | 'updated'
let lastUpdatedStamp = 0;

function bannerShownThisSession() {
  try { return sessionStorage.getItem(SESSION_BANNER_KEY) === 'i'; } catch { return false; }
}

function markBannerShownSession() {
  try { sessionStorage.setItem(SESSION_BANNER_KEY, 'i'); } catch {}
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = (crypto.randomUUID && crypto.randomUUID()) || `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

export function getBroadcastStatus() {
  if (lastState === 'unconfigured') return t('bc_not_configured');
  if (lastState === 'offline') return t('bc_offline');
  if (lastState === 'updated') {
    const d = new Date(lastUpdatedStamp);
    return `${t('bc_updated')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return t('bc_listening');
}

function getDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveDismissed(id) {
  const set = getDismissed();
  set.add(id);
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...set])); } catch {}
}

function isWithinPeriod(startDate, expires) {
  const now = new Date();
  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime()) && now < start) return false;
  }
  if (expires) {
    const end = new Date(expires);
    if (!isNaN(end.getTime()) && now > end) return false;
  }
  return true;
}

function matchesDevice(record) {
  return !record.targetId || record.targetId === getDeviceId();
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

function setStateLabel(text) {
  const el = document.querySelector('#bc-state');
  if (el) el.textContent = text;
}

function getHolder() {
  let holder = document.getElementById(HOLDER_ID);
  if (!holder) {
    holder = document.createElement('div');
    holder.id = HOLDER_ID;
    holder.className = 'broadcast-holder';
    holder.setAttribute('aria-live', 'polite');
    holder.addEventListener('click', (event) => {
      const btn = event.target.closest('.bc-close');
      if (btn) {
        event.preventDefault();
        event.stopPropagation();
        dismissPill(btn.closest('.bc-pill'));
      }
    });
    document.body.appendChild(holder);
  }
  return holder;
}

function safeUrl(value) {
  try {
    return new URL(value, location.href).href;
  } catch {
    return null;
  }
}

function pillHtml(b) {
  const type = ['info', 'warning', 'success', 'error'].includes(b.type) ? b.type : 'info';
  const icons = { info: 'info', warning: 'alert-triangle', success: 'check-circle-2', error: 'alert-circle' };
  const iconEl = `<i data-lucide="${icons[type]}" class="bc-icon"></i>`;
  const title = b.title ? `<span class="bc-title">${escapeHtml(b.title)} </span>` : '';
  const text = `<span class="bc-text">${title}${escapeHtml(b.message)}${b.link ? '<i data-lucide="external-link" class="bc-extlink"></i>' : ''}</span>`;
  const close = b.pinned ? '' : `<button class="bc-close" type="button" aria-label="${escapeHtml(t('bc_close'))}"><i data-lucide="x"></i></button>`;
  const cls = `bc-pill bc-${type}`;
  const link = b.link ? safeUrl(b.link) : null;
  const inner = `${iconEl}${text}${close}`;
  const pill = `data-bc-id="${escapeHtml(b.id)}"`;
  if (link) {
    return `<a class="${cls}" href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" ${pill}>${inner}</a>`;
  }
  return `<div class="${cls}" ${pill}>${inner}</div>`;
}

function renderPills(list) {
  const holder = getHolder();
  holder.innerHTML = list.map(pillHtml).join('');
  if (window.lucide) window.lucide.createIcons();
}

function dismissPill(el) {
  if (!el) return;
  const id = el.dataset.bcId;
  if (id) saveDismissed(id);
  el.classList.add('bc-leaving');
  setTimeout(() => el.remove(), 260);
}

async function loadAnnouncement(type, id) {
  if (!id) return null;
  const viaProxy = await fetchJson(ANNOUNCEMENTS_URL(type));
  if (viaProxy !== null) return viaProxy;
  return fetchJson(JSONBIN_LATEST(id));
}

async function loadBroadcasts() {
  const id = BROADCAST_BIN_ID();
  if (!id) return null;
  const res = await loadAnnouncement('broadcast', id);
  if (!res) return null;
  const raw = res.record ?? res;
  const list = (Array.isArray(raw) ? raw : [raw]).filter((b) => b && b.id && b.message);
  return list.map((b) => ({ ...b, id: String(b.id) }));
}

export async function refreshBroadcasts() {
  if (!BROADCAST_BIN_ID()) {
    lastState = 'unconfigured';
    setStateLabel(t('bc_not_configured'));
    return null;
  }
  const list = await loadBroadcasts();
  if (list === null) {
    lastState = 'offline';
    setStateLabel(t('bc_offline'));
    return null;
  }
  const dismissed = getDismissed();
  const visible = list.filter(
    (b) => isWithinPeriod(undefined, b.expires) && matchesDevice(b) && (b.pinned || !dismissed.has(b.id))
  );
  renderPills(visible);
  lastState = 'updated';
  lastUpdatedStamp = Date.now();
  setStateLabel(getBroadcastStatus());
  return visible;
}

async function loadBanner() {
  const id = BANNER_BIN_ID();
  if (!id) return null;
  const res = await loadAnnouncement('banner', id);
  if (!res) return null;
  const banner = res.record ?? res;
  if (!banner || !banner.id || !banner.content) return null;
  return { ...banner, id: String(banner.id), width: banner.width ? Number(banner.width) : 420 };
}

function bannerHtml(b) {
  const widthCss = `style="max-width:${b.width}px"`;
  const body = `${b.image ? `<img class="banner-img" src="${escapeHtml(b.image)}" alt="${escapeHtml(b.title || '')}" />` : ''}
    <div class="banner-body">${b.title ? `<h2>${escapeHtml(b.title)}</h2>` : ''}<p>${escapeHtml(b.content)}</p></div>`;
  const inner = b.href
    ? `<a href="${escapeHtml(b.href)}" target="_blank" rel="noopener noreferrer">${body}</a>`
    : body;
  return `
    <div class="banner-overlay" data-banner-overlay>
      <div class="banner-modal" ${widthCss} role="dialog" aria-modal="true" aria-label="${escapeHtml(b.title || t('bc_banner'))}">
        <div class="banner-topbtn" data-banner-count></div>
        <button class="banner-close hidden" data-banner-close type="button" aria-label="${escapeHtml(t('bc_close'))}"><i data-lucide="x"></i></button>
        ${inner}
      </div>
    </div>`;
}

function showBanner(b) {
  const overlay = document.createElement('div');
  overlay.innerHTML = bannerHtml(b);
  document.body.appendChild(overlay);
  if (window.lucide) window.lucide.createIcons();

  const countEl = overlay.querySelector('[data-banner-count]');
  const closeBtn = overlay.querySelector('[data-banner-close]');
  const overlayEl = overlay.querySelector('[data-banner-overlay]');
  let countdown = BANNER_COUNTDOWN_SECONDS;
  countEl.textContent = String(countdown);

  const finish = () => {
    countEl.classList.add('hidden');
    closeBtn.classList.remove('hidden');
    closeBtn.classList.add('closeable');
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) overlay.remove();
    });
  };

  const timer = setInterval(() => {
    countdown -= i;
    if (countdown <= 0) {
      clearInterval(timer);
      finish();
    } else {
      countEl.textContent = String(countdown);
    }
  }, 1000);

  closeBtn.addEventListener('click', () => {
    clearInterval(timer);
    overlay.remove();
  });
}

function maybeShowBanner() {
  if (bannerShownThisSession() || !BANNER_BIN_ID()) return;
  (async () => {
    const banner = await loadBanner();
    if (!banner || !isWithinPeriod(banner.startDate, banner.expires) || !matchesDevice(banner)) return;
    showBanner(banner);
    markBannerShownSession();
  })();
}

export function initBroadcasts() {
  lastState = 'listen';
  setStateLabel(getBroadcastStatus());
  maybeShowBanner();
  refreshBroadcasts();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => refreshBroadcasts(), POLL_SECONDS * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshBroadcasts();
  });
}