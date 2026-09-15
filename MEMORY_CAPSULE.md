# Todo Meva — Memory Capsule

*Last updated: 2026-09-15*

---

## 1. What this is

Todo Meva is a single-user, offline-first to-do/productivity SPA. 8 smart categories, 48 templates, recurring tasks, reminders, trilingual UI (English / मराठी / हिंदी), light/dark + 3 brand palettes, and an opt-in multi-device sync that uses the *user's own* Supabase project.

It ships on three surfaces from one source tree:

| Surface | URL | Build |
|---|---|---|
| GitHub Pages | https://kuldeep7ke.github.io/todomeva/ | `pages.yml` (static copy: `index.html` + `css/js/assets/vendor`) |
| Cloudflare Pages | https://todomeva.pages.dev | `deploy-cloudflare.yml` (whole repo incl. `functions/`) |
| Android APK | artifact `Todomeva-APK` from the **Build Android APK** workflow | `build-apk.yml` (Capacitor 8 + debug keystore) |

Repo is **public** (`kuldeep7ke/todomeva`, branch `main`). No secrets live in the repo — sync config is user-entered `localStorage`.

---

## 2. Tech stack

| Layer | Technology | Version | Where |
|---|---|---|---|
| App language | Vanilla JS (ES modules) | ES2022 | `js/` |
| Local storage | Dexie.js (IndexedDB) | 3.2.4 | `vendor/dexie.min.js` |
| Icons | Lucide | latest | `vendor/lucide.min.js` |
| Opt-in sync | Supabase JS client (UMD global) | latest | `vendor/supabase.min.js` |
| Android wrapper | Capacitor | 8.5.x | `node_modules/`, `android/` |
| Native notifications | Capacitor LocalNotifications | 8.0.x | `node_modules/` |
| Font | Inter (Google Fonts CDN) | 400–800 | CDN |
| Dev server | Python `http.server` | 3.x | `start.bat` → `:8400` |
| CI | GitHub Actions | — | `.github/workflows/` |

**No bundler, no framework, no build step for the web app.** The web code is served as-is. Capacitor copies it into the Android project; version fields are patched into `build.gradle` by a script.

---

## 3. Tooling & versioning

- `VERSION` file holds `v<major>.<minor>.<patch>.<build>` — currently **v1.0.0.0**.
- `scripts/bump-version.cjs` — bumps `VERSION` by type (`patch` default / `minor` / `major`).
- `scripts/update-android-version.cjs` — reads `VERSION`, writes `versionCode` (`major*1e8 + minor*1e6 + patch*1e4 + build`) + `versionName` into `android/app/build.gradle`.
- `scripts/build-web.cjs` — `npm run build`; wipes `www/` and stages `index.html, css, js, assets, vendor`.
- `scripts/broadcast-tool.cjs` — manages jsonbin bins (`setup` / `bake` / `publish`), needs `JSONBIN_MASTER_KEY`.
- npm scripts: `build`, `version:patch|minor|major`, `cap:sync`, `cap:copy`, `cap:build`.

---

## 4. Cache versioning (operational rule)

Every file loads with a `?v=N` query param because of browser caching. **When you edit a module, bump its `?v=` in every importer** (and in `index.html` for CSS/entry JS).

Current versions (verified 2026-09-15):
- `index.html`: `css/style.css?v=21`, `js/app.js?v=15`
- `app.js` imports: `db?v=7`, `components?v=12`, `views?v=18`, `reminder?v=7`, `prefs?v=4`, `account?v=4`, `i18n?v=11`, `sync?v=8`, `broadcast?v=4`
- `views.js` imports: `db?v=7`, `components?v=12`, `i18n?v=11`, `broadcast?v=4`, `prefs?v=4`, `account?v=4`, `reminder?v=7`, `sync?v=8`
- `components.js` imports: `db?v=7`, `seed?v=5`, `recurrence?v=6`, `i18n?v=11`, `prefs?v=4`, `sync?v=8`, `account?v=4`
- `reminder.js` imports: `db?v=7`, `prefs?v=4`
- `sync.js` / `recurrence.js` / `broadcast.js` import `db?v=7` / `i18n?v=11`
- `db.js` imports `seed?v=5`

