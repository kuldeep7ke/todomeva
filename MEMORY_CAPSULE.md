# Todo Meva — Memory Capsule

*Last Updated: 2026-09-13*

---

## Project Overview

Todo Meva is a feature-rich, single-user Productivity & To-Do Application with 8 smart categories, 48 domain-specific templates, scheduling, recurrence, reminder capabilities, persistent light/dark themes, 3 brand palettes, trilingual i18n (English / मराठी / हिंदी), and an opt-in multi-device sync that uses the user's own Supabase project. Built as an offline-first SPA with a warm flat UI design system.

---

## Tech Stack

| Layer | Technology | Version | Source |
|-------|-----------|---------|--------|
| Storage | Dexie.js (IndexedDB wrapper) | 3.2.4 | `vendor/dexie.min.js` |
| Icons | Lucide Icons | Latest | `vendor/lucide.min.js` |
| Sync | Supabase JS client (UMD global) | Latest | `vendor/supabase.min.js` |
| Font | Inter (Google Fonts) | 400–800 wght | CDN |
| Language | Vanilla JavaScript (ES Modules) | ES2022 | — |
| Server | http-server (Node.js) | 14.x | `npx --yes http-server -p 3000 -c-1 --cors` |

---

## Project Structure

```
Todo Meva/
├── index.html                    # Landing page + App shell + Modals + Onboarding (theme/brand/lang preload + cache versions)
├── MEMORY_CAPSULE.md             # This file — full project memory
├── FROM_SCRATCH.md               # Build plan & step-by-step progress
├── assets/
│   ├── favicon.svg               # SVG favicon (checklist + checkmark)
│   ├── logo.svg                  # App brand logo
│   └── palette.md                # Flat UI color reference
├── css/
│   └── style.css                 # Warm flat UI system + brand palettes + settings/sync/notif styles
├── js/
│   ├── app.js                    # Orchestrator: init, navigation, events, settings actions, theme/brand, export/import, notification-permission flow
│   ├── db.js                     # Dexie IndexedDB schema v3 (uuid), CRUD, activity tracking
│   ├── seed.js                   # 8 categories + 48 smart templates
│   ├── components.js             # UI: sidebar, task cards, quick add, edit modal, onboarding
│   ├── views.js                  # View renderers incl. settings, notifications panel + badge
│   ├── recurrence.js             # Recurring task calculation engine
│   ├── reminder.js               # Web Notifications API (returns live permission state) + periodic checker
│   ├── i18n.js                   # Translations (en/mr/hi) + t()/setLang/translateStatic/initLang
│   ├── prefs.js                  # Notification & popup preferences
│   ├── account.js                # Profile (name/email)
│   └── sync.js                   # Multi-device sync engine + SCHEMA_SQL
├── supabase/
│   └── schema.sql                # sync_docs schema (same SQL embedded in sync.js)
└── vendor/
    ├── dexie.min.js              # Dexie 3.2.4 local browser build
    ├── lucide.min.js             # Lucide local browser build
    └── supabase.min.js           # Supabase JS client (best-effort UMD global)
```

> Modules `i18n.js`, `prefs.js`, `account.js`, `sync.js` (+ `supabase/` + `vendor/supabase.min.js`) are uncommitted — see Git.

---

## Persistence Keys (localStorage)

| Key | Value | Purpose |
|-----|-------|---------|
| `todoMeva_theme` | `light` \| `dark` | Theme, applied pre-paint |
| `todoMeva_brand` | `orange` \| `blue` \| `green` | Brand palette |
| `todoMeva_lang` | `en` \| `mr` \| `hi` | Language |
| `todoMeva_notify_prefs` | `{ reminders: bool, onboarding: bool }` | Notification & popup preferences |
| `todoMeva_profile` | `{ name, email, updatedAt }` | Account profile |
| `todoMeva_sync` | `{ url, key }` | Sync config (Supabase URL + anon key) |
| `todoMeva_onboarded` | `'1'` | Onboarding shown once |

---

## Design System

### Flat UI Palette (Orange — default)

