# Design Spec: Create/Edit Task Modal — Direction A

- **Status:** Draft (pending review)
- **Date:** 2026-09-14
- **Designer-approved:** yes (iterative visual preview, `session visual-20260914-002001`, Direction A chosen and iterated to approval)
- **Scope:** Redesign the **Create/Edit Task modal dialog** only.
- **Non-goals:** Dashboard "Quick create" mini form, category-chooser first screen, templates/generic chooser screen, task cards, landing page, sidebar. No data-model changes, no new dependencies.

---

## 1. Background & problem

Users found the task modal unclear and cramped. Confirmed issues, in priority order:

1. **Field labels invisible** — title/description are placeholder-only; no labels, no required marker. Placeholders vanish once typed.
2. **No hierarchy** — a flat wall of controls with no sections; several pickers are identical and indistinguishable at a glance.
3. **Picker panels get clipped** — opening a dropdown/calendar near the modal's bottom edge is sliced off. *Root cause:* `.modal-card` is `overflow: auto` (`css/style.css:330`) while `.cat-picker-menu` is `position: absolute` (`css/style.css:265`) inside it — the modal's scroll container clips the panels.
4. **Vertical crampedness** — modal `max-height: calc(100vh - 36px)` + tall content forces internal scrolling; there is no pinned action footer (only a bare Save button near the content).
5. **Template chips feel tacked-on** — `.template-chip` (style.css:324) is oversized relative to other controls, unmessaged, has no visible active state, and no way to undo a prefill.
6. **Weak finish & validation feedback** — bare Save button, no hint for the Submit shortcut, no * required convention.

Header redundancy: "Kids" (eyebrow) + "New Task" (h3) rendered as two lines in two different styles; user requested a single line, single style ("Kids, New Task").

## 2. Approved design

Verified visually with the app's real tokens (warm cream theme) in `direction-a-preview.html`. Summary:

### 2.1 Header (one line, one font/size)
`<h3><span class="hdr-accent">Kids,</span> New Task</h3>` — same size/weight as the normal h3; only the leading label is colored with `var(--accent-strong)`.

- **Create modal:** `<span class="hdr-accent">${category.name},</span> ${t('create_task')}`.
- **Edit modal:** `<span class="hdr-accent">${t('edit_task')}:</span> ${task.title}` (same single-line treatment; drops the existing eyebrow).
- `.hdr-accent { color: var(--accent-strong); }` — no uppercase, no letter-spacing, same font-size/weight as siblings.

### 2.2 Quick task chips (replaces "Templates")
- Small uppercase field label above the row: `Quick task` (key `field_quick_task`).
- Chips stay right-aligned under the label, compact (in-line height with other controls ~44px controls; radius 999px, padding tightened from the current `0.5rem 0.8rem`).
- **Tap a chip** → form prefills (title/description/priority/`templateId`), chip gets `.active` (accent-soft background, accent border, leading check icon).
- **Active chip carries a ×** inside it → clears the prefill (drops `.active`, resets title/description/priority/`templateId` to defaults/first option).
- No separate "applied · Clear" line (remove that idea entirely).
- Keyboard: arrow keys move focus across chips, Enter toggles.

### 2.3 Field labels + required mark (all fields)
- Every control gets a visible small label above it: `Task title *`, `Description`, `Category`, `Priority`, `Due date`, `Repeat`, `Reminder`, `Focus`.
- Required uses a red `*` and `aria-label` "required" on the title input.
- Labels use the existing small-caps muted style (mirror `.sidebar-title`/`.section-label` intent: `0.72–0.78rem`, weight 800, uppercase, `letter-spacing ~0.08em`).

### 2.4 Grouping
- Only one group title remains: **`Details`** above the picker grid.
- The "Task" section heading is removed (title/description sit directly under the Quick task chips; title is pulled up tight under the chip row).