---

## 5. Project structure

```
todomeva/
├── index.html                    # Landing + app shell + modals + onboarding (preload theme/brand/lang)
├── MEMORY_CAPSULE.md             # this file
├── FROM_SCRATCH.md               # build plan & progress
├── README.md                     # front door / install / build docs
├── VERSION                       # v1.0.0.0
├── package.json                  # Capacitor deps + npm scripts
├── capacitor.config.json         # appId com.kuldeep.todomeva, local notifications smallIcon/color
├── .gitignore                    # www/, todomeva-release.keystore, ./playwright/, root png
├── assets/                       # favicon.svg, logo.svg, palette.md
├── css/style.css                 # flat UI system + 3 brand palettes + notif/sync/broadcast styles
├── js/                           # ES modules (graph in §7)
│   ├── app.js                    #   orchestrator: init, nav, events, settings, theme/brand, export/import
│   ├── db.js                     #   Dexie v3 schema (uuid), CRUD, activity tracking
│   ├── seed.js                   #   8 categories + 48 templates
│   ├── components.js             #   sidebar, task cards, quick add, edit modal, pickers, onboarding
│   ├── views.js                  #   Dashboard/Upcoming/Category/Priority/Settings + notif panel/badge
│   ├── recurrence.js             #   recurring-task calculation engine
│   ├── reminder.js               #   Capacitor LocalNotifications bridge + web fallback + 30s checker
│   ├── i18n.js                   #   en/mr/hi dictionaries + t()/setLang/translateStatic/initLang
│   ├── prefs.js                  #   notification & popup preferences
│   ├── account.js                #   profile (name/email/contact), todoMeva_profile
│   ├── sync.js                   #   opt-in Supabase sync engine + SCHEMA_SQL
│   └── broadcast.js              #   announcement pills + banner modal + proxy fetch
├── supabase/schema.sql           # sync_docs DDL (embedded in sync.js as SCHEMA_SQL)
├── vendor/                       # dexie.min.js, lucide.min.js, supabase.min.js (local builds)
├── functions/api/announcements.js  # CF Pages edge-cached jsonbin proxy
├── scripts/                      # build-web / bump-version / update-android-version / broadcast-tool
│   └── content/                  #   broadcast.json, banner.json (published via broadcast-tool)
├── android/                      # Capacitor Android project
│   └── app/
│       ├── build.gradle          #   debug signing via committed debug.keystore; release unsigned
│       ├── debug.keystore        #   standard Android debug key (committed, non-secret)
│       └── src/main/res/drawable/ic_stat_notify.xml
├── docs/
│   ├── ANNOUNCEMENTS-EDGE-PROXY-GUIDE.md   # reusable edge-proxy playbook
│   ├── BROADCAST-GUIDE.md                  # editing broadcast/banner bins day-to-day
│   └── superpowers/specs/                  # design specs (create-task-form, ...)
└── .github/workflows/
    ├── build-apk.yml                       # APK artifact, no secrets
    ├── pages.yml                           # GitHub Pages
    └── deploy-cloudflare.yml               # CF Pages + functions (needs repo secrets, else skipped)
```

---

## 6. Persistence keys (localStorage)

| Key | Value | Purpose |
|---|---|---|
| `todoMeva_theme` | `light` \| `dark` | Theme, applied pre-paint |
| `todoMeva_brand` | `orange` \| `blue` \| `green` | Brand palette |
| `todoMeva_lang` | `en` \| `mr` \| `hi` | Language |
| `todoMeva_notify_prefs` | `{ reminders: bool, onboarding: bool }` | Notification & popup prefs |
| `todoMeva_profile` | `{ name, email, contact, updatedAt }` | Account profile (`contact` optional) |
| `todoMeva_sync` | `{ url, key }` | Sync config (Supabase URL + anon key) — optional |
| `todoMeva_onboarded` | `'1'` | Onboarding shown once |
| `todoMeva_deviceId` | uuid | Stable device id for broadcast `targetId` targeting |
| `todoMeva_dismissedBroadcasts` | `["id", ...]` | Dismissed pill ids (per device) |
| `todoMeva_announcementsApi` | URL | Override announcements proxy (dev/testing) |
| `todoMeva_jsonbinBase` / `todoMeva_broadcastBin` / `todoMeva_bannerBin` | URL / ids | Dev overrides for broadcast fetching |

