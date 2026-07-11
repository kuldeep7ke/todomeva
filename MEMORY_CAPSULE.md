# Todo Meva — Memory Capsule

*Last Updated: 2026-07-11*

---

## Project Overview

Todo Meva is a feature-rich, single-user Productivity & To-Do Application with deep categorization, domain-specific smart presets (default captions/templates), robust scheduling, and reminder capabilities. Built as a offline-first SPA with glassmorphism UI.

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Storage | Dexie.js (IndexedDB wrapper) | 3.2.4 |
| UI Framework | Tailwind CSS (Play CDN, preflight disabled) | Latest |
| Icons | Lucide Icons (CDN) | Latest |
| Font | Inter (Google Fonts) | 400-800 wght |
| Language | Vanilla JavaScript (ES Modules) | ES2022 |
| Server | http-server (Node.js) | 14.x |
| Runtime | Node.js | — |

## Project Structure

```
Todo Meva/
├── index.html                    # Landing page + App shell + Onboarding
├── MEMORY_CAPSULE.md             # This file — project memory & state
├── assets/
│   └── color-palette.jpg         # Original color palette reference
├── css/
│   └── style.css                 # Complete glassmorphism theme
└── js/
    ├── app.js                    # App orchestration, navigation, events
    ├── db.js                     # Dexie DB schema v2, CRUD, activity tracking
    ├── seed.js                   # 8 categories + 48 templates + configs
    ├── components.js             # UI components: sidebar, cards, modals, onboarding
    ├── views.js                  # View renderers: dashboard, upcoming, category, priority
    ├── recurrence.js             # Recurring task calculation engine
    └── reminder.js               # Web Notifications API + periodic checker
```

## Architecture

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

## Database Schema (Dexie v2)

### Table: `categories`
```
++id, name, order, icon (Lucide name), color (hex)
```

### Table: `templates`
```
++id, categoryId, title, description, priority, order
```

### Table: `tasks`
```
++id, title, description, categoryId, templateId, priority,
status, dueDate, startDate, recurrence, reminders,
createdAt, updatedAt, completedAt, parentTaskId
```

### Table: `activities`
```
++id, type, taskId, taskTitle, categoryName, details, timestamp
```
Activity types: `task_created`, `task_completed`, `task_deleted`, `task_updated`, `task_recurred`

## Seed Data

