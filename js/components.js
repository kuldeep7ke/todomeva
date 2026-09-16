import { addTask, archiveTask, getCategories, getTask, getTasks, getTemplatesByCategory, getHistory, localDateStr, permanentDeleteTask, restoreTask, sendToPending, resumeFromPending, setTaskStatus, startFocus, stopFocus, updateCategory, updateTask, addSpecialDay, updateSpecialDay, getSpecialDays, archiveSpecialDay, restoreSpecialDay, permanentDeleteSpecialDay } from './db.js?v=8';
import { PRIORITY_CONFIG, STATUS_CONFIG } from './seed.js?v=6';
import { createRecurringTaskInstance } from './recurrence.js?v=7';
import { getLang, t } from './i18n.js?v=14';
import { isPrefEnabled } from './prefs.js?v=5';
import { pushDeletion } from './sync.js?v=11';
import { getProfile, saveProfile } from './account.js?v=4';
import { confirmDialog } from './dialog.js?v=2';

export const STATUS_ORDER = ['not_started', 'in_progress', 'done'];
export const NEXT_STATUS = { not_started: 'in_progress', in_progress: 'done' };
export const PREV_STATUS = { done: 'in_progress', in_progress: 'not_started' };

let selectedCategoryId = null;

export function icon(name) {
  return `<i data-lucide="${name}"></i>`;
}

export function formStateSnapshot(form) {
  const entries = [];
  new FormData(form).forEach((value, key) => entries.push([key, String(value)]));
  return JSON.stringify(entries.sort((a, b) => (a[0] < b[0] ? -i : a[0] > b[0] ? i : 0)));
}

export function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

export const CATEGORY_COLORS = ['#3B82F6', '#22C55E', '#8B5CF6', '#6366F1', '#14B8A6', '#F59E0B', '#EC4899', '#06B6D4', '#EF4444', '#F97316', '#A855F7', '#64748B'];

export function renderCategoryPicker(selectedId, categories) {
  const selected = categories.find((c) => c.id === Number(selectedId)) || categories[0];
  const selectedColor = selected?.color || '#999';
  return `
    <div class="cat-picker" data-cat-picker>
      <input type="hidden" name="categoryId" value="${selected ? selected.id : ''}" />
      <button type="button" class="cat-picker-trigger" data-cat-trigger>
        <span class="category-dot" data-cat-dot style="background:${selectedColor}"></span>
        <span data-cat-label>${selected ? escapeHtml(selected.name) : ''}</span>
        <i data-lucide="chevron-down"></i>
      </button>
      <div class="cat-picker-menu hidden" data-cat-menu>
        ${categories.map((category) => `
          <div class="cat-option ${Number(selectedId) === category.id ? 'selected' : ''}" data-cat-opt="${category.id}">
            <button type="button" class="cat-option-main" data-cat-opt-main="${category.id}">
              <span class="category-dot" data-cat-dot="${category.id}" style="background:${category.color}"></span>
              <span class="cat-opt-name">${escapeHtml(category.name)}</span>
              <i data-lucide="check" class="cat-opt-check"></i>
            </button>
            <span class="cat-opt-swatches">
              ${CATEGORY_COLORS.map((color) => `<button type="button" class="swatch ${color === category.color ? 'active' : ''}" data-cat-color="${category.id}" data-color="${color}" style="background:${color}" aria-label="${color}"></button>`).join('')}
            </span>
          </div>`).join('')}
      </div>
    </div>
  `;
}

export function priorityOptions() {
  return [
    { value: 'high', label: t('priority_high') },
    { value: 'medium', label: t('priority_medium') },
    { value: 'low', label: t('priority_low') }
  ];
}

function recurrenceOptions() {
  return [
    { value: 'none', label: t('no_repeat') },
    { value: 'daily', label: t('daily') },
    { value: 'weekly', label: t('weekly') },
    { value: 'monthly', label: t('monthly') },
    { value: 'yearly', label: t('yearly') }
  ];
}

function reminderOptions() {
  return [
    { value: '', label: t('no_reminder') },
    { value: '15', label: t('reminder_15') },
    { value: '60', label: t('reminder_60') },
    { value: '1440', label: t('reminder_1440') }
  ];
}

export function renderPicker(name, label, options, selectedValue, iconName = '') {
  const selected = options.find((option) => String(option.value) === String(selectedValue)) || options[0];
  return `
    <div class="cat-picker" data-cat-picker>
      <input type="hidden" name="${name}" value="${selected ? selected.value : ''}" />
      <button type="button" class="cat-picker-trigger" data-cat-trigger>
        ${iconName ? `<i data-lucide="${iconName}"></i>` : ''}
        <span data-cat-label>${escapeHtml(selected ? selected.label : label)}</span>
        <i data-lucide="chevron-down"></i>
      </button>
      <div class="cat-picker-menu hidden" data-cat-menu>
        ${options.map((option) => `
          <div class="cat-option ${String(selectedValue) === String(option.value) ? 'selected' : ''}" data-cat-opt="${option.value}">
            <button type="button" class="cat-option-main" data-cat-opt-main="${option.value}">
              <span class="cat-opt-name">${escapeHtml(option.label)}</span>
              <i data-lucide="check" class="cat-opt-check"></i>
            </button>
          </div>`).join('')}
      </div>
    </div>
  `;
}

const CAL_WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function intlLocale() {
  return getLang() || 'en';
}

