# Todo Meva

**An offline-first to-do app you can pin to your phone's home screen — no account, no cloud, no build step required.**

Todo Meva is a single-user productivity app with 8 smart categories, 48 domain templates, recurring tasks, reminders, a trilingual UI (English / मराठी / हिंदी), and opt-in multi-device sync against *your own* Supabase project. It ships as static web files for GitHub Pages / Cloudflare Pages and as a Capacitor-wrapped Android APK.

No bundler, no framework, no backend to run: plain HTML/CSS/JS ES modules with Dexie (IndexedDB) as the datastore. All data stays on-device until you connect sync.

**Live web:** https://kuldeep7ke.github.io/todomeva/ · **Edge-cached endpoints:** https://todomeva.pages.dev

---

## Download / Install

| Platform | How to get it | Notes |
|---|---|---|
| Web | Open https://kuldeep7ke.github.io/todomeva/ | Full app, installable via browser "Add to home screen" |
| Android (APK) | GitHub → **Actions** → **Build Android APK** → latest run → **Todomeva-APK** artifact → download + extract `app-debug.apk` | Debug-signed; sideload and allow install from unknown sources |

The release build for the Play Store is not published; the workflow artifact is the distribution channel right now.

## Build & Run

```bash
# 1. Clone
git clone https://github.com/kuldeep7ke/todomeva.git && cd todomeva

# 2. Install toolchain deps (Capacitor only — the app itself needs none)
npm ci

# 3. Run the web app locally
start.bat                      # Python http.server on :8400
# open http://127.0.0.1:8400/index.html   (Ctrl+F5 after changes)

# 4. Build the Android APK
npm run build                  # stage web assets into www/
npx cap sync android           # copy www/ into the android project
node scripts/update-android-version.cjs   # sync VERSION -> gradle
./gradlew assembleDebug        # in android/
```

Prerequises (local Android build only): Node 20+, JDK 21, Android SDK, `ANDROID_HOME` set. The CI workflow in `.github/workflows/build-apk.yml` does all of this for you on every push — no secrets needed.

## Features

- **8 categories + 48 templates** — Bank & Finance, Farm & Agriculture, Business, Work, Personal, Family, Kids, Education — re-seeded only when empty
- **Task management** — quick-add (Ctrl+K / FAB), full CRUD, status cycling (todo → in_progress → completed), delete confirmation
- **Recurring tasks** — daily / weekly / monthly / yearly auto-regenerate on completion
- **Reminders** — native Android notifications (Capacitor LocalNotifications) on the APK, Web Notifications in-browser; bell with unread badge, 30s checker, one fire per reminder
- **Trilingual UI** — English / मराठी / हिंदी, persisted, applied pre-paint
- **Themes** — light/dark + 3 brand palettes (Orange / Blue / Emerald)
- **Data** — full JSON export/import, activity log, offline-first Dexie storage
- **Multi-device sync (opt-in)** — bring your own Supabase URL + anon key; push/pull, tombstones, realtime + polling
- **Remote broadcast & banners** — edit a jsonbin.io bin and every install (web *and* APK) shows it within ~10 min, no app update

## How it works

Todo Meva is a static SPA: `index.html` loads ES modules (`app.js`, `components.js`, `views.js`, …) that read/write Dexie/IndexedDB. There is no server in the loop for app data. Three things reach the network on your behalf:

1. **Google Fonts** (Inter) — fails silently offline.
2. **Sync (only if configured)** — pushes `sync_docs` to your Supabase project.
3. **Announcements** — polls `https://todomeva.pages.dev/api/announcements` (a Cloudflare Pages Function that edge-caches jsonbin bins). If that proxy is unreachable it falls back to jsonbin directly.

The Android app is the same web code wrapped by Capacitor; `js/reminder.js` talks to `@capacitor/local-notifications` on native and falls back to Web Notifications in the browser WebView.

Deep dive: [docs/ANNOUNCEMENTS-EDGE-PROXY-GUIDE.md](docs/ANNOUNCEMENTS-EDGE-PROXY-GUIDE.md), [docs/BROADCAST-GUIDE.md](docs/BROADCAST-GUIDE.md), [MEMORY_CAPSULE.md](MEMORY_CAPSULE.md).

## Project structure

```
todomeva/
├── index.html               # Landing page + app shell + modals (cache-versioned asset refs)
├── css/style.css            # Warm flat UI system, 3 brand palettes, sync/notif/broadcast styles
├── js/                      # ES modules — see MEMORY_CAPSULE.md for the dependency graph
│   ├── app.js               #   orchestrator: init, navigation, settings actions
│   ├── db.js                #   Dexie v3 schema + CRUD + activities
│   ├── components.js        #   sidebar, task cards, modals, pickers
│   ├── views.js             #   Dashboard/Upcoming/Category/Priority/Settings renderers
│   ├── reminder.js          #   Capacitor LocalNotifications bridge + web fallback
│   ├── sync.js              #   opt-in Supabase sync engine + SCHEMA_SQL
│   ├── broadcast.js         #   announcement pills + banner modal
│   └── (seed, recurrence, i18n, prefs, account)
├── vendor/                  # local browser builds: dexie, lucide, supabase
├── supabase/schema.sql      # sync_docs DDL (embedded in sync.js too)
├── assets/                  # favicon, logo, palette.md
├── functions/api/announcements.js   # CF Pages edge-cached jsonbin proxy
├── scripts/                 # version bump, web build, android version sync, broadcast tool
├── android/                 # Capacitor 8 Android project (debug.keystore committed)
├── .github/workflows/       # build-apk, pages, deploy-cloudflare
├── MEMORY_CAPSULE.md        # full project memory
└── FROM_SCRATCH.md          # build plan & progress
```

## Configuration

All settings are `localStorage` — nothing is baked into the APK, so the same build serves everyone.

| Key | Values | Purpose |
|---|---|---|
| `todoMeva_theme` | `light` \| `dark` | Theme, applied pre-paint |
| `todoMeva_brand` | `orange` \| `blue` \| `green` | Brand palette |
| `todoMeva_lang` | `en` \| `mr` \| `hi` | Language |
| `todoMeva_notify_prefs` | `{ reminders, onboarding }` | Notification & popup toggles |
| `todoMeva_profile` | `{ name, email, contact, updatedAt }` | Account profile |
| `todoMeva_sync` | `{ url, key }` | Supabase URL + anon key (optional) |
| `todoMeva_announcementsApi` | URL | Override the announcements proxy (dev/testing) |

## Tech stack

Dexie 3.2.4 · Lucide · Supabase JS client (opt-in) · Capacitor 8 (Android + LocalNotifications) · Vanilla JS ES modules · Inter (Google Fonts).

## Contributing

Report issues and PRs on GitHub. Before editing, read the cache-versioning rule and verification checklist in [MEMORY_CAPSULE.md](MEMORY_CAPSULE.md). There is no license file yet — assume all rights reserved.