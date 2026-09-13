# Todo Meva — From Scratch Build Plan

Last updated: 2026-09-13

---

## Project Overview

Todo Meva is an offline-first vanilla JavaScript to-do/productivity SPA. It uses Dexie (IndexedDB) for local persistence, a behavioral sync engine that pushes to a user-owned Supabase project, Lucide for icons, a custom warm flat UI design system with 3 brand palettes, trilingual i18n (English / मराठी / हिंदी), and persistent light/dark themes.

**Current shape:** Landing page → 4 views (Dashboard, Upcoming, Category, Priority Matrix) + 8-section single-page Settings; topbar with theme toggle + notification bell; quick-add (Ctrl+K / FAB); recurrence; reminders; export/import; opt-in sync.

---

## Design Choices (Made by User)

Each choice was selected step-by-step:

1. **Foundation**: Vanilla SPA (HTML/CSS/JS ES modules, no build step)
2. **Structure**: Documented module layout (app.js, db.js, seed.js, components.js, views.js, recurrence.js, reminder.js, i18n.js, prefs.js, account.js, sync.js)
3. **Styling**: Warm flat UI (replaced original glassmorphism)
4. **Storage**: Dexie IndexedDB with 4 tables (categories, templates, tasks, activities)
5. **Scope**: Full documented app (landing, dashboard, views, recurrence, reminders, import/export)
6. **Build order**: Data → UI → Features
7. **Dev server**: `npx http-server -p 3000 -c-1 --cors`
8. **Dependencies**: Vendored local browser builds (Dexie + Lucide + Supabase JS)
9. **Palette**: Warm productivity (off-white bg, orange accent, charcoal text)
10. **Settings**: A single scrolling page with 8 section cards (~not sub-view navigation)
11. **i18n**: Trilingual from day one (en / mr / hi), `data-i18n` attributes + runtime `t()`
12. **Brand palettes**: Accent swaps via `data-brand` CSS overrides (Orange default, Blue, Emerald)
13. **Sync**: Bring-your-own Supabase — no vendor account, config + anon key pasted at runtime
14. **Sync data model**: `sync_docs` table keyed by `entity:<uuid>`, push/pull + tombstones

### Landing Page Decisions

- Hero: eyebrow badge + headline + feature summary + preview card
- Info cards: 4 vertical cards on desktop, compact icon-left layout on mobile
- Tagline: "Everything stays on your device. No accounts. No cloud. No distractions."
- Footer: brand + credit line + links (Launch App, GitHub)

---

## File Structure

```
Todo Meva/
├── index.html                   # Landing page + App shell + Modals + Onboarding (i18n/brand/theme preload + cache versions)
├── FROM_SCRATCH.md              # This file — build plan & progress
├── MEMORY_CAPSULE.md            # Full project memory
├── assets/
│   ├── favicon.svg              # SVG favicon (checklist + checkmark)
│   ├── logo.svg                 # App brand logo (same icon as favicon)
│   └── palette.md               # Flat UI color palette reference
├── css/
│   └── style.css                # Flat UI system + 3 brand palettes + settings/sync/notif styles
├── js/
│   ├── app.js                   # Orchestrator: init, navigation, events, settings actions, theme/brand, export/import, notification-permission flow
│   ├── db.js                    # Dexie IndexedDB schema v3 (uuid), CRUD, activity tracking
│   ├── seed.js                  # 8 categories + 48 smart templates
│   ├── components.js            # UI: sidebar, task cards, quick add, edit modal, onboarding
│   ├── views.js                 # View renderers incl. settings, notifications panel + badge
│   ├── recurrence.js            # Recurring task calculation engine
│   ├── reminder.js              # Web Notifications API (returns live permission state) + periodic checker
│   ├── i18n.js                  # Translations (en/mr/hi), t(), setLang, translateStatic, initLang
│   ├── prefs.js                 # Notification & popup preferences (todoMeva_notify_prefs)
│   ├── account.js               # Profile (name/email) — todoMeva_profile
│   └── sync.js                  # Multi-device sync: connect/push/pull/realtime + SCHEMA_SQL
├── supabase/
│   └── schema.sql               # sync_docs schema (same SQL embedded in sync.js)
└── vendor/
    ├── dexie.min.js             # Dexie 3.2.4 local browser build
    ├── lucide.min.js            # Lucide local browser build
    └── supabase.min.js          # Supabase JS client (UMD global) — enables sync only when configured
```

> Note: `js/i18n.js`, `js/prefs.js`, `js/account.js`, `js/sync.js`, `supabase/`, and `vendor/supabase.min.js` exist in the working tree but are **not yet committed** (see Git).

---

## App Architecture