function formatDateLabel(value) {
  if (!value) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year, month - i, day));
}

function calMonthTitle(year, month) {
  return `${new Intl.DateTimeFormat(intlLocale(), { month: 'long' }).format(new Date(year, month, i))} ${year}`;
}

function calWeekdayNames() {
  const names = [];
  for (let index = 0; index < 7; index += i) {
    const label = new Intl.DateTimeFormat(intlLocale(), { weekday: 'narrow' }).format(new Date(2026, 0, 4 + index));
    names.push(label);
  }
  return names;
}

function calGrid(year, month, selectedValue) {
  const first = new Date(year, month, i).getDay();
  const daysInMonth = new Date(year, month + i, 0).getDate();
  const cells = [];
  for (let index = 0; index < 42; index += i) {
    const day = index - first + i;
    if (day < i || day > daysInMonth) {
      cells.push('<span class="cal-day empty"></span>');
    } else {
      const value = `${year}-${String(month + i).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const today = value === localDateStr();
      const selected = value === selectedValue;
      cells.push(`<button type="button" class="cal-day${selected ? ' selected' : ''}${today ? ' today' : ''}" data-cal-day="${value}" data-year="${year}" data-month="${month}" data-day="${day}">${day}</button>`);
    }
  }
  return cells.join('');
}

export function renderDatePicker(value, name = 'dueDate') {
  const current = value || '';
  const view = current ? new Date(`${current}T12:00:00`) : new Date();
  return `
    <div class="cat-picker date-picker" data-date-picker>
      <input type="hidden" name="${name}" value="${current}" />
      <button type="button" class="cat-picker-trigger" data-date-trigger>
        <i data-lucide="calendar"></i>
        <span data-date-label>${escapeHtml(current ? formatDateLabel(current) : t('no_due_date'))}</span>
        <i data-lucide="chevron-down"></i>
      </button>
      <div class="cat-picker-menu cal-panel hidden" data-date-menu data-cal-year="${view.getFullYear()}" data-cal-month="${view.getMonth()}" data-cal-current="${current}">
        ${calHeader(view.getFullYear(), view.getMonth())}
        <div class="cal-weekdays">${calWeekdayNames().map((day) => `<span class="cal-weekday">${day}</span>`).join('')}</div>
        <div class="cal-grid" data-cal-body>${calGrid(view.getFullYear(), view.getMonth(), current)}</div>
        <button type="button" class="cal-clear" data-cal-clear>${t('clear')}</button>
      </div>
    </div>
  `;
}

function calHeader(year, month) {
  return `
    <div class="cal-header">
      <button type="button" class="icon-btn" data-cal-prev aria-label="prev">${icon('chevron-left')}</button>
      <span class="cal-title">${calMonthTitle(year, month)}</span>
      <button type="button" class="icon-btn" data-cal-next aria-label="next">${icon('chevron-right')}</button>
    </div>
  `;
}

function refreshCalView(picker) {
  const menu = picker.querySelector('[data-date-menu]');
  const year = Number(menu.dataset.calYear);
  const month = Number(menu.dataset.calMonth);
  picker.querySelector('.cal-header').outerHTML = calHeader(year, month);
  picker.querySelector('[data-cal-body]').innerHTML = calGrid(year, month, picker.querySelector('input[type="hidden"]').value);
  refreshIcons();
}

export function bindDatePickers(root = document) {
  root.querySelectorAll('[data-date-picker]').forEach((picker) => {
    if (picker.dataset.bound) return;
    picker.dataset.bound = 'i';
    const trigger = picker.querySelector('[data-date-trigger]');
    const menu = picker.querySelector('[data-date-menu]');
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const wasOpen = !menu.classList.contains('hidden');
      closeOpenMenus(picker);
      if (wasOpen) return;
      menu.classList.remove('hidden');
      anchorMenuWithinModal(picker, menu);
    });
    menu.addEventListener('click', (event) => {
      event.stopPropagation();
      const prev = event.target.closest('[data-cal-prev]');
      const next = event.target.closest('[data-cal-next]');
      const clear = event.target.closest('[data-cal-clear]');
      const day = event.target.closest('[data-cal-day]');
      if (prev || next) {
        const offset = prev ? -i : i;
        let year = Number(menu.dataset.calYear);
        let month = Number(menu.dataset.calMonth) + offset;
        if (month < 0) { month = 11; year -= i; }
        if (month > 11) { month = 0; year += i; }
        menu.dataset.calYear = year;
        menu.dataset.calMonth = month;
        refreshCalView(picker);
      } else if (clear) {
        const input = picker.querySelector('input[type="hidden"]');
        input.value = '';
        picker.querySelector('[data-date-label]').textContent = t('no_due_date');
        refreshCalView(picker);
      } else if (day) {
        const input = picker.querySelector('input[type="hidden"]');
        input.value = day.dataset.calDay;
        picker.querySelector('[data-date-label]').textContent = formatDateLabel(day.dataset.calDay);
        refreshCalView(picker);
      }
    });
  });
}

export function bindCategoryPickers(root = document) {
  root.querySelectorAll('[data-cat-picker]').forEach((picker) => {
    if (picker.dataset.bound) return;
    picker.dataset.bound = 'i';
    picker.querySelector('[data-cat-trigger]').addEventListener('click', (event) => {
      event.stopPropagation();
      const menu = picker.querySelector('[data-cat-menu]');
      const wasOpen = !menu.classList.contains('hidden');
      closeOpenMenus(picker);
      if (wasOpen) return;
      menu.classList.remove('hidden');
      anchorMenuWithinModal(picker, menu);
    });
    picker.querySelectorAll('[data-cat-opt-main]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const id = btn.dataset.catOptMain;
        const option = picker.querySelector(`[data-cat-opt="${id}"]`);
        const input = picker.querySelector('input[type="hidden"]');
        if (input) input.value = id;
        picker.querySelector('[data-cat-label]').textContent = option.querySelector('.cat-opt-name').textContent;
        const dot = option.querySelector('.category-dot');
        if (dot) {
          const dotEl = picker.querySelector('[data-cat-dot]');
          if (dotEl) dotEl.style.background = dot.style.background;
        }
        picker.querySelectorAll('.cat-option').forEach((row) => row.classList.toggle('selected', row === option));
      });
    });
    picker.querySelectorAll('[data-cat-color]').forEach((swatch) => {
      swatch.addEventListener('click', async (event) => {
        event.stopPropagation();
        const id = Number(swatch.dataset.catColor);
        const color = swatch.dataset.color;
        await updateCategory(id, { color });
        picker.querySelectorAll(`[data-cat-dot="${id}"], [data-cat-opt="${id}"] .swatch`).forEach((el) => {
          if (el.classList.contains('swatch')) el.classList.toggle('active', el.dataset.color === color);
          else el.style.background = color;
        });
        if (picker.querySelector('input[name="categoryId"]').value === String(id)) {
          picker.querySelector('[data-cat-dot]').style.background = color;
        }
      });
    });
  });
}

function closeOpenMenus(except = null) {
  document.querySelectorAll('[data-cat-menu]:not(.hidden), [data-date-menu]:not(.hidden)').forEach((menu) => {
    if (except && menu.closest('[data-cat-picker], [data-date-picker]') === except) return;
    menu.classList.add('hidden');
    menu.style.cssText = '';
  });
}

function anchorMenuWithinModal(picker, menu) {
  if (!menu.closest('.modal-card')) return;
  const trigger = menu.parentElement.querySelector('[data-date-trigger]') || menu.parentElement.querySelector('[data-cat-trigger]');
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  const isDateMenu = Boolean(menu.querySelector('[data-cal-body]'));
  const width = isDateMenu ? menu.offsetWidth : rect.width;
  const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8);
  const menuHeight = menu.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom - 10;
  menu.style.position = 'fixed';
  menu.style.left = `${left}px`;
  menu.style.minWidth = '0';
  if (!isDateMenu) menu.style.width = `${rect.width}px`;
  if (menuHeight <= spaceBelow) {
    menu.style.top = `${rect.bottom + 6}px`;
    return;
  }
  const spaceAbove = rect.top - 10;
  if (menuHeight <= spaceAbove) {
    menu.style.top = `${rect.top - menuHeight - 6}px`;
    return;
  }
  menu.style.top = '10px';
  menu.style.maxHeight = `${Math.max(60, spaceAbove)}px`;
  menu.style.overflowY = 'auto';
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-cat-picker], [data-date-picker]')) closeOpenMenus();
});

document.querySelectorAll('.modal-card').forEach((card) => card.addEventListener('scroll', () => closeOpenMenus()));

export function renderSidebar(categories, tasks, activeView) {
  const sidebar = document.querySelector('#sidebar');
  const countByCategory = tasks.reduce((counts, task) => {
    if (task.status !== 'done' && task.status !== 'pending' && !task.deletedAt) counts[task.categoryId] = (counts[task.categoryId] || 0) + i;
    return counts;
  }, {});
  const archivedCount = tasks.filter((task) => task.deletedAt).length;
  sidebar.innerHTML = `
    <div class="sidebar-main">
      <a href="#" class="brand" data-view="dashboard"><img src="assets/logo.svg" alt="${t('app_name')}" class="brand-logo" width="38" height="38"/><span>${t('app_name')}</span></a>
      <div class="sidebar-section">
        <p class="sidebar-title">${t('views')}</p>
        ${[
          ['dashboard', 'layout-dashboard', t('dashboard'), ''],
          ['time', 'clock', t('time'), ''],
          ['priority', 'flag', t('priority_matrix'), ''],
          ['done', 'check-check', t('done'), ''],
          ['archive', 'archive', t('archive'), archivedCount ? String(archivedCount) : '']
        ].map(([view, iconName, label, count]) => `<button class="nav-item ${activeView === view ? 'active' : ''}" data-view="${view}">${icon(iconName)}<span>${label}</span>${count ? `<span class="count-pill">${count}</span>` : ''}</button>`).join('')}
      </div>
      <div class="sidebar-section">
        <p class="sidebar-title">${t('categories')}</p>
        ${categories.map((category) => `
          <button class="category-item ${activeView === `category:${category.id}` ? 'active' : ''}" data-category-id="${category.id}">
            <span class="category-dot" style="background:${category.color}"></span><span>${escapeHtml(category.name)}</span><span class="count-pill">${countByCategory[category.id] || 0}</span>
          </button>`).join('')}
      </div>
    </div>
    <div class="sidebar-section sidebar-settings">
      <button class="settings-item ${activeView === 'settings' ? 'active' : ''}" data-view="settings">${icon('settings')}<span>${t('settings')}</span></button>
    </div>
  `;
  refreshIcons();
}

function canTransition(from, to) {
  if (to === from) return false;
  if (to === 'pending' && from !== 'pending') return true;
  if (NEXT_STATUS[from] === to) return true;
  if (PREV_STATUS[from] === to) return true;
  if (from === 'pending' && to === 'in_progress') return true;
  return false;
}

function statusTarget(current, to) {
  if (to === 'pending' && current !== 'pending') return 'pending';
  if (to === 'in_progress' && current === 'pending') return 'in_progress';
  if (NEXT_STATUS[current] === to) return NEXT_STATUS[current];
  if (PREV_STATUS[current] === to) return PREV_STATUS[current];
  return current;
}

function timerLabel(task) {
  const minutes = Number(task.durationMinutes) || 0;
  if (task.focusStartedAt) {
    const start = new Date(task.focusStartedAt).getTime();
    const end = start + minutes * 60000;
    return formatRemaining(end - Date.now());
  }
  return `${minutes}m`;
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function renderTaskCard(task, category) {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.not_started;
  const isOpen = task.status !== 'done' && !task.deletedAt;
  const running = isOpen && task.status === 'in_progress' && Boolean(task.focusStartedAt) && Number(task.durationMinutes) > 0;
  return `
    <article class="task-card ${task.status === 'done' ? 'completed' : ''} ${task.status === 'pending' ? 'pending' : ''}" data-task-id="${task.id}">
      ${isOpen ? `<div class="task-status-bar">${STATUS_ORDER.map((st) => {
        const label = t(`status_${st}`) || STATUS_CONFIG[st]?.label || st;
        const active = task.status === st;
        const enabled = canTransition(task.status, st);
        return `<button class="status-seg${active ? ' active' : ''}${enabled ? '' : ' disabled'}" data-status-target="${st}" title="${label}">${label}</button>`;
      }).join('')}<button class="status-seg status-pending${task.status === 'pending' ? ' active' : ''}${canTransition(task.status, 'pending') ? '' : ' disabled'}" data-status-target="pending" title="Pending">${t('status_pending')}</button></div>` : ''}
      <div>
        <p class="task-title">${escapeHtml(task.title)}</p>
        ${task.description ? `<p class="muted">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">
          <span>${category?.name || t('no_category')}</span>
          ${task.dueDate ? `<span>${t('due_prefix')} ${task.dueDate}</span>` : ''}
          ${task.recurrence && task.recurrence !== 'none' ? `<span>${t('repeats_prefix')} ${t(`repeat_${task.recurrence}`)}</span>` : ''}
        </div>
        ${Number(task.durationMinutes) > 0 ? `<div class="task-actions">${running ? `<button class="chip-btn active" data-timer-toggle="${task.id}" title="Pause timer"><i data-lucide="pause"></i><span data-timer-chip="${task.id}">${timerLabel(task)}</span></button>` : task.status === 'in_progress' ? `<button class="chip-btn" data-timer-toggle="${task.id}" title="Start timer"><i data-lucide="play"></i><span>${timerLabel(task)}</span></button>` : ''}</div>` : ''}
      </div>
      <span class="badge ${priority.className}">${t(`priority_${task.priority}`)}</span>
    </article>
  `;
}

export function attachTaskCardEvents(container = document) {
  container.querySelectorAll('[data-task-id]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-status-target]')) return;
      if (event.target.closest('[data-timer-toggle]')) return;
      openTaskDetail(card.dataset.taskId);
    });
  });
  container.querySelectorAll('[data-status-target]').forEach((button) => {
    button.addEventListener('click', async () => {
      const taskId = button.closest('[data-task-id]')?.dataset.taskId;
      if (!taskId) return;
      const target = button.dataset.statusTarget;
      const task = await getTask(taskId);
      if (!task || target === task.status) return;
      const actual = statusTarget(task.status, target);
      if (!canTransition(task.status, actual)) return;
      if (actual === task.status) return;
      const confirm = await confirmDialog({
        title: t(`status_${actual}`),
        message: `${t('move_to')} "${t(`status_${actual}`) || actual}"?`,
        confirmText: t('ok'),
        dismissText: t('cancel')
      });
      if (!confirm) return;
      if (actual === 'pending') await sendToPending(taskId, 'manual');
      else if (task.status === 'pending' && actual === 'in_progress') await resumeFromPending(taskId);
      else await setTaskStatus(taskId, actual, 'manual');
      if (actual === 'done' && task.recurrence !== 'none') await createRecurringTaskInstance(task);
      window.refreshCurrentView();
    });
  });
  container.querySelectorAll('[data-timer-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.timerToggle);
      const task = await getTask(id);
      if (!task) return;
      if (task.focusStartedAt) await stopFocus(id);
      else await startFocus(id);
      window.refreshCurrentView();
    });
  });
}

