# Todo Meva — From Scratch Build Plan

Last updated: 2026-09-15

---

## Project Overview

Todo Meva is an offline-first vanilla JavaScript to-do/productivity SPA. Dexie (IndexedDB) for local persistence, an opt-in sync engine against a *user-owned* Supabase project, Lucide icons, a warm flat UI with 3 brand palettes, trilingual i18n (English / मराठी / हिंदी), recurrent tasks, reminders, remote broadcasts, and an Android APK (Capacitor 8).

**Current shape:** Landing page → 4 views (Dashboard, Upcoming, Category, Priority Matrix) + 11-section Settings (incl. Navigation + Help & Guides); topbar theme toggle + notification bell; quick-add (Ctrl+K / FAB); recurring tasks; reminders (native on Android, Web Notifications in browser); export/import; opt-in sync; jsonbin broadcasts via a Cloudflare edge-cached proxy.

**Delivered surfaces:** GitHub Pages, Cloudflare Pages (with edge-cached `/api/announcements`), and Android debug APK built by GitHub Actions.

---

## Design Choices (made by user)

1. **Foundation**: Vanilla SPA — HTML/CSS/JS ES modules, no build step for the web app
2. **Structure**: Documented module layout (`app.js`, `db.js`, `seed.js`, `components.js`, `views.js`, `recurrence.js`, `reminder.js`, `i18n.js`, `prefs.js`, `account.js`, `sync.js`, `broadcast.js`)
3. **Styling**: Warm flat UI (replaced the original glassmorphism)
4. **Storage**: Dexie IndexedDB, 4 tables (categories, templates, tasks, activities), v3 adds `uuid`
5. **Scope**: Full documented app (landing, dashboard, views, recurrence, reminders, import/export)
6. **Build order**: Data → UI → Features
7. **Dev server**: `start.bat` → Python `http.server` on :8400
8. **Dependencies**: Vendored local browser builds (Dexie + Lucide + Supabase JS)
9. **Palette**: Warm productivity (off-white bg, orange accent, charcoal text)
10. **Settings**: One scrolling page, 11 section cards (Account, Navigation, Appearance, Language, Notifications & Popups, Broadcasts, Multi-Device Sync, Data, Danger Zone, Help & Guides, About); Navigation + Help & Guides sub-views (Basics / Recommended)
11. **i18n**: Trilingual from day one (en / mr / hi), `data-i18n` + runtime `t()`
12. **Brand palettes**: Accent swaps via `[data-brand]` CSS overrides (Orange default, Blue, Emerald)
13. **Sync**: Bring-your-own Supabase — no vendor account; URL + anon key pasted at runtime
14. **Sync data model**: `sync_docs` table keyed `entity:<uuid>`, push/pull + tombstones
15. **Broadcasts**: jsonbin bins served through ONE Cloudflare Pages edge-cached proxy (absolute-URL constant, direct fallback) — quota bounded by time, not users
16. **Android**: Capacitor 8 wrapper; committed debug keystore; release block unsigned (no secrets in repo); LocalNotifications plugin with small icon + color
17. **Android versioning**: A single `VERSION` file drives `versionCode`/`versionName` via `scripts/update-android-version.cjs`
18. **CI/CD**: GitHub Actions — APK artifact (no secrets), GH Pages deploy, CF Pages deploy (+ functions)

### Landing Page Decisions

- Hero: eyebrow badge + headline + feature summary + preview card
- Info cards: 4 vertical on desktop, compact icon-left on mobile
- Tagline: "Everything stays on your device. No accounts. No cloud. No distractions."
- Footer: brand + credit line + links (Launch App, GitHub)

---

## File Structure