| Role | Light Hex | Dark Hex | Usage |
|------|-----------|----------|-------|
| Background | `#f7f3ee` | `#191715` | Body background |
| Surface | `#ffffff` | `#24211e` | Cards, sidebar, modals |
| Soft surface | `#fff8ef` | `#2d2823` | Soft backgrounds |
| Text | `#2d2a24` | `#fff7ed` | Main text |
| Muted | `#7c7164` | `#c8b8a7` | Secondary text |
| Border | `#e6d9ca` | `#463c33` | Borders |
| Accent | `#f97316` | `#fb923c` | Buttons, active states |
| Accent strong | `#ea580c` | `#f97316` | Button hover |
| Success | `#16a34a` | `#16a34a` | Low priority, completed |
| Warning | `#d97706` | `#d97706` | Medium priority |
| Danger | `#dc2626` | `#dc2626` | High priority, overdue |

### Brand Palettes

`[data-brand="blue"]` and `[data-brand="green"]` override the accent tokens for both themes (CSS custom properties). Default is orange (no attribute). Palette chips in Settings → Appearance.

### Design Tokens
- Border radius: 22px (cards), 999px (buttons/badges), 18px (task cards)
- Shadow: `0 18px 45px rgba(67, 48, 33, 0.12)`
- Font: Inter, system-ui sans-serif
- Sync status dot uses `@keyframes syncPulse`
- Settings panel width == dashboard `.main-panel` (`min(1180px, calc(100% - 32px))`); `.settings-grid-full` no longer capped at 860px

---

## Cache Versioning Convention

Files load with a `?v=N` query param because of browser caching. **Bump `?v=` of any file you edit** — in `index.html` for `style.css`/`app.js`, and in every importing module for `.js` dependencies.

Current versions (2026-09-13):
- `index.html`: `style.css?v=14`, `js/app.js?v=7`
- `app.js` imports: `db.js?v=6`, `components.js?v=7`, `views.js?v=7`, `reminder.js?v=7`, `i18n.js?v=7`, `sync.js?v=6`; `prefs.js?v=4`, `account.js?v=4`
- `components.js` imports `db.js?v=6`, `seed.js?v=5`, `recurrence.js?v=6`, `i18n.js?v=7`, `prefs.js?v=4`, `sync.js?v=6`
- `views.js` imports `db.js?v=6`, `components.js?v=7`, `i18n.js?v=7`, `sync.js?v=6`, `prefs.js?v=4`, `account.js?v=4`
- `db.js` imports `seed.js?v=5`; `reminder.js`/`recurrence.js`/`sync.js` import `db.js?v=6`

---

## Module Architecture

### Dependency Graph
```
index.html → app.js
              ├── db.js (database layer)
              ├── seed.js (via db.js)
              ├── components.js (UI components)
              │   ├── db.js
              │   ├── seed.js (config only)
              │   ├── recurrence.js
              │   ├── i18n.js
              │   └── prefs.js
              ├── views.js (view renderers)
              │   ├── db.js
              │   ├── components.js
              │   ├── i18n.js
              │   ├── prefs.js (getNotifyPrefs)
              │   ├── account.js (getProfile)
              │   └── sync.js (getSyncConfig/getSyncStatus/SCHEMA_SQL)
              ├── reminder.js (notifications)
              │   ├── db.js
              │   └── prefs.js
              ├── i18n.js (translations)
              ├── prefs.js (preferences)
              ├── account.js (profile)
              └── sync.js (sync engine)
                  └── db.js
```
No circular dependencies.

---

## Database Schema (Dexie v3)

**DB name:** `TodoMevaDB`
**Version:** 3 (v2 → v3 adds `uuid` to every row; indexes include uuid)

```
categories:  ++id, uuid, name, icon, color, order
templates:   ++id, uuid, categoryId, title, description, priority, order
tasks:       ++id, uuid, title, description, categoryId, templateId, priority,
             status, dueDate, startDate, recurrence, reminders, createdAt,
             updatedAt, completedAt, parentTaskId
activities:  ++id, uuid, type, taskId, taskTitle, details, timestamp
```

Activity types: `task_created`, `task_completed`, `task_deleted`, `task_updated`, `task_recurred`