### 2.5 Details grid — distinguishable pickers
- Two-column grid (`.two-col`) for Category/Priority and Due date/Repeat; Reminder and Focus are full-width rows (as today) but **each picker gains its own leading icon** so rows are distinguishable:
  - Category: keeps its color dot (existing `renderCategoryPicker`).
  - Priority: `flag` | Due date: `calendar` (already accent-colored) | Repeat: `repeat` | Reminder: `bell` | Focus: `timer`.
- `renderPicker(name, label, options, selectedValue, iconName)` — when `iconName` is supplied, render `<i data-lucide="${iconName}"></i>` before the label span; existing single-arg behavior preserved.
- Placeholder/label convention unchanged: hidden input keeps the real value; trigger shows selected label + chevron.

### 2.6 Focus replaces the numeric input
- The `focusMinutes` **number input** (components.js:518) is replaced by a picker: options **Off / 15 / 25 / 45 / 60** (`focus_off`, `focus_15`, `focus_25`, `focus_45`, `focus_60`).
- Values map directly to minutes; **Off = value `''`**. `formToTask` already coerces `Number('') || 0` → `0`, so no change needed there (`js/components.js:535`).

### 2.7 Popover clipping fix (portal)
- Menu/calendar panels open into a **body-level popover layer** (`<div class="popover-layer">`, `position: fixed; z-index: 50;` appended once) instead of inside `.modal-card`'s overflow context.
- The layer sits above the `.modal-backdrop` (z-index 40, style.css:329). No ancestor creates a containing block for `fixed` (verified: no transform/filter/will-change on `.modal-backdrop`/`.modal-card`).
- Behavior:
  - On trigger open: measure trigger `getBoundingClientRect()`, position `.cat-picker-menu`/`.date-picker .cat-picker-menu` fixed just below it (same `top: calc(100% + 6px)` visual gap), width at least trigger width (calendar keeps `min(284px, calc(100vw - 48px))`).
  - Close on: outside click, `Escape`, modal scroll, modal close, selection, form submit.
  - `aria-expanded` toggles on the trigger; focus returns to trigger on close.
  - Reuse existing menu markup + `bindCategoryPickers`/`bindDatePickers` handlers, redirecting render target to the layer.

### 2.8 Modal footer (pinned actions)
- `.modal-footer`: hairline top border (`1px solid var(--border)`), flex row, space-between.
- Left: muted hint `Ctrl+Enter to save · * required` (key `form_footer_hint`).
- Right: **Cancel** (ghost/border button, closes modal) + **Save task** (existing `.btn-primary`).
- Edit modal keeps its Delete task button (existing `.btn-danger` + `hero-actions`), placed in the footer group.
- Modal keeps the header × close button.

### 2.9 Layout & rhythm
- `.modal-card` stays `width: min(560px, 100%)` (verified actual; the "too wide" finding was wrong at 560px). `max-height`/`overflow: auto` stay for small screens.
- With labels + grouped grid, content fits without internal scroll on normal screens (approved preview).
- Vertical rhythm tightened (12px grid gap, ~4px above the header-adjacent title label).

### 2.10 Visual example
See approved preview: `C:\Users\Admin\Documents\Meva\ToDoMeva\.superpowers\brainstorm\visual-20260914-002001\content\direction-a-preview.html` (serve: `http://localhost:53200`).

---

## 3. Technical changes

| File | Change |
|---|---|
| `js/i18n.js` | Add keys below to `en`, `mr`, `hi`; keep `t()` zero-arg (no interpolation). |
| `js/components.js` | Rewrite `taskForm` (~line 503): labels, single-line header, Quick task chips w/ active+clear, icon-carrying pickers, Focus picker, `.modal-footer`. Add `popover-layer` open/close logic to `bindCategoryPickers`/`bindDatePickers`; chip active/clear logic in `handleQuickAddClick`; edit modal header per 2.1. |
| `css/style.css` | `.hdr-accent`; `.flabel`/label class; `.template-chip.active` + chip ×; `.modal-footer`; `.popover-layer`; picker-row icon spacing; tighten `.template-chip` padding; keep all dark-theme + media-query parity (mobile bottom-sheet, style.css:420–434). |
| `index.html` | No change (no version query strings in use). |