export async function toggleTaskStatus(id) {
  const task = await getTask(id);
  if (!task) return;
  if (task.status === 'not_started') await setTaskStatus(id, 'in_progress', 'manual');
  else if (task.status === 'in_progress') {
    await setTaskStatus(id, 'done', 'manual');
    if (task.recurrence !== 'none') await createRecurringTaskInstance(task);
  } else if (task.status === 'pending') {
    await resumeFromPending(id);
  } else if (task.status === 'done') {
    await setTaskStatus(id, 'in_progress', 'reopen');
  }
}

export async function archiveTaskById(id) {
  await archiveTask(id);
  closeTaskModal();
  window.refreshCurrentView();
}

export async function restoreTaskById(id) {
  await restoreTask(id);
  window.refreshCurrentView();
}

export async function purgeTaskById(id) {
  if (!(await confirmDialog({ title: t('delete_task'), message: t('delete_confirm'), confirmText: t('delete_forever'), danger: true }))) return;
  const task = await getTask(id);
  await permanentDeleteTask(id);
  await pushDeletion('task', task?.uuid);
  window.refreshCurrentView();
}

export async function emptyArchiveAll() {
  const tasks = await getTasks();
  const archived = tasks.filter((task) => task.deletedAt);
  if (!archived.length) return;
  if (!(await confirmDialog({ title: t('empty_archive'), message: t('empty_archive_confirm'), confirmText: t('empty_archive'), danger: true }))) return;
  for (const task of archived) {
    await permanentDeleteTask(task.id);
    await pushDeletion('task', task.uuid);
  }
  window.refreshCurrentView();
}