---

## Remote Sync Schema (Supabase)

Single table, user-owned project. Run `supabase/schema.sql` (or the embedded `SCHEMA_SQL` in `sync.js`) once in the Supabase SQL Editor:

```sql
create table sync_docs (
  id text primary key,          -- 'entity:<uuid>' e.g. 'task:9f3a…'
  entity text not null,         -- category | template | task | activity
  data jsonb not null,
  updated_at timestamptz not null default now()
);
-- indexes on (entity) and (updated_at)
-- RLS enabled with policy sync_docs_anon_all (for all, to anon, using true)
-- added to publication supabase_realtime
```

Security note: anon has full access by design — acceptable only because each user supplies their own private project.

---

## Seed Data

### 8 Categories

| # | Name | Icon | Color | Templates |
|---|------|------|-------|-----------|
| 1 | Bank & Finance | `landmark` | `#3B82F6` | 6 |
| 2 | Farm & Agriculture | `sprout` | `#22C55E` | 6 |
| 3 | Business | `briefcase` | `#8B5CF6` | 6 |
| 4 | Work & Administrative | `building-2` | `#6366F1` | 6 |
| 5 | Personal | `user` | `#14B8A6` | 6 |
| 6 | Family & Home | `home` | `#F59E0B` | 6 |
| 7 | Kids | `baby` | `#EC4899` | 6 |
| 8 | Education & Learning | `graduation-cap` | `#06B6D4` | 6 |

48 templates total (6 per category). Re-seeded by `seedDatabase()` when categories are empty (only categories + templates — never demo tasks).

---

## Internationalization

| Code | Display | Kitchen sync status |
|------|---------|---------------------|
| `en` | English | Default, fallback |
| `mr` | मराठी | Full |
| `hi` | हिंदी | Full |

- ~130 keys per language covering dashboard, tasks, modals, settings, sync
- `t(key)` → current lang, falls back to `en`, then raw key
- `setLang(code)` swaps + refreshes `document.documentElement.lang`
- `translateStatic()` re-renders `[data-i18n]` elements
- Persisted via `todoMeva_lang`; read on boot with `initLang()`
- **2026-09-13 natural-language rewrite:** mr + hi blocks written in everyday phrasing — due prefix `मुदत` (mr) / recurrence phrases like `फिर होगा` (hi), live repeat labels (`रोज़` / `हर हफ़्ते`), Marathi `ॲप` spelling. Reset label = `रीसेट` in both. Verified live in a Marathi-profile browser.

---

## Features

### App Shell
- Landing page with hero, info cards, tagline, footer
- App shell with sidebar + main panel + FAB
- Responsive: desktop (side-by-side), tablet (sidebar overlay), mobile (full-screen)
- Onboarding popup on first visit (toggleable via prefs)

### Views (4 + Settings)
1. **Dashboard** — Stats (overdue/open/completed), quick create form, overdue/today/open task sections
2. **Upcoming** — Chronological list of future dated tasks (30 days)
3. **Category** — Filter tasks by category (click from sidebar)
4. **Priority Matrix** — Columns for high/medium/low/pending priority
5. **Settings** — Single scrolling page, 8 section cards (Account, Appearance/App Color, Language, Notifications & Popups, Multi-Device Sync, Data, Danger Zone, About)

### Task Management
- Quick Add (Ctrl+K or FAB): two-step (category grid → template chips + form)
- Task CRUD: create, read, update, delete with confirmation
- Status cycling: todo → in_progress → completed → todo
- Status button color changes per state
- Recurring tasks auto-generate next instance on completion

### Data Features
- Export full JSON backup (categories + templates + tasks + activities + exportedAt)
- Import JSON backup (replaces all data in one transaction)
- Local date string helpers (avoids timezone issues)
- Activity tracking for all task operations