### New i18n keys (en / mr / hi)
| Key | en | mr | hi |
|---|---|---|---|
| `field_quick_task` | Quick task | पटकन काम | क्विक काम |
| `field_task_title` | Task title | कामाचे नाव | काम का नाम |
| `field_description` | Description | तपशील | विवरण |
| `field_focus` | Focus | फोकस | फोकस |
| `focus_off` | Off | बंद | बंद |
| `focus_15` | 15 min | १५ मि | 15 मिन |
| `focus_25` | 25 min | २५ मि | 25 मिन |
| `focus_45` | 45 min | ४५ मि | 45 मिन |
| `focus_60` | 60 min | ६० मि | 60 मिन |
| `cancel` | Cancel | रद्द करा | रद्द करें |
| `form_footer_hint` | Ctrl+Enter to save · * required | Ctrl+Enter दाबा · * आवश्यक | Ctrl+Enter दबाएँ · * आवश्यक |
| `required` | required | आवश्यक | आवश्यक |
| `clear_quick_task` | Clear quick task | क्विक काम साफ करा | क्विक काम साफ़ करें |

Existing keys reused: `quick_add_eyebrow`, `choose_category`, `create_task`, `edit_task`, `no_due_date`, `clear`, `save_task`, `delete_task`, `priority_*`, `no_repeat`/`daily`/`weekly`/`monthly`/`yearly`, `no_reminder`/`reminder_*`, `task_title_placeholder`, `description_placeholder` (placeholders still used as secondary text where helpful).

### Form data contract (unchanged)
`formToTask` (components.js:524) continues to read `title`, `description`, `categoryId`, `templateId`, `priority`, `dueDate`, `recurrence`, `reminders`, `focusMinutes`. Focus picker uses `name="focusMinutes"` with `''` for Off. `data-template` chip prefill keeps setting `form.title/.description/.priority/.templateId`.

---

## 4. Accessibility
- Real `<label>`s (or `aria-label` where layout prevents) on every control; `*` marked with `aria-hidden` + a screen-reader `required` label on title.
- Focus picker remains an accessible menu list (existing `.cat-option` pattern, keyboard navigable).
- `.popover-layer` menus: `aria-expanded` on triggers, `Escape` close, focus return, outside-click close (focusable options keep working).
- Chips: buttons with proper `type="button"`, × labeled by `clear_quick_task`; visible focus ring preserved (`:focus-visible`).
- Mobile: keep bottom-sheet behavior (style.css:423–434); footer stacks to full width.

## 5. Verification (acceptance criteria)
- **Clipping:** open the calendar from a full form; it renders fully below the trigger, past the modal edge, unclipped; closes on outside click/Escape/scroll/selection.
- **Create flow:** category chooser → create modal shows single-line "$category, New Task"; Quick task chips prefill on tap, × clears; all fields labeled; * required on title.
- **Edit flow:** open an existing task — header "$Edit task: $title" single line; existing values render in the pickers; Save updates; Delete still works.
- **Focus:** picker shows Off/15/25/45/60; saving "Off" writes `focusMinutes: 0`.
- **i18n:** switch to mr and hi; new strings appear, no missing-key breaks, focus options localized.
- **No regressions:** dashboard quick-create mini form untouched; dark theme + mobile viewport render correctly (browser-device check); no console errors; `flutter` not involved (vanilla JS app).
- **Keyboard:** Tab through modal; Enter submits (Ctrl+Enter shortcut hint), Escape closes popover then modal.

## 6. Notes / open questions
- Confirm edit-modal header wording ("Edit task: <title>") and Focus default (Off vs 25 min) during implementation review.
- Popover portal is the only architecturally significant change; keep it contained inside `bindCategoryPickers`/`bindDatePickers`.
- Out of scope per user: dashboard quick-add mini form, category chooser screen, all other screens.