### Data Flow
```
User Action → Event Handler → DB Operation → Re-render View
                                ↕                 ↕
                         Dexie IndexedDB     Sync Engine (opt-in)
                        (4 tables, uuid)     → Supabase sync_docs
```

### Module Dependency Graph
```
index.html → app.js
              ├── db.js
              ├── seed.js (via db.js)
              ├── components.js
              │   ├── db.js
              │   ├── seed.js (config only)
              │   ├── recurrence.js
              │   ├── i18n.js
              │   └── prefs.js
              ├── views.js
              │   ├── db.js
              │   ├── components.js
              │   ├── i18n.js
              │   ├── prefs.js
              │   ├── account.js
              │   └── sync.js (getSyncConfig/getSyncStatus/SCHEMA_SQL)
              ├── reminder.js
              │   ├── db.js
              │   └── prefs.js
              ├── i18n.js
              ├── prefs.js
              ├── account.js
              └── sync.js
                  └── db.js
```
No circular dependencies.

---

## Cache Versioning (operational rule)

Because `http-server` is run with `-c-1` (no-cache headers) but the page is often opened from browser cache:

- Every file is loaded with a `?v=N` query param (see `index.html` + each module import).
- **Rule:** when you edit a module, bump its `?v=` in every importer. When you edit CSS/HTML entry file, bump its `?v=` in `index.html`.
- Current versions (2026-09-13): `style.css?v=12`, `js/app.js?v=6`; `app.js` imports `db.js?v=5`, `components.js?v=5`, `views.js?v=6`, `reminder.js?v=6`, `i18n.js?v=6`, `sync.js?v=5`; `components.js`/`views.js` import `i18n.js?v=6`; `seed.js?v=5`; `prefs.js?v=4`, `account.js?v=4`.

---

## Database Schema (Dexie v3)

**DB name:** `TodoMevaDB` — **Version:** 3 (v2 → v3 upgrade adds `uuid` to every row)

### Table: `categories`
| Field | Type |
|-------|------|
| id | ++id |
| uuid | String |
| name | String |
| icon | String (Lucide name) |
| color | String (hex) |
| order | Number |

### Table: `templates`
| Field | Type |
|-------|------|
| id | ++id |
| uuid | String |
| categoryId | Number |
| title | String |
| description | String |
| priority | String |
| order | Number |

### Table: `tasks`
| Field | Type |
|-------|------|
| id | ++id |
| uuid | String |
| title | String |
| description | String |
| categoryId | Number |
| templateId | Number |
| priority | String (high/medium/low) |
| status | String (todo/in_progress/completed) |
| dueDate | String (YYYY-MM-DD) |
| startDate | String |
| recurrence | String (none/daily/weekly/monthly/yearly) |
| reminders | Array [{minutesBefore, fired}] |
| createdAt | String |
| updatedAt | String |
| completedAt | String |
| parentTaskId | Number |

### Table: `activities`
| Field | Type |
|-------|------|
| id | ++id |
| uuid | String |
| type | String |
| taskId | Number |
| taskTitle | String |
| details | String |
| timestamp | String |

`makeUuid()` uses `crypto.randomUUID()` with a Math.random fallback.

---

## Seed Data

8 Categories with Lucide icons and hex colors:

| Category | Icon | Color |
|----------|------|-------|
| Bank & Finance | landmark | #3B82F6 |
| Farm & Agriculture | sprout | #22C55E |
| Business | briefcase | #8B5CF6 |
| Work & Administrative | building-2 | #6366F1 |
| Personal | user | #14B8A6 |
| Family & Home | home | #F59E0B |
| Kids | baby | #EC4899 |
| Education & Learning | graduation-cap | #06B6D4 |

48 Smart Templates (6 per category). Re-seeded only when categories are empty (categories + templates only — never demo tasks).

---

## Theme, Brand & Color System

### Flat UI Palette (Orange default)

| Role | Light Hex | Dark Hex | Usage |
|------|-----------|----------|-------|
| Background | #f7f3ee | #191715 | Body background |
| Surface | #ffffff | #24211e | Cards, sidebar, modals |
| Soft surface | #fff8ef | #2d2823 | Soft backgrounds |
| Text | #2d2a24 | #fff7ed | Main text |
| Muted | #7c7164 | #c8b8a7 | Secondary text |
| Border | #e6d9ca | #463c33 | Borders |
| Accent | #f97316 | #fb923c | Buttons, active states |
| Accent strong | #ea580c | #f97316 | Button hover |
| Success | #16a34a | #16a34a | Low priority, completed |
| Warning | #d97706 | #d97706 | Medium priority |
| Danger | #dc2626 | #dc2626 | High priority, overdue |

### Brand Palettes (accent swaps via CSS overrides)