export async function openQuickAdd(prefillCategoryId = null) {
  selectedCategoryId = prefillCategoryId ? Number(prefillCategoryId) : null;
  document.querySelector('#quick-add-modal').classList.remove('hidden');
  await renderQuickAddForm();
}

async function renderQuickAddForm() {
  const body = document.querySelector('#quick-add-body');
  const categories = await getCategories();
  if (!selectedCategoryId) {
    body.innerHTML = `
      <div class="modal-header"><div><p class="eyebrow">${t('quick_add_eyebrow')}</p><h3>${t('choose_category')}</h3></div><button class="icon-btn close-modal-btn">${icon('x')}</button></div>
      <div class="category-grid">${categories.map((category) => `<button class="category-card" data-pick-category="${category.id}"><span class="category-dot" style="background:${category.color}"></span><h3>${escapeHtml(category.name)}</h3><p class="muted">${t('use_presets')}</p></button>`).join('')}</div>
    `;
  } else {
    const category = categories.find((item) => item.id === selectedCategoryId);
    const templates = await getTemplatesByCategory(selectedCategoryId);
    body.innerHTML = `
      <div class="modal-header"><div><h3>${category?.name ? `<span class="hdr-accent">${escapeHtml(category.name)},</span> ` : ''}${t('create_task')}</h3></div><button class="icon-btn close-modal-btn">${icon('x')}</button></div>
      ${templates.length ? `<span class="flabel">${t('field_quick_task')}</span><div class="template-row">${templates.map((template) => `<button class="template-chip" type="button" data-template='${JSON.stringify(template)}'>${escapeHtml(template.title)}</button>`).join('')}</div>` : ''}
      ${taskForm({ categoryId: selectedCategoryId, priority: 'medium', recurrence: 'none' }, categories, 'create-task-form')}
    `;
  }
  body.onclick = handleQuickAddClick;
  const form = body.querySelector('#create-task-form');
  const quickModal = document.querySelector('#quick-add-modal');
  if (form) {
    form.addEventListener('submit', submitCreateTask);
    quickModal.dataset.formBaseline = formStateSnapshot(form);
  } else {
    delete quickModal.dataset.formBaseline;
  }
  bindCategoryPickers(body);
  bindDatePickers(body);
  refreshIcons();
}