---

## 7. Module architecture

### Dependency graph
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

### Reminder path (native-first, browser fallback)
`reminder.js` resolves `window.Capacitor.isNativePlatform()` → uses `Capacitor.Plugins.LocalNotifications` (`checkPermissions` / `requestPermissions` / `schedule`) on Android; otherwise the Web Notifications API. `isNotificationsSupported()` and `getNotificationPermission()` are async, Capacitor-aware, and consumed by `views.js` for the live permission row and Enable button.

---

## 8. Database schema (Dexie v3)

**DB name:** `TodoMevaDB` — **version:** 3 (v2 → v3 added `uuid` to every row; indexes include uuid).

```
categories:  ++id, uuid, name, icon, color, order
templates:   ++id, uuid, categoryId, title, description, priority, order
tasks:       ++id, uuid, title, description, categoryId, templateId, priority,
             status, dueDate, startDate, recurrence, reminders, createdAt,
             updatedAt, completedAt, parentTaskId
activities:  ++id, uuid, type, taskId, taskTitle, details, timestamp
```

Activity types: `task_created`, `task_completed`, `task_deleted`, `task_updated`, `task_recurred`. `makeUuid()` uses `crypto.randomUUID()` with a `Math.random` fallback. Task status covers `todo / in_progress / completed` plus archive/focus lifecycle (`archiveTaskById`, `purgeTaskById`, `restoreTaskById`, `startFocus/stopFocus`, `sendToPending`) exposed by `db.js`.

---

## 9. Remote sync schema (Supabase, opt-in)

Single table, user-owned project. Run `supabase/schema.sql` (or `SCHEMA_SQL` from `sync.js`) once in the Supabase SQL Editor:

```sql
create table sync_docs (
  id text primary key,          -- 'entity:<uuid>' e.g. 'task:9f3a…'
  entity text not null,         -- category | template | task | activity
  data jsonb not null,
  updated_at timestamptz not null default now()
);
-- indexes on (entity) and (updated_at)
-- RLS enabled, policy sync_docs_anon_all (for all, to anon, using true)
-- added to publication supabase_realtime
```

Security note: anon has full access by design — acceptable only because each user connects their own private project.

---

## 10. Seed data

8 categories, each with 6 templates (48 total). Re-seeded by `seedDatabase()` only when categories are empty (categories + templates — never demo tasks).

| # | Name | Icon | Color |
|---|---|---|---|
| 1 | Bank & Finance | `landmark` | `#3B82F6` |
| 2 | Farm & Agriculture | `sprout` | `#22C55E` |
| 3 | Business | `briefcase` | `#8B5CF6` |
| 4 | Work & Administrative | `building-2` | `#6366F1` |
| 5 | Personal | `user` | `#14B8A6` |
| 6 | Family & Home | `home` | `#F59E0B` |
| 7 | Kids | `baby` | `#EC4899` |
| 8 | Education & Learning | `graduation-cap` | `#06B6D4` |

---

## 11. Internationalization

| Code | Display | Status |
|---|---|---|
| `en` | English | Default, fallback |
| `mr` | मराठी | Full |
| `hi` | हिंदी | Full |

- ~130 keys per language. `t(key)` → current lang → fallback `en` → raw key.
- `setLang(code)` swaps dictionary + `document.documentElement.lang`; `translateStatic()` re-renders `[data-i18n]`; `initLang()` reads `todoMeva_lang` on boot.
- mr/hi blocks rewritten as natural everyday language (due prefix `मुदत`, repeat phrases like `फिर होगा`, `रोज़`/`हर हफ़्ते`, Marathi `ॲप`); reset label `रीसेट` in both.

---

## 12. Design system

Default palette (Orange).