```
todomeva/
├── index.html                   # Landing + app shell + modals + onboarding (theme/brand/lang preload + cache versions)
├── FROM_SCRATCH.md              # This file — build plan & progress
├── MEMORY_CAPSULE.md            # Full project memory
├── README.md                    # Front door / install / build docs
├── VERSION                      # v1.0.0.0
├── package.json                 # Capacitor deps + npm scripts
├── capacitor.config.json        # appId com.kuldeep.todomeva; LocalNotifications smallIcon/iconColor
├── .gitignore                   # www/, todomeva-release.keystore, .playwright-mcp/, root *.png
├── assets/                      # favicon.svg, logo.svg, palette.md
├── css/style.css                # Flat UI system + 3 brand palettes + settings/sync/notif/broadcast styles
├── js/
│   ├── app.js                   # Orchestrator: init, navigation, events, settings, theme/brand, export/import, notif-permission flow
│   ├── db.js                    # Dexie v3 schema (uuid), CRUD, activity tracking
│   ├── seed.js                  # 8 categories + 48 smart templates
│   ├── components.js            # Sidebar, task cards, quick add, edit modal, pickers, onboarding
│   ├── views.js                 # View renderers incl. settings, notifications panel + badge, broadcast status
│   ├── recurrence.js            # Recurring-task calculation engine
│   ├── reminder.js              # Capacitor LocalNotifications bridge + Web Notifications fallback + periodic checker
│   ├── i18n.js                  # Translations (en/mr/hi), t(), setLang, translateStatic, initLang
│   ├── prefs.js                 # Notification & popup prefs (todoMeva_notify_prefs)
│   ├── account.js               # Profile (name/email/contact) — todoMeva_profile
│   ├── sync.js                  # Multi-device sync: connect/push/pull/realtime + SCHEMA_SQL
│   └── broadcast.js             # Announcement pills + banner modal + proxy fetch + fallback
├── supabase/schema.sql          # sync_docs DDL (same SQL embedded in sync.js)
├── vendor/                      # dexie.min.js, lucide.min.js, supabase.min.js (local builds)
├── functions/api/announcements.js  # Cloudflare Pages edge-cached jsonbin proxy
├── scripts/                     # build-web, bump-version, update-android-version, broadcast-tool
│   └── content/                 # broadcast.json, banner.json
├── android/                     # Capacitor Android project (debug.keystore committed; release unsigned)
├── docs/                        # ANNOUNCEMENTS-EDGE-PROXY-GUIDE, BROADCAST-GUIDE, superpowers specs
└── .github/workflows/           # build-apk.yml, pages.yml, deploy-cloudflare.yml
```

---

## App Architecture

### Data Flow
```
User Action → Event Handler → DB Operation → Re-render View
                                ↕                 ↕
                          Dexie IndexedDB    Sync Engine (opt-in)
                        (4 tables, uuid)     → Supabase sync_docs
```

### Module Dependency Graph
```
index.html → app.js
              ├── db.js ──→ seed.js
              ├── components.js ──→ db, seed (config), recurrence, i18n, prefs, sync, account
              ├── views.js ──→ db, components, i18n, broadcast, prefs, account, reminder, sync
              ├── reminder.js ──→ db, prefs
              ├── broadcast.js ──→ i18n
              ├── i18n.js
              ├── prefs.js
              ├── account.js
              └── sync.js ──→ db
```
No circular dependencies.

---

## Cache Versioning (operational rule)

Every file loads with `?v=N` because of browser caching. **Rule:** when you edit a module bump its `?v=` in every importer; when you edit CSS/HTML bump it in `index.html`.

Current versions (2026-09-16):
- `index.html` loads `style.css?v=22`, `js/app.js?v=16`
- `app.js`: `db?v=7`, `components?v=13`, `views?v=19`, `reminder?v=7`, `prefs?v=4`, `account?v=4`, `i18n?v=12`, `sync?v=9`, `dialog?v=1`, `broadcast?v=5`
- `views.js`: `db?v=7`, `components?v=13`, `i18n?v=12`, `broadcast?v=5`, `prefs?v=4`, `account?v=4`, `reminder?v=7`, `sync?v=9`
- `components.js`: `db?v=7`, `seed?v=5`, `recurrence?v=6`, `i18n?v=12`, `prefs?v=4`, `sync?v=9`, `account?v=4`, `dialog?v=1`
- `reminder.js`: `db?v=7`, `prefs?v=4`
- `sync.js` / `recurrence.js`: `db?v=7`; `broadcast.js` / `dialog.js`: `i18n?v=12`; `db.js`: `seed?v=5`

---

## Database Schema (Dexie v3)

**DB name:** `TodoMevaDB` — **version:** 3 (v2 → v3 adds `uuid` to every row)

