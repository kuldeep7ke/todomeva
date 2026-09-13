import { addTask, deleteTask, getCategories, getTask, getTemplatesByCategory, updateTask, setTaskStatus } from './db.js?v=4';
import { PRIORITY_CONFIG, STATUS_CONFIG } from './seed.js?v=4';
import { createRecurringTaskInstance } from './recurrence.js?v=4';
import { t } from './i18n.js?v=5';
import { isPrefEnabled } from './prefs.js?v=4';

let selectedCategoryId = null;

export function icon(name) {
  return `<i data-lucide="${name}"></i>`;
}

export function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

export function renderSidebar(categories, tasks, activeView) {
  const sidebar = document.querySelector('#sidebar');
  const countByCategory = tasks.reduce((counts, task) => {
    if (task.status !== 'completed') counts[task.categoryId] = (counts[task.categoryId] || 0) + 1;
    return counts;
  }, {});
  sidebar.innerHTML = `
    <div class="sidebar-main">
      <a href="#" class="brand" data-view="dashboard"><img src="assets/logo.svg" alt="${t('app_name')}" class="brand-logo" width="38" height="38"/><span>${t('app_name')}</span></a>
      <div class="sidebar-section">
        <p class="sidebar-title">${t('views')}</p>
        ${[
          ['dashboard', 'layout-dashboard', t('dashboard')],
          ['upcoming', 'calendar-days', t('upcoming')],
          ['priority', 'flag', t('priority_matrix')]
        ].map(([view, iconName, label]) => `<button class="nav-item ${activeView === view ? 'active' : ''}" data-view="${view}">${icon(iconName)}<span>${label}</span></button>`).join('')}
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

export function renderTaskCard(task, category) {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const status = STATUS_CONFIG[task.status] || STATUS_CONFIG.todo;
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
      </div>
      <span class="badge ${priority.className}">${t(`priority_${task.priority}`)}</span>
    </article>
  `;
}

export function attachTaskCardEvents(container = document) {
  container.querySelectorAll('[data-task-id]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.target.closest('[data-status-toggle]')) return;
      openTaskDetail(card.dataset.taskId);
    });
  });
  container.querySelectorAll('[data-status-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      await toggleTaskStatus(button.dataset.statusToggle);
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

export async function deleteTaskById(id) {
  if (!confirm(t('delete_confirm'))) return;
  await deleteTask(id);
  closeTaskModal();
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
  document.querySelector('[data-delete-task]').addEventListener('click', () => deleteTaskById(task.id));
  refreshIcons();
}

function taskForm(task, categories, id) {
  return `
    <form id="${id}" class="form-grid">
      <input type="hidden" name="templateId" value="${task.templateId || ''}" />
      <input class="field" name="title" placeholder="${t('task_title_placeholder')}" value="${escapeAttr(task.title || '')}" required />
      <textarea class="textarea" name="description" placeholder="${t('description_placeholder')}">${escapeHtml(task.description || '')}</textarea>
      <div class="two-col form-grid">
        <select class="select" name="categoryId" required>${categories.map((category) => `<option value="${category.id}" ${Number(task.categoryId) === category.id ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}</select>
        <select class="select" name="priority"><option value="high" ${task.priority === 'high' ? 'selected' : ''}>${t('priority_high')}</option><option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>${t('priority_medium')}</option><option value="low" ${task.priority === 'low' ? 'selected' : ''}>${t('priority_low')}</option></select>
      </div>
      <div class="two-col form-grid">
        <input class="field" type="date" name="dueDate" value="${task.dueDate || ''}" />
        <select class="select" name="recurrence"><option value="none" ${task.recurrence === 'none' ? 'selected' : ''}>${t('no_repeat')}</option><option value="daily" ${task.recurrence === 'daily' ? 'selected' : ''}>${t('daily')}</option><option value="weekly" ${task.recurrence === 'weekly' ? 'selected' : ''}>${t('weekly')}</option><option value="monthly" ${task.recurrence === 'monthly' ? 'selected' : ''}>${t('monthly')}</option><option value="yearly" ${task.recurrence === 'yearly' ? 'selected' : ''}>${t('yearly')}</option></select>
      </div>
      <select class="select" name="reminder"><option value="">${t('no_reminder')}</option><option value="15">${t('reminder_15')}</option><option value="60">${t('reminder_60')}</option><option value="1440">${t('reminder_1440')}</option></select>
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
    reminders: reminder ? [{ minutesBefore: Number(reminder), fired: false }] : []
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