| Role | Light | Dark | Usage |
|---|---|---|---|
| Background | `#f7f3ee` | `#191715` | Body |
| Surface | `#ffffff` | `#24211e` | Cards, sidebar, modals |
| Soft surface | `#fff8ef` | `#2d2823` | Soft backgrounds |
| Text | `#2d2a24` | `#fff7ed` | Main text |
| Muted | `#7c7164` | `#c8b8a7` | Secondary text |
| Border | `#e6d9ca` | `#463c33` | Borders |
| Accent | `#f97316` | `#fb923c` | Buttons, active |
| Accent strong | `#ea580c` | `#f97316` | Hover |
| Success / Warning / Danger | `#16a34a` / `#d97706` / `#dc2626` | same | Priority + status |

Brand palettes: `[data-brand="blue"]` and `[data-brand="green"]` override accent tokens via CSS custom properties (both themes); default is orange. Chips in Settings → Appearance.

Tokens: card radius 22px, task cards 18px, buttons/badges 999px; shadow `0 18px 45px rgba(67, 48, 33, 0.12)`; font Inter/system-ui. Sync status dot uses `syncPulse`. Settings panel width == dashboard `.main-panel` (`min(1180px, calc(100% - 32px))`); the old 860px cap on `.settings-grid-full` is gone. Full reference: `assets/palette.md`.

---

## 13. Features

### App shell
- Landing page (hero, info cards, tagline, footer) → app shell (sidebar + main panel + FAB).
- Responsive: desktop side-by-side, tablet overlay sidebar, mobile full-screen.
- Onboarding card on first visit: name (required) + optional contact, no login; Save or Skip (toggleable via prefs).

### Views (4 + Settings)
1. **Dashboard** — stats, quick-create form, overdue/today/open sections
2. **Upcoming** — future dated tasks, 30 days
3. **Category** — tasks filtered by category
4. **Priority Matrix** — high/medium/low/pending columns
5. **Settings** — single scrolling page, 8 section cards (Account, Appearance, Language, Notifications & Popups, Multi-Device Sync, Data, Danger Zone, About) + Broadcasts status row

### Tasks
- Quick Add (Ctrl+K or FAB): category grid → template chips → two-step form
- CRUD with delete confirmation; status cycling `todo → in_progress → completed → todo`
- Recurring tasks auto-generate next instance on completion; archive/focus lifecycle
- Petka: priority/recurrence/reminder custom dropdowns + custom calendar date picker (native `date` inputs)

### Notifications
- **Android APK:** Capacitor LocalNotifications (native `schedule`, `ic_stat_notify` icon, `#3b82f6` color)
- **Web:** Web Notifications API
- Topbar bell with unread badge → dropdown panel grouping Overdue / Today / Due soon + Enable button
- Settings shows live permission status (Enabled / Blocked / Off / Not supported); Enable button renders only when requestable
- 30s checker, one fire per reminder, prefs via `todoMeva_notify_prefs`

### Theme, brand & language
- Light/dark + 3 palettes + 3 languages, all applied pre-paint (`<head>` script), persisted.

### Multi-device sync (opt-in)
- Default: everything stays local. Connect your own Supabase project to share.
- Config validated against `^https://([a-zA-Z0-9-]+\.)+supabase\.co$`
- Push: debounced upsert of local rows as `entity:<uuid>` (`onConflict: 'id'`); Pull: ordered by `updated_at`, remaps numeric IDs, applies tombstones
- Realtime channel `todomeva-sync` + 30s poll + reconnect on `online`
- Status `disconnected | connected | syncing | error` with last-sync time, persisted across refresh
- Disconnect clears config; app stays stable with none

### Broadcast & banner (jsonbin + CF edge proxy)
- App polls `https://todomeva.pages.dev/api/announcements?type=broadcast|banner` every 60s; CF Pages Function edge-caches one copy per 10-min TTL, so jsonbin load scales with time, not users
- Broadcast pills (stack, dismissible, `pinned`, `expires`, `link`, `targetId`) + banner modal (7s close countdown, `startDate`/`expires`, `href`, `image`)
- Direct jsonbin fallback if the proxy is unreachable; `cache: 'no-store'` on polls
- Bin ids XOR+base64-obfuscated in `js/broadcast.js`; server-side in `functions/api/announcements.js` (overridable via Pages env vars)
- Device-targeting via `todoMeva_deviceId` (shown in Settings); dismissed ids per device
- Full editing guide: `docs/BROADCAST-GUIDE.md`