- `categories` — `++id, uuid, name, icon (Lucide), color (hex), order`
- `templates` — `++id, uuid, categoryId, title, description, priority, order`
- `tasks` — `++id, uuid, title, description, categoryId, templateId, priority (high/medium/low), status (todo/in_progress/completed), dueDate, startDate, recurrence (none/daily/weekly/monthly/yearly), reminders [{minutesBefore, fired}], createdAt, updatedAt, completedAt, parentTaskId` (+ archive/focus lifecycle fields in db.js)
- `activities` — `++id, uuid, type, taskId, taskTitle, details, timestamp`

`makeUuid()` uses `crypto.randomUUID()` with a `Math.random` fallback.

---

## Seed Data

8 categories (Bank & Finance, Farm & Agriculture, Business, Work & Administrative, Personal, Family & Home, Kids, Education & Learning) with Lucide icons + hex colors, and 48 smart templates (6 each). Re-seeded only when categories are empty (never demo tasks).

---

## Theme, Brand & Color System

Orange is default. Blue / Emerald swap accents via `[data-brand]` CSS overrides (light + dark variants). Theme = `todoMeva_theme`, brand = `todoMeva_brand`; applied by a `<head>` script before first paint. Settings panel shares the `.main-panel` width with the dashboard (860px cap removed). Full palette tables in `assets/palette.md` and `MEMORY_CAPSULE.md`.

---

## Internationalization (i18n)

3 languages, ~130 keys each: `t(key)` falls back `en` → raw key; `setLang()` swaps dictionary + `lang` attr; `translateStatic()` re-renders `[data-i18n]`; `initLang()` reads `todoMeva_lang`. mr/hi use natural everyday phrasing (verified in a Marathi-profile browser).

---

## Features Implemented

### Phase 1 — Data layer
- [x] Dexie v3 schema (4 tables) with `uuid`; local date helpers; seed 8+48; activity tracking

### Phase 2 — Core UI
- [x] Warm flat design; persistent light/dark theme; responsive sidebar (nav + categories + counts)
- [x] 4 views (Dashboard, Upcoming, Category Filter, Priority Matrix) + landing + 1-step onboarding

### Phase 3 — Task management
- [x] Quick-add (Ctrl+K / FAB): category → template chips → form; CRUD with confirmation
- [x] Status cycling `todo → in_progress → completed → todo`; category/priority/status filters; smart templates
- [x] Archive/focus lifecycle (archive, purge, restore, focus sessions)

### Phase 4 — Advanced features
- [x] Recurring tasks (daily/weekly/monthly/yearly auto-generation)
- [x] Reminders: topbar bell + unread badge + dropdown (Overdue / Today / Due soon) + bottom Enable button
- [x] 30s periodic checker; dashboard stats; export/import JSON backup

### Phase 5 — Mobile UI/UX
- [x] Sidebar slide-in with backdrop; wrapping topbar; badge below title; bottom-sheet modals; single-column quick create; compact category/info cards; centered FAB; stacked footer; 2-column stats; compact hero

### Phase 6 — Settings & personalization
- [x] 11 section cards: Account (name/email/contact), Navigation (Back to Dashboard / Open Landing Page), Appearance (dark + 3 palettes), Language (en/mr/hi), Notifications & Popups (toggles + live permission status), Broadcasts (device id + status), Multi-Device Sync (connect/sync/disconnect + SQL), Data (export/import), Danger Zone (type DELETE / reset prefs), Help & Guides (Basics / Recommended), About

### Phase 7 — i18n & brand palettes
- [x] Full trilingual coverage; `data-i18n` + `t()`; 3 brand palettes with dark variants

### Phase 8 — Multi-device sync (opt-in)
- [x] `sync_docs` keyed `entity:<uuid>`; debounced push; pull + numeric id remap; tombstones
- [x] Realtime channel `todomeva-sync` + 30s polling reconnect; status `disconnected/connected/syncing/error` persisted
- [x] Config validated against `^https://([a-zA-Z0-9-]+\.)+supabase\.co$` in `todoMeva_sync`; anon-key only (user-owned project)