| Data attribute | Accent (light) | Accent (dark) | Label |
|----------------|----------------|---------------|-------|
| (default) | #f97316 / #ea580c | #fb923c / #f97316 | Orange |
| `[data-brand="blue"]` | Blue | Light blue | Blue |
| `[data-brand="green"]` | Emerald | Light emerald | Emerald |

- Theme = `localStorage.todoMeva_theme` (`light`/`dark`)
- Brand = `localStorage.todoMeva_brand` (`orange`/`blue`/`green`)
- Early script in `<head>` applies theme + brand before first paint (no flash)
- **Settings panel width parity:** Settings shares the `.main-panel` width (`min(1180px, calc(100% - 32px))`) with the dashboard — the old `.settings-grid-full { max-width: 860px }` cap was removed.

---

## Internationalization (i18n)

- 3 languages: English (`en`), Marathi (`mr`), Hindi (`hi`) — ~130 keys per language
- `t(key)` returns translated string; falls back to `en`, then the raw key
- `setLang(code)` swaps dictionary + `document.documentElement.lang`
- `translateStatic()` re-renders all `[data-i18n]` elements
- `initLang()` reads `todoMeva_lang` on every load; persisted in `localStorage.todoMeva_lang`
- **2026-09-13:** mr + hi blocks rewritten for natural everyday phrasing — due-date prefix `मुदत` (mr) / `फिर होगा` pattern (hi), natural repeat labels (`रोज़` / `हर हफ़्ते`, etc.), Marathi `ॲप` spelling; "Reset" = `रीसेट` (mr/hi). Verified live in a Marathi-profile browser.

---

## Features Implemented

### Phase 1 — Data Layer
- [x] Dexie IndexedDB v3 schema (categories, templates, tasks, activities) with `uuid`
- [x] Local date string helpers (avoids timezone issues)
- [x] Seed data: 8 categories + 48 templates
- [x] Activity tracking CRUD

### Phase 2 — Core UI
- [x] Warm flat design system (replaces glassmorphism)
- [x] Persistent light/dark theme toggle (sidebar footer)
- [x] Responsive sidebar with nav + categories + counts
- [x] 4 views: Dashboard, Upcoming, Category Filter, Priority Matrix
- [x] Landing page with hero, info cards, tagline, footer
- [x] 1-step onboarding (first visit only)

### Phase 3 — Task Management
- [x] Quick-Add modal (Ctrl+K or FAB): Category selection → Template chips → Form
- [x] Task CRUD: create, read, update, delete with confirmation
- [x] Status cycling: todo → in_progress → completed → todo
- [x] Task filtering by category, priority, status
- [x] Smart templates auto-fill title, description, priority

### Phase 4 — Advanced Features
- [x] Recurring tasks: daily/weekly/monthly/yearly auto-generation on completion
- [x] Web Notifications reminders: topbar bell icon with unread badge → dropdown panel (Overdue / Today / Due soon groups, footer Enable button)
- [x] Periodic reminder checker (30s interval)
- [x] Dashboard with stats, quick create, today/overdue/other sections
- [x] Export/Import full JSON backup
- [x] Dashboard name hidden on mobile

### Phase 5 — Mobile UI/UX
- [x] Sidebar: slides from left with backdrop overlay, full-width on mobile
- [x] Topbar: wraps cleanly, eyebrow hidden on mobile
- [x] Task cards: badge moves below title on mobile
- [x] Modals: bottom sheet style (slide up, rounded top)
- [x] Quick create: stacks fields vertically
- [x] Category grid: compact horizontal layout on mobile
- [x] FAB: centered at the bottom
- [x] Info cards: compact icon-left layout with grid
- [x] Footer: three-column desktop, stacked mobile with credit in middle
- [x] Sidebar segments: separated with border and spacing

### Phase 6 — Settings & Personalization
- [x] Settings page (single scrolling page) with 8 section cards
- [x] **Account**: profile name/email (edit form), saved to `todoMeva_profile`
- [x] **Appearance / App Color**: dark-mode toggle + 3 segmented brand palettes (Orange/Blue/Emerald)
- [x] **Language**: English / मराठी / हिंदी segmented picker
- [x] **Notifications & Popups**: reminders toggle + onboarding popups toggle + live notification-permission status row with working Enable flow
- [x] **Multi-Device Sync**: bring-your-own Supabase (URL + anon key), connect/sync-now/disconnect, live status, embedded schema SQL + copy button
- [x] **Data**: export JSON, import JSON (replaces all data)
- [x] **Danger Zone**: "Clear all data" (confirm by typing DELETE), "Reset preferences"
- [x] **About**: app info + "Open Landing Page"

### Phase 7 — i18n & Brand Palettes
- [x] Full i18n (en/mr/hi) across every view, modal, and settings section
- [x] `data-i18n` static translation + runtime `t()` for dynamic UI
- [x] 3 brand palettes applied via `[data-brand]` CSS overrides (with dark-mode variants)