function clearQuickTask() {
  const form = document.querySelector('#create-task-form');
  if (!form) return;
  form.title.value = '';
  form.description.value = '';
  form.priority.value = 'medium';
  form.templateId.value = '';
}

async function closeIfDirty(modalId, closeFn) {
  const modal = document.querySelector(modalId);
  const baseline = modal?.dataset.formBaseline;
  const form = modal?.querySelector('form');
  const changed = Boolean(form && baseline && formStateSnapshot(form) !== baseline);
  if (!changed) {
    closeFn();
    return;
  }
  if (await confirmDialog({ title: t('discard_changes'), message: t('modal_discard_confirm'), confirmText: t('discard_changes'), dismissText: t('cancel') })) closeFn();
}

async function handleQuickAddClick(event) {
  const close = event.target.closest('.close-modal-btn');
  const category = event.target.closest('[data-pick-category]');
  const cancel = event.target.closest('[data-cancel-modal]');
  const chipClear = event.target.closest('[data-template-clear]');
  const template = chipClear ? null : event.target.closest('[data-template]');
  if (close) {
    await closeIfDirty('#quick-add-modal', closeQuickAdd);
    return;
  }
  if (cancel) {
    await closeIfDirty('#quick-add-modal', closeQuickAdd);
    return;
  }
  if (category) {
    selectedCategoryId = Number(category.dataset.pickCategory);
    await renderQuickAddForm();
    return;
  }
  if (chipClear) {
    const chip = chipClear.closest('.template-chip');
    if (chip) chip.classList.remove('active');
    chipClear.remove();
    clearQuickTask();
    return;
  }
  if (template) {
    const form = document.querySelector('#create-task-form');
    const wasActive = template.classList.contains('active');
    document.querySelectorAll('.template-chip').forEach((chip) => {
      chip.classList.remove('active');
      chip.querySelector('[data-template-clear]')?.remove();
    });
    if (wasActive) {
      clearQuickTask();
      return;
    }
    template.classList.add('active');
    const clearEl = document.createElement('span');
    clearEl.className = 'template-chip-clear';
    clearEl.dataset.templateClear = 'i';
    clearEl.setAttribute('role', 'button');
    clearEl.setAttribute('aria-label', t('clear_quick_task'));
    clearEl.innerHTML = icon('x');
    template.appendChild(clearEl);
    const data = JSON.parse(template.dataset.template);
    form.title.value = data.title;
    form.description.value = data.description;
    form.priority.value = data.priority;
    form.templateId.value = data.id;
  }
}