---

## 14. Mobile UI/UX (≤ 620px)

Full-screen slide-in sidebar with backdrop; topbar wraps (eyebrow hidden); badge below task title; bottom-sheet modals; single-column quick create; compact horizontal category cards; compact info-card grid; centered bottom FAB; full-width tagline pill; stacked footer; 2-column stats; compact landing hero.

---

## 15. Android / Capacitor build plan

- `capacitor.config.json`: `appId com.kuldeep.todomeva`, `appName "Todo Meva"`, `webDir www`, `LocalNotifications.smallIcon = ic_stat_notify`, `iconColor #3b82f6`, `allowMixedContent false`.
- `android/app/build.gradle`: debug signing from committed `android/app/debug.keystore` (standard `android`/`androiddebugkey`, non-secret — mirrors the Money Meva pattern); **release block deliberately unsigned** (no hardcoded credentials, no secrets in repo); `minifyEnabled false`.
- Release keystore `todomeva-release.keystore` is gitignored and lives only locally.
- Version flow: `VERSION` → `scripts/update-android-version.cjs` → `build.gradle` (`versionCode`/`versionName`).
- The web app is fully self-contained in `www/` — no build secrets, sync config is user-entered localStorage, so the CI APK build needs **no repository secrets**.
- Local build verified: `npm run build` → `npx cap sync android` → `update-android-version` → `./gradlew assembleDebug` (JDK 21, ANDROID_HOME set). APK ≈4.4 MB, signed with Android debug cert, includes all 3 notification permissions + `ic_stat_notify`.

---

## 16. CI/CD workflows (`.github/workflows/`)