### Notifications
- Browser Web Notifications
- **Topbar bell icon** with unread-count badge opening a dropdown panel grouping tasks into Overdue / Today / Due soon, with a footer Enable-permission button
- Settings → Notifications & Popups shows a **live permission status row** (Enabled / Blocked / Off / Not supported)
- Enable flow: `requestNotificationPermission()` returns the resulting state (`unsupported`/`granted`/`denied`/`default`); the `Enable` button renders only when permission is requestable (`Notification.permission === 'default'`); after requesting, the settings view re-renders so the status updates immediately
- Periodic checker every 30 seconds; smart firing (each reminder fires once)
- Configurable via `todoMeva_notify_prefs.reminders` / `.onboarding`

### Theme, Brand & Language
- Light/Dark toggle with CSS custom properties, persisted in `todoMeva_theme`
- 3 brand palettes (Orange/Blue/Emerald), persisted in `todoMeva_brand`
- Theme + brand applied early in `<head>` to prevent flash
- Trilingual UI via `todoMeva_lang`

### Settings — 8 Sections
1. **Account** — profile name/email edit form (`todoMeva_profile`)
2. **Appearance / App Color** — dark mode + palette chips (segmented)
3. **Language** — en / mr / hi segmented picker
4. **Notifications & Popups** — reminders toggle, onboarding popups toggle, live permission status row with working Enable flow
5. **Multi-Device Sync** — Supabase URL + anon key form, sync now, disconnect, live status dot (disconnected/connected/syncing/error), embedded schema SQL with copy button
6. **Data** — export / import
7. **Danger Zone** — Clear all data (must type DELETE), Reset preferences — rows match the global settings rhythm (12px padding, 8px gap)
8. **About** — version info + Open Landing Page

### Multi-Device Sync (opt-in)
- Config validated against `^https://([a-zA-Z0-9-]+\.)+supabase\.co$`
- Push: debounced upsert of all local rows as `entity:<uuid>` docs (`onConflict: 'id'`)
- Pull: select ordered by `updated_at`, applies remote changes, remaps numeric IDs, handles `deleted` tombstones
- Realtime: channel `todomeva-sync` (postgres_changes) triggers re-apply
- Fallback: 30s poll + reconnect on `online` event
- Status: `disconnected | connected | syncing | error` with last-sync timestamp; errors persisted and re-rendered (never wiped by refresh)
- Disconnect clears + removes `todoMeva_sync`; App code stays stable with no config

---

## Mobile UI/UX (≤ 620px)

- **Sidebar**: Full-screen, slides from left, dark backdrop, brand separated with border
- **Topbar**: Wraps, eyebrow hidden, action buttons collapse
- **Task cards**: Badge moves below title, compact padding
- **Modals**: Bottom sheet style (slide up, rounded top corners)
- **Quick create**: Single column, full-width
- **Category grid**: Single column, horizontal cards (icon + name)
- **Info cards**: Compact grid layout (icon left, title + description right)
- **FAB**: Centered at bottom thumb-reach
- **Tagline**: Full-width wrapping pill
- **Footer**: Stacked vertically, credit in middle
- **Stats**: 2-column grid
- **Landing hero**: Compact headline, full-width CTA, smaller preview

---

## All Design Decisions (Chronological)