async function submitCreateTask(event) {
  event.preventDefault();
  await addTask(formToTask(new FormData(event.currentTarget)));
  closeQuickAdd();
  window.refreshCurrentView();
}

export async function openTaskDetail(id) {
  const task = await getTask(id);
  const categories = await getCategories();
  const history = await getHistory(id);
  document.querySelector('#task-modal').classList.remove('hidden');
  document.querySelector('#task-modal-body').innerHTML = `
    <div class="modal-header"><div><h3><span class="hdr-accent">${t('edit_task')}:</span> ${escapeHtml(task.title)}</h3></div><button class="icon-btn" data-close-task>${icon('x')}</button></div>
    ${taskForm(task, categories, 'edit-task-form')}
    <div class="task-track-card">
      <div class="task-track-id">${icon('fingerprint')}<span>${t('tracking_id')}: <code>${escapeHtml(task.trackingId || '')}</code></span><button class="btn btn-ghost btn-sm" data-copy-tracking>${t('copy')}</button></div>
    </div>
    ${history.length ? `<div class="task-history"><h4>${t('history')}</h4><div class="history-list">${history.map(historyRow).join('')}</div></div>` : ''}
  `;
  document.querySelector('#edit-task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await updateTask(task.id, formToTask(new FormData(event.currentTarget)));
    closeTaskModal();
    window.refreshCurrentView();
  });
  document.querySelector('[data-close-task]').addEventListener('click', () => closeIfDirty('#task-modal', closeTaskModal));
  document.querySelector('[data-cancel-modal]')?.addEventListener('click', () => closeIfDirty('#task-modal', closeTaskModal));
  document.querySelector('[data-delete-task]').addEventListener('click', () => archiveTaskById(task.id));
  document.querySelector('[data-copy-tracking]')?.addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(task.trackingId || '');
      event.currentTarget.textContent = t('bc_copied');
      setTimeout(() => { event.currentTarget.textContent = t('copy'); }, 1500);
    } catch {}
  });
  bindCategoryPickers(document.querySelector('#task-modal-body'));
  bindDatePickers(document.querySelector('#task-modal-body'));
  const editForm = document.querySelector('#edit-task-form');
  if (editForm) document.querySelector('#task-modal').dataset.formBaseline = formStateSnapshot(editForm);
  refreshIcons();
}

function historyRow(entry) {
  const fromLabel = entry.type === 'status' || entry.type === 'delete' || entry.type === 'archive'
    ? (t(`status_${entry.from}`) || entry.from || '�')
    : (entry.from || '�');
  const toLabel = entry.type === 'status' || entry.type === 'delete' || entry.type === 'archive'
    ? (t(`status_${entry.to}`) || entry.to || '�')
    : (entry.to || '�');
  const reasonKey = ({ created: 'h_created', edit: 'h_edited', manual: 'h_manual', resume: 'h_resumed', archived: 'h_archived', restored: 'h_restored', permanent_delete: 'h_deleted', start: 'h_timer_start', stop: 'h_timer_stop', not_started_by_due_date: 'h_auto_pend_due', in_progress_past_due: 'h_auto_pend_overdue' })[entry.reason];
  const reasonText = reasonKey ? t(reasonKey) : entry.reason;
  return `<div class="history-row"><span class="history-time">${escapeHtml(entry.timestamp)}</span><span class="history-flow">${escapeHtml(fromLabel)} ${icon('arrow-right')} ${escapeHtml(toLabel)}</span><span class="history-reason">${escapeHtml(reasonText)}</span></div>`;
}

function focusOptions() {
  return [
    { value: '', label: t('focus_off') },
    { value: '15', label: t('focus_15') },
    { value: '25', label: t('focus_25') },
    { value: '45', label: t('focus_45') },
    { value: '60', label: t('focus_60') },
    { value: '90', label: t('focus_90') },
    { value: '120', label: t('focus_120') }
  ];
}