| Workflow | Triggers | What it does | Secrets |
|---|---|---|---|
| `build-apk.yml` ("Build Android APK") | push to `main` (paths: VERSION, android/**, js/**, css/**, assets/**, vendor/**, index.html, package.json) + manual (version_type choice) | `npm ci` → optional bump-version → `npm run build` → `cap sync android` → update android version → `assembleDebug` → upload `Todomeva-APK` artifact | none |
| `pages.yml` ("Deploy to GitHub Pages") | push to `main` + manual | stages `index.html` + `css/js/assets/vendor` into `public/`, `upload-pages-artifact@v5`, `deploy-pages@v5` | none (Pages auto) |
| `deploy-cloudflare.yml` ("Deploy to Cloudflare Pages") | push to `main` + manual | `wrangler pages deploy .` on project `todomeva` (creates if missing), serves `functions/` → announcements proxy | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (skipped/no-op until set) |

---

## 17. Server & access

- Local dev: `start.bat` (hidden Python `http.server` on **8400**); stop with `stop-server.bat`.
- Open `http://127.0.0.1:8400/index.html`; hard refresh with `Ctrl+F5` after changes.
- Deployed web: https://kuldeep7ke.github.io/todomeva/ (GH Pages) · https://todomeva.pages.dev (CF, incl. `/api/announcements`).

---

## 18. Verification

```powershell
# syntax checks
node --check js/app.js js/components.js js/views.js js/db.js js/seed.js js/reminder.js
node --check js/recurrence.js js/i18n.js js/prefs.js js/account.js js/sync.js js/broadcast.js

# web build + android sync
npm run build
npx cap sync android
node scripts/update-android-version.cjs

# android apk (from repo root; JDK 21 + ANDROID_HOME required)
./android/gradlew -p android assembleDebug
```

### Quick browser checks
1. Launch renders dashboard, not a blank shell; 2. sidebar category counts show; 3. theme/brand/lang persist after refresh; 4. Ctrl+K / FAB opens Quick Add, X and Cancel close it; 5. dashboard quick create adds a task; 6. task card opens edit modal; 7. status checkbox cycles state; 8. export downloads JSON; 9. Settings renders 8 sections + Broadcasts status; 10. invalid sync URL shows persistent validation message; unreachable host surfaces a fetch error without breaking Settings; 11. Settings top edge aligns with dashboard (same `.main-panel` width); 12. Danger Zone rows: 12px padding + 8px gap; 13. notifications: granted → status row reads Enabled (not "Off + Enable"); Enable button only when requestable.

### Android smoke checks
1. `npm run build && npx cap sync android` then `assembleDebug` succeeds locally and in CI; 2. APK shows app name "Todo Meva"; 3. reminders schedule natively (Capacitor) and fire once; 4. sync config + broadcast pills work from the APK WebView (CORS `*` on the proxy).

---

## 19. Known issues / future work

- [ ] Category deletion does not reassign existing tasks (orphaned `categoryId`)
- [ ] Custom recurrence with specific days of the week not in UI
- [ ] No drag-and-drop reordering of tasks
- [ ] No task search / full-text search
- [ ] Sync uses unauthenticated anon access — fine for personal use; add Supabase Auth for shared/multi-user later
- [ ] Google Fonts CDN can fail offline
- [ ] APK is debug-signed only; release signing (gitignored keystore) not wired into CI
- [ ] Nothing for iOS yet (Capacitor would need a Mac + Xcode)

---

## 20. Design decisions (chronological)

| Step | Choice | Selected option |
|---|---|---|
| 1 | Foundation | Vanilla SPA, no build step |
| 2 | Structure | Documented ES-module layout |
| 3 | Styling | Warm flat UI (replaced glassmorphism) |
| 4 | Storage | Dexie IndexedDB (4 tables) |
| 5–6 | Scope / order | Full documented app; Data → UI → Features |
| 7 | Dev server | Python `http.server` :8400 |
| 8–9 | Dependencies | Vendored local browser builds |
| 10 | Palette | Warm productivity (orange accent) |
| 11–12 | Reminder UI / run check | Topbar bell; verified on :8400 |
| 13 | DB upgrades | v2 → v3 adds `uuid` to all tables (stable identity for sync) |
| 14 | Settings | Full 8-section single page |
| 15 | i18n | Trilingual from day one (`data-i18n` + `t()`) |
| 16 | Brand palettes | Accent swaps via `[data-brand]` CSS overrides |
| 17–19 | Sync | Bring-your-own Supabase; `sync_docs` keyed `entity:<uuid>`; anon access accepted (user-owned project) |
| 20–21 | Notification UI/enable | Topbar bell + badge + dropdown panel; Enable button only when requestable, settings re-renders to live status |
| 22–24 | Settings width / i18n quality / Danger Zone | Panel-width parity, natural mr/hi phrasing, grid rhythm for danger rows |
| 25 | Onboarding & contact | First-launch card (name required + optional contact), `todoMeva_profile.contact`; Account form gains contact |
| 26 | Broadcasts | jsonbin bins behind a Cloudflare Pages edge-cached proxy (`/api/announcements`), absolute-URL constant, direct-jsonbin fallback |
| 27 | Android | Capacitor 8 wrapper; debug keystore committed; release intentionally unsigned (no secrets in repo); LocalNotifications plugin with small icon + color |
| 28 | Android versioning | Single `VERSION` file drives `versionCode`/`versionName` via script |
| 29 | CI/CD | GitHub Actions: APK artifact (no secrets), GH Pages (static copy), CF Pages (whole repo + functions) |
| 30 | Sync parity | Broadcast `targetId` per-device targeting via `todoMeva_deviceId` |

---

## 21. Git

- Remote: `https://github.com/kuldeep7ke/todomeva.git` — Branch: `main`
- HEAD: `4798746` "feat: adopt MoneyMeva build plan — Android APK workflow + Capacitor LocalNotifications"
- Working tree clean. Repo public; no secrets committed (`todomeva-release.keystore` gitignored; deploy secrets live only in GH settings).

---

## 22. Handoff notes

- Docs restructured 2026-09-15: new `README.md`, rewritten `MEMORY_CAPSULE.md` + `FROM_SCRATCH.md`; guides verified against code.
- Broadcast/banner content is edited on **jsonbin.io** (no deploy) — see `docs/BROADCAST-GUIDE.md`. Announcing a release: bump the broadcast `id` (e.g. `...-v2`) so dismissed users see it.
- To publish a new version: bump `VERSION` (scripts), `npm run build`, commit, push — CI builds APK + deploys both sites automatically. Optionally trigger the APK workflow manually with a version_type for a standalone bump.