### Phase 8 — Multi-Device Sync (opt-in)
- [x] `sync_docs` remote table keyed by `id = entity:<uuid>` (category/template/task/activity)
- [x] Debounced push of local changes, pull + id remap of remote changes
- [x] Realtime channel `todomeva-sync` (postgres_changes) + 30s polling reconnect
- [x] Tombstones: local delete mirrors a `deleted` flag; remote deletes are applied locally
- [x] Status surface: disconnected / connected / syncing / error with last-sync time
- [x] Config validated against `^https://([a-zA-Z0-9-]+\.)+supabase\.co$`, stored in `todoMeva_sync`
- [x] Anon key only, user-owned project; RLS policy `sync_docs_anon_all` (open by design — see caveat)

### Phase 9 — Notification Permission Flow (2026-09-13)
- [x] `requestNotificationPermission()` in reminder.js now **returns** the resulting permission state (`unsupported` / `granted` / `denied` / `default`)
- [x] Settings' `Enable` button renders **only** when permission is requestable (`Notification.permission === 'default'`); after the request the settings view re-renders to show live status (Enabled / Blocked / Off / Not supported) — no more dead button
- [x] Status row no longer falsely shows "Off + Enable" when permission is already granted

---

## Local Development

### Start server
```powershell
npx --yes http-server -p 3000 -c-1 --cors
```

### Open / hard refresh
```
http://localhost:3000/        Ctrl+F5
```

### Before/after each edit
1. **Bump cache version** of the edited file (see Cache Versioning rule)
2. Run syntax checks (below)
3. Reload app in browser and verify the touched flow

---

## Verification

Run syntax checks before pushing:
```powershell
node --check js/app.js
node --check js/components.js
node --check js/views.js
node --check js/db.js
node --check js/seed.js
node --check js/reminder.js
node --check js/recurrence.js
node --check js/i18n.js
node --check js/prefs.js
node --check js/account.js
node --check js/sync.js
```

### Quick browser checks
1. Launch App renders dashboard
2. Sidebar category counts show
3. Light/Dark toggle persists after refresh
4. Ctrl+K or FAB opens Quick Add
5. Dashboard quick create adds a task
6. Task card click opens edit modal
7. Status checkbox cycles task state
8. Export downloads JSON
9. Settings: each of the 8 sections renders; language + palette switches persist after refresh
10. Sync: invalid URL shows validation error; valid host shows connected/failed status without dropping the error
11. Settings width matches Dashboard (same panel width, no 860px cap)
12. **Danger Zone**: the two rows ("Clear all data" / "Reset preferences") have identical padding (12px) and an 8px gap between them, matching all other settings rows
13. **Notifications**: with permission granted the status row shows "Status: Enabled" (not "Off + Enable"); the Enable button only appears when permission is otherwise requestable

---

## Known Issues / Future Work

- [ ] Category deletion does not reassign tasks (orphaned categoryId)
- [ ] Custom recurrence with specific days of week not in UI
- [ ] No drag-and-drop reordering of tasks
- [ ] No task search/full-text search
- [ ] Sync: unauthenticated anon access to `sync_docs` — acceptable only because each user brings their own project; add Supabase Auth later for hardened multi-user sharing
- [ ] Sync: third-party CDN (Google Fonts) can fail offline

---

## Git

- Remote: `https://github.com/kuldeep7ke/todomeva.git` — Branch: `main`
- HEAD: `c98a2c3` "Rebuild Todo Meva with warm flat UI, offline-first Dexie storage, 8 categories, 48 templates, task CRUD, recurring tasks, reminders, import/export, responsive mobile layout"
- **Working tree is dirty** (not committed):
  - Modified: `index.html`, `css/style.css`, `js/app.js`, `js/components.js`, `js/db.js`, `js/recurrence.js`, `js/reminder.js`, `js/views.js`
  - Untracked (new modules built after HEAD): `js/i18n.js`, `js/prefs.js`, `js/account.js`, `js/sync.js`, `supabase/schema.sql`, `vendor/supabase.min.js`
  - Untracked debris to clean up: `.playwright-mcp/`, screenshot PNGs (`*.png` at repo root)
- A future commit should include the new modules + session fixes, and `.playwright-mcp/` + root screenshots should be gitignored/deleted.

---

## Pending (needs the user)

- Commit the uncommitted work (new modules + session fixes) and clean up screenshot/`.playwright-mcp` debris.
- Create the dedicated TodoMeva Supabase project and run `supabase/schema.sql` (or the embedded `SCHEMA_SQL`) in its SQL Editor, then paste Project URL + anon key into Settings → Multi-Device Sync, and run a live multi-device sync test.