function taskForm(task, categories, id) {
  const isEdit = Boolean(task.id);
  const focus = task.durationMinutes ? String(task.durationMinutes) : '';
  return `
    <form id="${id}" class="form-grid">
      <input type="hidden" name="templateId" value="${task.templateId || ''}" />
      <label class="flabel" for="${id}-title">${t('field_task_title')} <span class="req" aria-hidden="true">*</span><span class="sr-only">(${t('required')})</span></label>
      <input class="field" id="${id}-title" name="title" placeholder="${t('task_title_placeholder')}" value="${escapeAttr(task.title || '')}" required aria-required="true" />
      <label class="flabel" for="${id}-desc">${t('field_description')}</label>
      <textarea class="textarea" id="${id}-desc" name="description" placeholder="${t('description_placeholder')}">${escapeHtml(task.description || '')}</textarea>
      <div class="two-col form-grid">
        <div><label class="flabel">${t('field_category')}</label>${renderCategoryPicker(task.categoryId, categories)}</div>
        <div><label class="flabel">${t('field_priority')}</label>${renderPicker('priority', t('priority_medium'), priorityOptions(), task.priority || 'medium', 'flag')}</div>
      </div>
      <div class="two-col form-grid">
        <div><label class="flabel">${t('field_due_date')}</label>${renderDatePicker(task.dueDate || '')}</div>
        <div><label class="flabel">${t('field_repeat')}</label>${renderPicker('recurrence', t('no_repeat'), recurrenceOptions(), task.recurrence || 'none', 'repeat')}</div>
      </div>
      <div class="two-col form-grid">
        <div><label class="flabel">${t('field_reminder')}</label>${renderPicker('reminder', t('no_reminder'), reminderOptions(), task.reminders?.[0]?.minutesBefore ? String(task.reminders[0].minutesBefore) : '', 'bell')}</div>
        <div><label class="flabel">${t('field_duration')}</label>${renderPicker('durationMinutes', t('focus_off'), focusOptions(), focus || 'off', 'timer')}</div>
      </div>
      <div class="modal-footer">
        <span class="footer-hint">${t('form_footer_hint')}</span>
        <div class="footer-actions">
          ${isEdit ? `<button type="button" class="btn btn-danger" data-delete-task="${task.id}">${t('delete_task')}</button>` : ''}
          <button type="button" class="btn" data-cancel-modal>${t('cancel')}</button>
          <button class="btn btn-primary" type="submit">${t('save_task')}</button>
        </div>
      </div>
    </form>
  `;
}

function formToTask(form) {
  const reminder = form.get('reminder');
  return {
    title: form.get('title'),
    description: form.get('description'),
    categoryId: Number(form.get('categoryId')),
    templateId: form.get('templateId') ? Number(form.get('templateId')) : null,
    priority: form.get('priority'),
    dueDate: form.get('dueDate'),
    recurrence: form.get('recurrence'),
    reminders: reminder ? [{ minutesBefore: Number(reminder), fired: false }] : [],
    durationMinutes: Number(form.get('durationMinutes')) || 0
  };
}

export function closeQuickAdd() {
  document.querySelector('#quick-add-modal').classList.add('hidden');
}

export const SPECIAL_DAY_TYPES = ['birthday', 'anniversary', 'event', 'festival'];

export function renderSpecialDayCard(sd, category) {
  const typeLabel = t(`sd_type_${sd.type}`) || sd.type;
  return `
    <article class="sd-card" data-sd-id="${sd.id}">
      <span class="sd-icon" style="background:${escapeHtml(category?.color || '#f97316')}">${icon('calendar-heart')}</span>
      <div>
        <p class="task-title">${escapeHtml(sd.title)}</p>
        <p class="muted">${escapeHtml(typeLabel)}${category?.name ? ` � ${escapeHtml(category.name)}` : ''}${sd.recurring === 'yearly' ? ` � ${t('sd_yearly')}` : ` � ${t('sd_once')}`}</p>
      </div>
      <button class="icon-btn" data-sd-edit="${sd.id}" title="${t('edit_task')}">${icon('pencil')}</button>
    </article>
  `;
}

export async function openSpecialDayForm(sd = null, prefillDate = '') {
  const categories = await getCategories();
  const body = document.querySelector('#special-day-modal-body');
  document.querySelector('#special-day-modal').classList.remove('hidden');
  const isEdit = Boolean(sd);
  const values = sd || { title: '', type: 'event', date: prefillDate || localDateStr(), recurring: 'yearly', categoryId: '', notes: '' };
  body.innerHTML = `
    <div class="modal-header"><div><h3>${isEdit ? `${t('edit_task')}: ${escapeHtml(sd.title)}` : t('add_special_day')}</h3></div><button class="icon-btn close-modal-btn">${icon('x')}</button></div>
    <form id="special-day-form" class="form-grid">
      <label class="flabel" for="sd-title">${t('field_task_title')} <span class="req" aria-hidden="true">*</span></label>
      <input class="field" id="sd-title" name="title" value="${escapeAttr(values.title || '')}" required />
      <div class="two-col form-grid">
        <div><label class="flabel">${t('sd_type')}</label>${renderPicker('type', t('sd_type_event'), SPECIAL_DAY_TYPES.map((type) => ({ value: type, label: t(`sd_type_${type}`) })), values.type || 'event', 'calendar-heart')}</div>
        <div><label class="flabel">${t('field_due_date')}</label>${renderDatePicker(values.date || '')}</div>
      </div>
      <div class="two-col form-grid">
        <div><label class="flabel">${t('sd_recurring')}</label>${renderPicker('recurring', t('sd_yearly'), [{ value: 'yearly', label: t('sd_yearly') }, { value: 'once', label: t('sd_once') }], values.recurring || 'yearly', 'repeat')}</div>
        <div><label class="flabel">${t('field_category')}</label>${renderCategoryPicker(values.categoryId, categories)}</div>
      </div>
      <label class="flabel" for="sd-notes">${t('field_description')}</label>
      <textarea class="textarea" id="sd-notes" name="notes" placeholder="${t('description_placeholder')}">${escapeHtml(values.notes || '')}</textarea>
      <div class="modal-footer">
        <span class="footer-hint"></span>
        <div class="footer-actions">
          ${isEdit ? `<button type="button" class="btn btn-danger" data-sd-delete="${sd.id}">${t('delete_task')}</button>` : ''}
          <button type="button" class="btn" data-cancel-modal>${t('cancel')}</button>
          <button class="btn btn-primary" type="submit">${t('save_task')}</button>
        </div>
      </div>
    </form>
  `;
  body.onclick = async (event) => {
    if (event.target.closest('.close-modal-btn') || event.target.closest('[data-cancel-modal]')) {
      document.querySelector('#special-day-modal').classList.add('hidden');
      return;
    }
    const deleteBtn = event.target.closest('[data-sd-delete]');
    if (deleteBtn) {
      if (!(await confirmDialog({ title: t('delete_task'), message: t('delete_confirm'), confirmText: t('delete_task'), danger: true }))) return;
      await archiveSpecialDay(Number(deleteBtn.dataset.sdDelete));
      closeSpecialDayModal();
      window.refreshCurrentView();
      return;
    }
  };
  document.querySelector('#special-day-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      title: data.get('title'),
      type: data.get('type'),
      date: data.get('dueDate'),
      recurring: data.get('recurring'),
      categoryId: data.get('categoryId') ? Number(data.get('categoryId')) : null,
      notes: data.get('notes')
    };
    if (isEdit) await updateSpecialDay(sd.id, payload);
    else await addSpecialDay(payload);
    closeSpecialDayModal();
    window.refreshCurrentView();
  });
  bindCategoryPickers(body);
  bindDatePickers(body);
  refreshIcons();
}

