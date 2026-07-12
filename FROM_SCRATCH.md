# Todo Meva — From Scratch Guide

Last updated: 2026-07-12

## What This App Is

Todo Meva is an offline-first vanilla JavaScript to-do/productivity SPA. It uses IndexedDB through Dexie for local persistence, Lucide for icons, Tailwind utility classes with local fallback CSS, and a custom glassmorphism design system with persistent light/dark themes.

## Run Locally

```powershell
npx --yes http-server -p 3000 -c-1 --cors
```

Open:

```text
http://localhost:3000/
```

Use a hard refresh after code changes:

```text
Ctrl+F5
```

## Required Files

```text
index.html
css/style.css
js/app.js
js/db.js
js/seed.js
js/components.js
js/views.js
js/recurrence.js
js/reminder.js
assets/palette.md
MEMORY_CAPSULE.md
```

## Load Order

1. `index.html` applies saved theme early with `data-theme`.
2. External scripts load: Tailwind CDN, Dexie CDN, Lucide CDN.
3. Inline `window.__enterApp` fallback lets Launch App reveal the shell before modules finish.
4. `js/app.js?v=4` loads the ES module graph.
5. `initApp()` seeds IndexedDB, renders the active view, renders sidebar counts, then wires events.

## Module Graph

```text
index.html
└── js/app.js
    ├── js/db.js
    ├── js/seed.js
    ├── js/components.js
    │   ├── js/db.js
    │   ├── js/seed.js
    │   └── js/recurrence.js
    ├── js/views.js
    │   ├── js/db.js
    │   └── js/components.js
    └── js/reminder.js
        └── js/db.js
```

All module imports currently use `?v=4` cache-busting. Keep versions consistent across the module graph to avoid duplicate module instances.

## Core Flows

### Launch App

`window.__enterApp()` hides `#landing-page`, shows `#app-shell`, places a loading state in `#view-content`, then calls `initApp()`.

### Init

`initApp()` is guarded by `initPromise` to avoid duplicate event listeners. It seeds the DB, renders dashboard/sidebar, optionally shows onboarding, then wires all app events.

### Dashboard

`renderDashboard()` fetches categories/tasks, computes task groups locally, renders quick create, category cards, stats, today/overdue/other sections, and attaches task card events.

### Quick Add

`openQuickAdd()` shows the modal and calls `renderQuickAddForm()`.

Quick Add has two steps:

1. Category grid
2. Template chips + task form

Close is handled by delegated `container.onclick` on `#quick-add-body` for `.close-modal-btn`.

### Theme

`applyTheme()` and `toggleTheme()` live in `js/app.js`.

Theme is stored in:

```text
localStorage.todoMeva_theme
```

CSS variables live in:

```text
css/style.css :root
css/style.css [data-theme="light"]
```

## Database

Dexie database name:

```text
TodoMevaDB
```

Tables:

```text
categories
templates
activities
```

Seed data is added only when `categories.count() === 0`.

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
```

Quick browser checks:

1. Launch App renders dashboard, not a blank shell.
2. Sidebar category counts show.
3. Light/Dark Mode toggle changes theme and persists after refresh.
4. `+` opens Quick Add; X and Cancel close it.
5. Dashboard quick create adds a task.
6. Task card click opens edit modal.
7. Status checkbox cycles task state.
8. Export downloads JSON.

## Known Risks

- Dexie and Lucide still load from CDN; if those fail, DB/icons can break.
- Tailwind CDN can fail, but essential utility classes are locally duplicated in `css/style.css`.
- Notification permission is not requested at startup; add an explicit permission button if needed.
- Category deletion still does not reassign existing tasks.

## Git Push Flow

```powershell
git status --short
git diff
git log --oneline -10
git add <intended files>
git commit -m "Update dashboard flow and theme support"
git push
```
