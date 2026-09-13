import { addTask, archiveTask, getCategories, getTask, getTasks, getTemplatesByCategory, permanentDeleteTask, restoreTask, sendToPending, setTaskStatus, startFocus, stopFocus, updateCategory, updateTask } from './db.js?v=7';
import { PRIORITY_CONFIG, STATUS_CONFIG } from './seed.js?v=5';
import { createRecurringTaskInstance } from './recurrence.js?v=6';
import { t } from './i18n.js?v=7';
import { isPrefEnabled } from './prefs.js?v=4';
import { pushDeletion } from './sync.js?v=6';

let selectedCategoryId = null;

export function icon(name) {
  return `<i data-lucide="${name}"></i>`;
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
            </button>
            <span class="cat-opt-swatches">
              ${CATEGORY_COLORS.map((color) => `<button type="button" class="swatch ${color === category.color ? 'active' : ''}" data-cat-color="${category.id}" data-color="${color}" style="background:${color}" aria-label="${color}"></button>`).join('')}
            </span>
          </div>`).join('')}
      </div>
    </div>
  `;
}

export function bindCategoryPickers(root = document) {
  root.querySelectorAll('[data-cat-picker]').forEach((picker) => {
    if (picker.dataset.bound) return;
    picker.dataset.bound = '1';
    picker.querySelector('[data-cat-trigger]').addEventListener('click', (event) => {
      event.stopPropagation();
      closeOpenMenus(picker);
      picker.querySelector('[data-cat-menu]').classList.toggle('hidden');
    });
    picker.querySelectorAll('[data-cat-opt-main]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        const id = btn.dataset.catOptMain;
        const option = picker.querySelector(`[data-cat-opt="${id}"]`);
        picker.querySelector('input[name="categoryId"]').value = id;
        picker.querySelector('[data-cat-label]').textContent = option.querySelector('.cat-opt-name').textContent;
        const color = option.querySelector('.category-dot').style.background;
        picker.querySelector('[data-cat-dot]').style.background = color;
        picker.querySelectorAll('.cat-option').forEach((row) => row.classList.toggle('selected', row === option));
        closeOpenMenus();
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
  document.querySelectorAll('[data-cat-menu]:not(.hidden)').forEach((menu) => {
    if (except && menu.closest('[data-cat-picker]') === except) return;
    menu.classList.add('hidden');
  });
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-cat-picker]')) closeOpenMenus();
});

export function renderSidebar(categories, tasks, activeView) {
  const sidebar = document.querySelector('#sidebar');
  const countByCategory = tasks.reduce((counts, task) => {
    if (task.status !== 'completed' && task.priority !== 'pending' && !task.deletedAt) counts[task.categoryId] = (counts[task.categoryId] || 0) + 1;
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
          ['upcoming', 'calendar-days', t('upcoming'), ''],
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

function focusLabel(task) {
  const minutes = Number(task.focusMinutes) || 25;
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
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
  const isOpen = task.status !== 'completed' && task.priority !== 'pending' && !task.deletedAt;
  const running = isOpen && Boolean(task.focusStartedAt) && Number(task.focusMinutes) > 0;
  return `
    <article class="task-card ${task.status === 'completed' ? 'completed' : ''}" data-task-id="${task.id}">
      <button class="status-btn ${task.status}" data-status-toggle="${task.id}" title="${status.label}"></button>
      <div>
        <p class="task-title">${escapeHtml(task.title)}</p>
        ${task.description ? `<p class="muted">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">
          <span>${category?.name || t('no_category')}</span>
          ${task.dueDate ? `<span>${t('due_prefix')} ${task.dueDate}</span>` : ''}
          ${task.recurrence && task.recurrence !== 'none' ? `<span>${t('repeats_prefix')} ${t(`repeat_${task.recurrence}`)}</span>` : ''}
        </div>
        ${isOpen ? `<div class="task-actions">
          <button class="chip-btn" data-skip-task="${task.id}" title="${t('skip_to_pending')}">${icon('skip-forward')}<span>${t('skip_to_pending')}</span></button>
          ${Number(task.focusMinutes) > 0 ? `<button class="chip-btn ${running ? 'active' : ''}" data-focus-toggle="${task.id}" title="${running ? t('focus_pause') : t('focus_start')}">${icon(running ? 'pause' : 'play')}<span data-focus-chip="${task.id}">${focusLabel(task)}</span></button>` : ''}
        </div>` : ''}
      </div>
      <span class="badge ${priority.className}">${t(`priority_${task.priority}`)}</span>
    </article>
  `;
}

export function attachTaskCardEvents(container = document) {
  container.querySelectorAll('[data-task-id]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-status-toggle]')) return;
      if (event.target.closest('[data-skip-task]')) return;
      if (event.target.closest('[data-focus-toggle]')) return;
      openTaskDetail(card.dataset.taskId);
    });
  });
  container.querySelectorAll('[data-status-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      await toggleTaskStatus(button.dataset.statusToggle);
      window.refreshCurrentView();
    });
  });
  container.querySelectorAll('[data-skip-task]').forEach((button) => {
    button.addEventListener('click', async () => {
      await sendToPending(Number(button.dataset.skipTask));
      window.refreshCurrentView();
    });
  });
  container.querySelectorAll('[data-focus-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const id = Number(button.dataset.focusToggle);
      const task = await getTask(id);
      if (task.focusStartedAt) await stopFocus(id);
      else await startFocus(id);
      window.refreshCurrentView();
    });
  });
}

export async function toggleTaskStatus(id) {
  const task = await getTask(id);
  const next = task.status === 'todo' ? 'in_progress' : task.status === 'in_progress' ? 'completed' : 'todo';
  await setTaskStatus(id, next);
  if (next === 'completed') await createRecurringTaskInstance(task);
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
  if (!confirm(t('delete_confirm'))) return;
  const task = await getTask(id);
  await permanentDeleteTask(id);
  await pushDeletion('task', task?.uuid);
  window.refreshCurrentView();
}

export async function emptyArchiveAll() {
  const tasks = await getTasks();
  const archived = tasks.filter((task) => task.deletedAt);
  if (!archived.length) return;
  if (!confirm(t('empty_archive_confirm'))) return;
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
      <div class="modal-header"><div><p class="eyebrow">${escapeHtml(category?.name || '')}</p><h3>${t('create_task')}</h3></div><button class="icon-btn close-modal-btn">${icon('x')}</button></div>
      <div class="template-row">${templates.map((template) => `<button class="template-chip" data-template='${JSON.stringify(template)}'>${escapeHtml(template.title)}</button>`).join('')}</div>
      ${taskForm({ categoryId: selectedCategoryId, priority: 'medium', recurrence: 'none' }, categories, 'create-task-form')}
    `;
  }
  body.onclick = handleQuickAddClick;
  const form = body.querySelector('#create-task-form');
  if (form) form.addEventListener('submit', submitCreateTask);
  bindCategoryPickers(body);
  refreshIcons();
}

async function handleQuickAddClick(event) {
  const close = event.target.closest('.close-modal-btn');
  const category = event.target.closest('[data-pick-category]');
  const template = event.target.closest('[data-template]');
  if (close) closeQuickAdd();
  if (category) {
    selectedCategoryId = Number(category.dataset.pickCategory);
    await renderQuickAddForm();
  }
  if (template) {
    const data = JSON.parse(template.dataset.template);
    const form = document.querySelector('#create-task-form');
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
  document.querySelector('#task-modal').classList.remove('hidden');
  document.querySelector('#task-modal-body').innerHTML = `
    <div class="modal-header"><div><p class="eyebrow">${t('edit_task')}</p><h3>${escapeHtml(task.title)}</h3></div><button class="icon-btn" data-close-task>${icon('x')}</button></div>
    ${taskForm(task, categories, 'edit-task-form')}
    <div class="hero-actions"><button class="btn btn-danger" data-delete-task="${task.id}">${t('delete_task')}</button></div>
  `;
  document.querySelector('#edit-task-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await updateTask(task.id, formToTask(new FormData(event.currentTarget)));
    closeTaskModal();
    window.refreshCurrentView();
  });
  document.querySelector('[data-close-task]').addEventListener('click', closeTaskModal);
  document.querySelector('[data-delete-task]').addEventListener('click', () => archiveTaskById(task.id));
  bindCategoryPickers(document.querySelector('#task-modal-body'));
  refreshIcons();
}

function taskForm(task, categories, id) {
  return `
    <form id="${id}" class="form-grid">
      <input type="hidden" name="templateId" value="${task.templateId || ''}" />
      <input class="field" name="title" placeholder="${t('task_title_placeholder')}" value="${escapeAttr(task.title || '')}" required />
      <textarea class="textarea" name="description" placeholder="${t('description_placeholder')}">${escapeHtml(task.description || '')}</textarea>
      <div class="two-col form-grid">
        ${renderCategoryPicker(task.categoryId, categories)}
        <select class="select" name="priority"><option value="high" ${task.priority === 'high' ? 'selected' : ''}>${t('priority_high')}</option><option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>${t('priority_medium')}</option><option value="low" ${task.priority === 'low' ? 'selected' : ''}>${t('priority_low')}</option><option value="pending" ${task.priority === 'pending' ? 'selected' : ''}>${t('priority_pending')}</option></select>
      </div>
      <div class="two-col form-grid">
        <input class="field" type="date" name="dueDate" value="${task.dueDate || ''}" />
        <select class="select" name="recurrence"><option value="none" ${task.recurrence === 'none' ? 'selected' : ''}>${t('no_repeat')}</option><option value="daily" ${task.recurrence === 'daily' ? 'selected' : ''}>${t('daily')}</option><option value="weekly" ${task.recurrence === 'weekly' ? 'selected' : ''}>${t('weekly')}</option><option value="monthly" ${task.recurrence === 'monthly' ? 'selected' : ''}>${t('monthly')}</option><option value="yearly" ${task.recurrence === 'yearly' ? 'selected' : ''}>${t('yearly')}</option></select>
      </div>
      <select class="select" name="reminder"><option value="">${t('no_reminder')}</option><option value="15">${t('reminder_15')}</option><option value="60">${t('reminder_60')}</option><option value="1440">${t('reminder_1440')}</option></select>
      <input class="field" type="number" name="focusMinutes" min="0" step="1" placeholder="${t('focus_min_ph')}" value="${task.focusMinutes ? Number(task.focusMinutes) : ''}" />
      <button class="btn btn-primary" type="submit">${t('save_task')}</button>
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
    focusMinutes: Number(form.get('focusMinutes')) || 0
  };
}

export function closeQuickAdd() {
  document.querySelector('#quick-add-modal').classList.add('hidden');
}

function closeTaskModal() {
  document.querySelector('#task-modal').classList.add('hidden');
}

export function showOnboarding() {
  if (!isPrefEnabled('onboarding') || localStorage.getItem('todoMeva_onboarded')) return;
  const overlay = document.querySelector('#onboarding-overlay');
  overlay.classList.remove('hidden');
  document.querySelector('#onboarding-card').innerHTML = `<p class="eyebrow">${t('ob_welcome')}</p><h3>${t('ob_title')}</h3><p class="muted">${t('ob_body')}</p><button class="btn btn-primary" data-finish-onboarding>${t('ob_start')}</button>`;
  document.querySelector('[data-finish-onboarding]').addEventListener('click', () => {
    localStorage.setItem('todoMeva_onboarded', '1');
    overlay.classList.add('hidden');
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#039;');
}