export function closeSpecialDayModal() {
  document.querySelector('#special-day-modal')?.classList.add('hidden');
}

export async function openTimerPopup(task) {
  const card = document.querySelector('#timer-popup-card');
  const overlay = document.querySelector('#timer-popup');
  if (!card || !overlay) return;
  overlay.classList.remove('hidden');
  card.innerHTML = `
    <div class="modal-header"><div><h3>${t('timer_done')}</h3></div><button class="icon-btn close-modal-btn" data-timer-close>${icon('x')}</button></div>
    <p class="muted">${escapeHtml(task.title)}</p>
    <div class="timer-choices">
      <button class="btn btn-primary" data-timer-choice="done">${t('move_done')}</button>
      <button class="btn" data-timer-choice="extend">${t('keep_going')}</button>
      <button class="btn" data-timer-choice="pending">${t('mark_pending')}</button>
      <button class="btn btn-ghost" data-timer-choice="start">${t('back_to_start')}</button>
    </div>
  `;
  const finish = async (choice) => {
    overlay.classList.add('hidden');
    if (choice === 'done') {
      await setTaskStatus(task.id, 'done', 'timer_done');
      if (task.recurrence !== 'none') await createRecurringTaskInstance(task);
    } else if (choice === 'extend') {
      const minutes = Math.max(i, Number(task.durationMinutes) || 25) + 25;
      await updateTask(task.id, { durationMinutes: minutes });
      await startFocus(task.id);
    } else if (choice === 'pending') {
      await sendToPending(task.id, 'timer_done');
    } else if (choice === 'start') {
      await setTaskStatus(task.id, 'not_started', 'timer_done');
    }
    window.refreshCurrentView();
  };
  const closeBtn = card.querySelector('[data-timer-close]');
  if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  card.querySelectorAll('[data-timer-choice]').forEach((button) => {
    button.addEventListener('click', () => finish(button.dataset.timerChoice));
  });
  overlay.onclick = (event) => {
    if (event.target.id === 'timer-popup') overlay.classList.add('hidden');
  };
}

function closeTaskModal() {
  document.querySelector('#task-modal').classList.add('hidden');
}

export function showOnboarding() {
  if (!isPrefEnabled('onboarding') || localStorage.getItem('todoMeva_onboarded')) return;
  const overlay = document.querySelector('#onboarding-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  const card = document.querySelector('#onboarding-card');
  const profile = getProfile();
  card.innerHTML = `
    <p class="eyebrow">${t('ob_welcome')}</p>
    <h3>${t('ob_title')}</h3>
    <p class="muted">${t('ob_body')}</p>
    <form id="onboarding-form" class="profile-form" autocomplete="off">
      <div class="profile-form-grid">
        <div class="field-group">
          <label class="flabel" for="ob-name">${t('s_name')} <span class="req">*</span></label>
          <input class="field" id="ob-name" placeholder="${t('ob_name_ph')}" value="${escapeAttr(profile.name || '')}" required />
        </div>
        <div class="field-group">
          <label class="flabel" for="ob-contact">${t('ob_contact')} ${t('ob_optional')}</label>
          <input class="field" id="ob-contact" type="text" placeholder="${t('ob_contact_ph')}" value="${escapeAttr(profile.contact || '')}" />
        </div>
      </div>
      <p class="muted onboarding-privacy">${t('ob_privacy')}</p>
      <div class="profile-form-actions">
        <button class="btn btn-ghost" type="button" data-skip-onboarding>${t('ob_skip')}</button>
        <button class="btn btn-primary" type="submit">${t('ob_finish')}</button>
      </div>
    </form>`;
  const finish = () => {
    localStorage.setItem('todoMeva_onboarded', 'i');
    overlay.classList.add('hidden');
  };
  card.querySelector('#onboarding-form').addEventListener('submit', (event) => {
    event.preventDefault();
    saveProfile({
      name: card.querySelector('#ob-name').value.trim(),
      contact: card.querySelector('#ob-contact').value.trim(),
    });
    finish();
  });
  card.querySelector('[data-skip-onboarding]').addEventListener('click', finish);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#039;');
}