| Step | Choice | Selected Option |
|------|--------|----------------|
| 1 | App foundation | Vanilla SPA (no build) |
| 2 | File structure | Documented module layout |
| 3 | Styling approach | Tailwind CDN + local CSS fallback → later switched to pure local CSS |
| 4 | Storage | Dexie IndexedDB |
| 5 | First scope | Full documented app |
| 6 | Build order | Data → UI → Features |
| 7 | Dev server | npx http-server |
| 8 | Dependencies | Vendored local browser builds |
| 9 | Vendoring method | Download browser builds |
| 10 | Flat UI palette | Warm productivity |
| 11 | Reminder UI | Topbar button |
| 12 | Run check | Started server on port 3000 |
| — | Logo & favicon | Minimal checklist + checkmark SVG |
| — | Design direction | Switched from glassmorphism to warm flat UI |
| — | Mobile UI | Rebuilt for compact view: bottom-sheet modals, centered FAB, compact info cards, stacked footer |
| — | Landing page | Short hero, 4 info cards, tagline, footer |
| 13 | DB upgrades | v2 → v3 adds `uuid` to all 4 tables (sync enables stable identity) |
| 14 | Settings | Full 8-section Settings page |
| 15 | i18n | Trilingual from day one (en/mr/hi) via `data-i18n` + `t()` |
| 16 | Brand palettes | Accent swaps via `[data-brand]` CSS overrides (Orange/Blue/Emerald) |
| 17 | Sync model | Bring-your-own Supabase — URL + anon key pasted at runtime |
| 18 | Sync data shape | `sync_docs` keyed `entity:<uuid>`, upsert push, tombstone deletes, realtime + polling |
| 19 | Sync auth posture | Unauthenticated anon access accepted (user-owned single-person project) |
| 20 | Notification UI | Topbar bell + unread badge + dropdown panel (replaces bare topbar request button) |
| 21 | Notification enable | Enable button only when requestable; settings re-renders to live status after request |
| 22 | Settings width | Removed 860px cap — Settings matches dashboard `.main-panel` width |
| 23 | i18n quality | mr/hi rewritten as natural everyday language (due prefix, repeat phrases, ॲप spelling) |
| 24 | Danger Zone rhythm | Wrapper `#danger-main` → grid, so the two danger rows get the same 8px gap / 12px padding as every other settings row |

---

## Server & Access

- **URL:** `http://localhost:3000/`
- **Command:** `npx --yes http-server -p 3000 -c-1 --cors`
- **Refresh:** `Ctrl+F5` (hard refresh after changes)

---

## Verification

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
1. Launch App renders dashboard, not a blank shell
2. Sidebar category counts show
3. Light/Dark toggle persists after refresh
4. Ctrl+K or FAB opens Quick Add; X and Cancel close it
5. Dashboard quick create adds a task
6. Task card click opens edit modal
7. Status checkbox cycles task state
8. Export downloads JSON
9. Settings renders 8 sections; language + palette switches persist after refresh
10. Sync error path: invalid URL shows persistent validation message; unreachable host surfaces fetch error without breaking the Settings view
11. Settings top edge aligns with dashboard (same `.main-panel` width)
12. Danger Zone rows: 12px padding each + 8px gap between them (same rhythm as other cards)
13. Notifications: granted permission → status row reads "Status: Enabled" (not "Off + Enable"); Enable button only when permission is requestable

---

## Known Issues / Future Work

- [ ] Category deletion does not reassign existing tasks (orphaned categoryId)
- [ ] Custom recurrence with specific days of week not in UI
- [ ] No drag-and-drop reordering of tasks
- [ ] No task search / full-text search
- [ ] Sync uses unauthenticated anon access — fine for a personal project, switch to Supabase Auth for shared/multi-user later
- [ ] Third-party CDN (Google Fonts) can fail offline

---

## Git

- **Remote:** `https://github.com/kuldeep7ke/todomeva.git` — **Branch:** `main`
- **HEAD:** `c98a2c3` "Rebuild Todo Meva with warm flat UI, offline-first Dexie storage, 8 categories, 48 templates, task CRUD, recurring tasks, reminders, import/export, responsive mobile layout"
- **Uncommitted:**
  - Modified: `index.html`, `css/style.css`, `js/app.js`, `js/components.js`, `js/db.js`, `js/recurrence.js`, `js/reminder.js`, `js/views.js`
  - Untracked (post-HEAD modules): `js/i18n.js`, `js/prefs.js`, `js/account.js`, `js/sync.js`, `supabase/schema.sql`, `vendor/supabase.min.js`
  - Cleanup: `.playwright-mcp/`, root screenshot `*.png` files (dev artifacts)

---

## ToDo / Handoff Notes

- **Commit pending:** the working tree contains the i18n/prefs/account/sync modules plus all session fixes (notif enable flow, URL-safe cache versions, settings width + Danger Zone). A commit should split cleanup of `.playwright-mcp/` + root PNGs.
- **Live sync test pending:** create a TodoMeva Supabase project, run `supabase/schema.sql` in the SQL Editor, paste Project URL + anon key into Settings → Multi-Device Sync, then sync between two devices. (Config validation, failure paths, and wipe/Danger-Zone flows already verified locally.)