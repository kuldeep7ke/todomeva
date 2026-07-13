# Todo Meva — From Scratch Build Plan

Last updated: 2026-07-13

---

## Project Overview

Todo Meva is an offline-first vanilla JavaScript to-do/productivity SPA. It uses Dexie (IndexedDB) for local persistence, Lucide for icons, a custom warm flat UI design system, and persistent light/dark themes.

---

## Design Choices (Made by User)

Each choice was selected step-by-step:

1. **Foundation**: Vanilla SPA (HTML/CSS/JS ES modules, no build step)
2. **Structure**: Documented module layout (app.js, db.js, seed.js, components.js, views.js, recurrence.js, reminder.js)
3. **Styling**: Warm flat UI design (replaced original glassmorphism)
4. **Storage**: Dexie IndexedDB with 4 tables (categories, templates, tasks, activities)
5. **Scope**: Full documented app (landing, dashboard, views, recurrence, reminders, import/export)
6. **Build order**: Data → UI → Features
7. **Dev server**: npx http-server -p 3000 -c-1 --cors
8. **Dependencies**: Vendored local browser builds (Dexie + Lucide)
9. **Palette**: Warm productivity (off-white bg, orange accent, charcoal text)

### Landing Page Decisions

- Hero: eyebrow badge + headline + feature summary + preview card
- Info cards: 4 vertical cards on desktop, compact icon-left layout on mobile
- Tagline: "Everything stays on your device. No accounts. No cloud. No distractions."
- Footer: brand + credit line + links (Launch App, GitHub)

---

## File Structure

```
Todo Meva/
├── index.html                   # Landing page + App shell + Modals + Onboarding
├── FROM_SCRATCH.md              # This file — build plan & progress
├── assets/
│   ├── favicon.svg              # SVG favicon (checklist + checkmark)
│   ├── logo.svg                 # App brand logo (same icon as favicon)
│   └── palette.md               # Flat UI color palette reference
├── css/
│   └── style.css                # Flat UI system + responsive breakpoints
├── js/
│   ├── app.js                   # Orchestrator: init, navigation, events, theme, export/import
│   ├── db.js                    # Dexie IndexedDB schema v2, CRUD, activity tracking
│   ├── seed.js                  # 8 categories + 48 smart templates
│   ├── components.js            # UI: sidebar, task cards, quick add, edit modal, onboarding
│   ├── views.js                 # View renderers: dashboard, upcoming, category, priority
│   ├── recurrence.js            # Recurring task calculation engine
│   └── reminder.js              # Web Notifications API + periodic checker
└── vendor/
    ├── dexie.min.js             # Dexie 3.2.4 local browser build
    └── lucide.min.js            # Lucide local browser build
```

---

## App Architecture

### Data Flow
```
User Action → Event Handler → DB Operation → Re-render View
                                ↕
                         Dexie IndexedDB
                        (categories, templates, tasks, activities)
```

### Module Dependency Graph
```
index.html → app.js
              ├── db.js
              ├── seed.js
              ├── components.js
              │   ├── db.js
              │   ├── seed.js (config only)
              │   └── recurrence.js
              ├── views.js
              │   ├── db.js
              │   └── components.js
              └── reminder.js
                  └── db.js
```

---

## Database Schema (Dexie v2)

### Table: `categories`
| Field | Type |
|-------|------|
| id | ++id |
| name | String |
| icon | String (Lucide name) |
| color | String (hex) |
| order | Number |

### Table: `templates`
| Field | Type |
|-------|------|
| id | ++id |
| categoryId | Number |
| title | String |
| description | String |
| priority | String |
| order | Number |

### Table: `tasks`
| Field | Type |
|-------|------|
| id | ++id |
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
| type | String |
| taskId | Number |
| taskTitle | String |
| details | String |
| timestamp | String |

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

48 Smart Templates (6 per category).

---

## Theme & Color System

### Flat UI Palette

| Role | Hex | Usage |
|------|-----|-------|
| Background | #f7f3ee | Body background |
| Surface | #ffffff | Cards, sidebar, modals |
| Soft surface | #fff8ef | Soft card backgrounds |
| Text | #2d2a24 | Main text |
| Muted | #7c7164 | Secondary text |
| Border | #e6d9ca | Card/section borders |
| Accent | #f97316 | Buttons, active states |
| Accent strong | #ea580c | Button hover |
| Success | #16a34a | Low priority, completed |
| Warning | #d97706 | Medium priority |
| Danger | #dc2626 | High priority, overdue |

- Theme preference persists in `localStorage.todoMeva_theme`
- Early script in `<head>` applies theme to prevent flash
- Dark mode uses adjusted warm-dark values

---

## Features Implemented

### Phase 1 — Data Layer
- [x] Dexie IndexedDB v2 schema (categories, templates, tasks, activities)
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
- [x] Web Notifications reminders (request button in topbar)
- [x] Periodic reminder checker (30s interval)
- [x] Dashboard with stats, quick create, today/overdue/other sections
- [x] Export/Import full JSON backup
- [x] Dashboard name hidden on mobile

### Phase 5 — Mobile UI/UX (Latest)
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

---

## Local Development

### Start server
```powershell
npx --yes http-server -p 3000 -c-1 --cors
```

### Open
```
http://localhost:3000/
```

### Hard refresh after changes
```
Ctrl+F5
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
```

---

## Known Issues / Future Work

- [ ] Category deletion does not reassign tasks (orphaned categoryId)
- [ ] Custom recurrence with specific days of week not in UI
- [ ] No drag-and-drop reordering of tasks
- [ ] No task search/full-text search
- [ ] Notification permission button in topbar hidden on very small screens
- [ ] No settings page

---

## Git

Remote: `https://github.com/kuldeep7ke-eng/Todo-Meva.git`
Branch: `main`
