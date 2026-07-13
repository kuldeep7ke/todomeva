# Todo Meva — Memory Capsule

*Last Updated: 2026-07-13*

---

## Project Overview

Todo Meva is a feature-rich, single-user Productivity & To-Do Application with 8 smart categories, 48 domain-specific templates, scheduling, recurrence, reminder capabilities, and a persistent light/dark theme. Built as an offline-first SPA with a warm flat UI design system.

---

## Tech Stack

| Layer | Technology | Version | Source |
|-------|-----------|---------|--------|
| Storage | Dexie.js (IndexedDB wrapper) | 3.2.4 | `vendor/dexie.min.js` |
| Icons | Lucide Icons | Latest | `vendor/lucide.min.js` |
| Font | Inter (Google Fonts) | 400–800 wght | CDN |
| Language | Vanilla JavaScript (ES Modules) | ES2022 | — |
| Server | http-server (Node.js) | 14.x | `npx --yes http-server -p 3000 -c-1 --cors` |

---

## Project Structure

```
Todo Meva/
├── index.html                    # Landing page + App shell + Modals + Onboarding
├── MEMORY_CAPSULE.md             # This file — full project memory
├── FROM_SCRATCH.md               # Build plan & step-by-step progress
├── assets/
│   ├── favicon.svg               # SVG favicon (checklist + checkmark)
│   ├── logo.svg                  # App brand logo
│   └── palette.md                # Flat UI color reference
├── css/
│   └── style.css                 # Warm flat UI system + responsive breakpoints
├── js/
│   ├── app.js                    # Orchestrator: init, navigation, events, theme, export/import
│   ├── db.js                     # Dexie IndexedDB schema v2, CRUD, activity tracking
│   ├── seed.js                   # 8 categories + 48 smart templates
│   ├── components.js             # UI: sidebar, task cards, quick add, edit modal, onboarding
│   ├── views.js                  # View renderers: dashboard, upcoming, category, priority
│   ├── recurrence.js             # Recurring task calculation engine
│   └── reminder.js               # Web Notifications API + periodic checker
└── vendor/
    ├── dexie.min.js              # Dexie 3.2.4 local browser build
    └── lucide.min.js             # Lucide local browser build
```

---

## Design System

### Flat UI Palette

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

### Design Tokens
- Border radius: 22px (cards), 999px (buttons/badges), 18px (task cards)
- Shadow: `0 18px 45px rgba(67, 48, 33, 0.12)`
- Font: Inter, system-ui sans-serif
- Theme persisted in `localStorage.todoMeva_theme`

---

## Module Architecture

### Dependency Graph
```
index.html → app.js
              ├── db.js (database layer)
              ├── seed.js (initial data)
              ├── components.js (UI components)
              │   ├── db.js
              │   ├── seed.js (config only)
              │   └── recurrence.js
              ├── views.js (view renderers)
              │   ├── db.js
              │   └── components.js
              └── reminder.js (notifications)
                  └── db.js
```
No circular dependencies.

---

## Database Schema (Dexie v2)

**DB name:** `TodoMevaDB`
**Version:** 2

### Table: `categories`
```
++id, name, icon, color, order
```

### Table: `templates`
```
++id, categoryId, title, description, priority, order
```

### Table: `tasks`
```
++id, title, description, categoryId, templateId, priority, status,
dueDate, startDate, recurrence, reminders, createdAt, updatedAt,
completedAt, parentTaskId
```

### Table: `activities`
```
++id, type, taskId, taskTitle, details, timestamp
```
Activity types: `task_created`, `task_completed`, `task_deleted`, `task_updated`, `task_recurred`

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

48 templates total (6 per category).

---

## Features

### App Shell
- Landing page with hero, info cards, tagline, footer
- App shell with sidebar + main panel + FAB
- Responsive: desktop (side-by-side), tablet (sidebar overlay), mobile (full-screen)
- Landing page: eyebrow badge, headline, feature summary, preview card, 4 info cards, tagline, footer with brand/credit/links

### Views (4)
1. **Dashboard** — Stats (open/due/overdue/completed), quick create form, overdue/today/open task sections
2. **Upcoming** — Chronological list of future dated tasks (30 days)
3. **Category** — Filter tasks by category (click from sidebar)
4. **Priority Matrix** — Columns for high/medium/low priority

### Task Management
- Quick Add (Ctrl+K or FAB): two-step (category grid → template chips + form)
- Task CRUD: create, read, update, delete with confirmation
- Status cycling: todo → in_progress → completed → todo
- Status button color changes per state
- Recurring tasks auto-generate next instance on completion

### Data Features
- Export full JSON backup
- Import JSON backup (replaces all data)
- Local date string helpers (avoids timezone issues)
- Activity tracking for all task operations

### Notifications
- Browser Web Notifications
- Request permission button in topbar
- Periodic checker every 30 seconds
- Smart firing (only fires each reminder once)

### Theme
- Light/Dark toggle with CSS custom properties
- Persisted in localStorage
- Applied early in `<head>` to prevent flash
- Dark mode uses adjusted warm-dark values

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
| — | Mobile UI | Rebuilt for compact view: bottom-sheet modals, centered FAB, compact info cards, stacked footer with credit in middle |
| — | Landing page | Short hero, 4 info cards, tagline, footer |

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

---

## Known Issues / Future Work

- [ ] Category deletion does not reassign existing tasks (orphaned categoryId)
- [ ] Custom recurrence with specific days of week not in UI
- [ ] No drag-and-drop reordering of tasks
- [ ] No task search / full-text search
- [ ] Notification permission button hidden on very small screens (≤ 620px)
- [ ] No settings / preferences page
- [ ] Third-party CDN (Google Fonts) can fail offline

---

## Git

- **Remote:** `https://github.com/kuldeep7ke-eng/Todo-Meva.git`
- **Branch:** `main`
- **Files currently untracked** (no commits made)