8 Categories with Lucide icons and hex colors:
1. Bank & Finance (`landmark`, #3B82F6)
2. Farm & Agriculture (`sprout`, #22C55E)
3. Business (`briefcase`, #8B5CF6)
4. Work & Administrative (`building2`, #6366F1)
5. Personal (`user`, #14B8A6)
6. Family & Home (`home`, #F59E0B)
7. Kids (`baby`, #EC4899)
8. Education & Learning (`graduation-cap`, #06B6D4)

48 Smart Templates (6 per category on average) covering all domains.

## Color Palette

Original reference: `assets/color-palette.jpg`

| Role | Hex | Usage |
|------|-----|-------|
| Base dark | `#1B1B1D` | Body background, modal backgrounds |
| Warm dark | `#3D332F` | Glass panels, cards, sidebar |
| Orange accent | `#FF8A3D` | Buttons, FAB, active states, icons, primary accent |
| Light peach | `#FFCF9A` | Secondary accent, medium priority, hovers |
| Cream text | `#FFF6EC` | All text, headings, labels |

### Design System
- **Glass effect**: `backdrop-filter: blur(16-24px)` + `rgba(61,51,47,0.3-0.85)`
- **Glass borders**: `rgba(255,138,61,0.06-0.1)`
- **Success**: `#6ee7b7` (emerald) | **Error/Overdue**: `#f87171` (red)
- **Priority badges**: High=red, Medium=peach, Low=green

## Features Implemented

### Phase 1 — Architecture & Data
- [x] Dexie IndexedDB with version 2 schema
- [x] Seed data: 8 categories, 48 templates
- [x] Activity tracking table and CRUD
- [x] Export/Import full JSON backup

### Phase 2 — Core UI
- [x] Dark glassmorphism theme with animated background orbs
- [x] Responsive sidebar with nav + category list + counts
- [x] 4 views: Dashboard, Upcoming, Category Filter, Priority Matrix
- [x] Landing page with hero, mockup, feature cards, footer
- [x] 5-step onboarding walkthrough (first visit only)
- [x] Mobile hamburger menu

### Phase 3 — Task Management
- [x] Quick-Add modal (Ctrl+K or FAB): Category grid → Template chips → Form
- [x] Task CRUD: create, read, update, delete with confirmation
- [x] Status cycling: todo → in_progress → completed → todo
- [x] Category CRUD: add custom categories with icon/color prompts
- [x] Task filtering by category, priority, status
- [x] Smart templates auto-fill title, description, priority

### Phase 4 — Advanced Logic
- [x] Recurring tasks: Daily/Weekly/Monthly/Yearly auto-generation on completion
- [x] Web Notifications reminders (15min/30min/1h/2h/1d/2d before due)
- [x] Periodic reminder checker (30s interval)
- [x] Activity-powered dashboard with stats, streak calculation, recent feed
- [x] Category distribution bar chart
- [x] Timezone-aware date queries (local date strings)

## Key Files & Their Responsibilities

### `index.html`
Entry point. Contains landing page (#landing-page), app shell (#app-shell), modals, and onboarding overlay (#onboarding-overlay). Scripts loaded in order: Tailwind (preflight disabled) → Dexie → Lucide → app.js (module).

### `js/app.js`
Orchestrator. Defines `window.__enterApp()` for landing→app transition. Sets `window.refreshCurrentView` for global re-rendering. Wires sidebar nav, category clicks, FAB, keyboard shortcuts (Ctrl+K, Escape), export/import, mobile menu, and reminder interval.

### `js/db.js`
Database layer. Dexie schema v2 with 4 tables. Exports all CRUD functions and helper queries. Key helpers: `localDateStr()`, `localDateTimeStr()` for consistent local-time comparisons (fixes timezone mismatch between `toISOString()` UTC and user-entered local dates).

### `js/components.js`
UI components. Renders sidebar, task cards, task lists, quick-add modal (2-step), task-detail/edit modal, onboarding steps. Handles all task CRUD event wiring. Exports `toggleTaskStatus`, `deleteTaskById`, `openQuickAdd`, `openTaskDetail`, `showOnboarding`.

### `js/views.js`
View renderers. Dashboard (stats + activity feed + overdue/today/upcoming + distribution chart), Upcoming (30-day chronological grouped), Category Filter, Priority Matrix. Each view fetches data and renders via `renderTaskCard`.

### `js/seed.js`
Initial data: 8 SEED_CATEGORIES and 48 SEED_TEMPLATES. Also exports `PRIORITY_CONFIG` and `STATUS_CONFIG` for consistent badge styling.

### `js/recurrence.js`
Recurrence engine. `calculateNextOccurrence()` computes next due date based on recurrence rule. `createRecurringTaskInstance()` clones a task with reset status and new dates.

### `js/reminder.js`
Notification system. `checkAndFireReminders()` checks each task's reminders, fires Web Notifications for due ones, and saves the triggered flag to DB.

## Known Limitations / Future Work

- [ ] Category deletion does not reassign tasks (orphaned categoryId)
- [ ] Custom recurrence with specific days of week not in UI
- [ ] Timezone edge cases around midnight boundary
- [ ] No drag-and-drop reordering of tasks
- [ ] No task search/full-text search
- [ ] No dark/light theme toggle (dark-only currently)

## Git & Deployment

- Remote: `https://github.com/kuldeep7ke-eng/Todo-Meva.git`
- Branch: `main`
- Serve: `npx http-server -p 3000 -o --cors`
- Access: `http://127.0.0.1:3000`

## Commands Reference

```bash
# Start development server
npx http-server -p 3000 -o --cors

# Push updates (run after changes)
git add -A
git commit -m "description of changes"
git push
```