### Phase 9 — Notification permission flow
- [x] `requestNotificationPermission()` returns the resulting state (`unsupported/granted/denied/default`); Enable button only when requestable; settings re-renders live status

### Phase 10 — Broadcasts & banners (jsonbin + edge proxy)
- [x] `functions/api/announcements.js` edge-cached proxy; absolute-URL constant (not derived from origin)
- [x] Broadcast pills (stack, dismissible, pinned/expires/link/targetId) + banner modal (7s close countdown, startDate/expires/href/image)
- [x] Direct jsonbin fallback; `todoMeva_deviceId` targeting; Settings → Broadcasts status row; 60s poll

### Phase 11 — Android & Capacitor
- [x] Capacitor 8 Android project with LocalNotifications (small icon `ic_stat_notify`, color `#3b82f6`)
- [x] `reminder.js` native-first bridge with browser fallback; Capacitor-aware `isNotificationsSupported()`/`getNotificationPermission()`
- [x] Debug keystore committed; release block unsigned (no secrets); `VERSION` → gradle version sync

### Phase 12 — CI/CD
- [x] `build-apk.yml` — APK artifact on push/manual, no secrets
- [x] `pages.yml` — GitHub Pages deploy (v5 actions)
- [x] `deploy-cloudflare.yml` — CF Pages deploy + functions (skips until secrets set)

---

## Local Development

1. Run `start.bat` → Python `http.server` on :8400 (hidden window).
2. Open `http://127.0.0.1:8400/index.html`; hard refresh `Ctrl+F5`.
3. Before/after each edit: bump the cache version (§Cache Versioning), run syntax checks (below), reload and verify.

---

## Verification

```powershell
node --check js/app.js js/components.js js/views.js js/db.js js/seed.js js/reminder.js
node --check js/recurrence.js js/i18n.js js/prefs.js js/account.js js/sync.js js/broadcast.js
npm run build
npx cap sync android
node scripts/update-android-version.cjs
./android/gradlew -p android assembleDebug
```

### Quick browser checks
1. Launch renders dashboard; 2. sidebar counts show; 3. theme/brand/lang persist; 4. Ctrl+K / FAB opens Quick Add, X/Cancel closes; 5. quick create adds a task; 6. task card opens edit modal; 7. status checkbox cycles; 8. export downloads JSON; 9. Settings renders 11 sections; Navigation actions (Back to Dashboard / Open Landing Page) + Help & Guides sub-views (Basics / Recommended) work; 10. sync: invalid URL → persistent validation error; unreachable host → fetch error without breaking Settings; 11. Settings width matches dashboard panel; 12. Danger Zone rows share 12px padding + 8px gap; 13. granted notification permission → "Status: Enabled" (not "Off + Enable"); Enable button only when requestable.

### Android checks
Local + CI build succeed; APK title "Todo Meva"; native reminder scheduling fires once; sync/broadcasts reach the WebView (CORS `*`).

---

## Known Issues / Future Work

- [ ] Category deletion leaves orphaned `categoryId` on tasks
- [ ] Custom recurrence with specific weekdays not in UI
- [ ] No drag-and-drop reorder; no task search
- [ ] Sync is unauthenticated anon — fine solo, add Supabase Auth later
- [ ] Google Fonts CDN can fail offline
- [ ] APK debug-signed only; release signing (gitignored keystore) not wired into CI
- [ ] No iOS build yet (Needs a Mac + Xcode)

---

## Git

- Remote: `https://github.com/kuldeep7ke/todomeva.git` — Branch: `main`
- HEAD: `4798746` "feat: adopt MoneyMeva build plan — Android APK workflow + Capacitor LocalNotifications"
- Working tree clean. Public repo; no secrets committed.

---

## Pending (needs the user)

- Live multi-device sync test: create the TodoMeva Supabase project, run `supabase/schema.sql` (or `SCHEMA_SQL`) in its SQL Editor, paste Project URL + anon key into Settings → Multi-Device Sync, sync between two devices. (Validation, failure paths and wipe flows already verified locally.)
- Optional: set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` repo secrets so the CF Pages deploy + announcements proxy are fully automated (until then those runs are no-ops; the proxy is already live from the manual setup).
- Optional: wire release signing now that the debug-signed APK is the current distributable.