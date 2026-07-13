import { addTask, deleteTask, getCategories, getTask, getTemplatesByCategory, updateTask, setTaskStatus } from './db.js?v=1';
import { PRIORITY_CONFIG, STATUS_CONFIG } from './seed.js?v=1';
import { createRecurringTaskInstance } from './recurrence.js?v=1';

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
    <a href="#" class="brand" data-view="dashboard"><img src="assets/logo.svg" alt="Todo Meva" class="brand-logo" width="38" height="38"/><span>Todo Meva</span></a>
    <div class="sidebar-section">
      <p class="sidebar-title">Views</p>
      ${[
        ['dashboard', 'layout-dashboard', 'Dashboard'],
        ['upcoming', 'calendar-days', 'Upcoming'],
        ['priority', 'flag', 'Priority Matrix']
      ].map(([view, iconName, label]) => `<button class="nav-item ${activeView === view ? 'active' : ''}" data-view="${view}">${icon(iconName)}<span>${label}</span></button>`).join('')}
    </div>
    <div class="sidebar-section">
      <p class="sidebar-title">Categories</p>
      ${categories.map((category) => `
        <button class="category-item ${activeView === `category:${category.id}` ? 'active' : ''}" data-category-id="${category.id}">
          <span class="category-dot" style="background:${category.color}"></span><span>${category.name}</span><span class="count-pill">${countByCategory[category.id] || 0}</span>
        </button>`).join('')}
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
          <span>${category?.name || 'No category'}</span>
          ${task.dueDate ? `<span>Due ${task.dueDate}</span>` : ''}
          ${task.recurrence && task.recurrence !== 'none' ? `<span>Repeats ${task.recurrence}</span>` : ''}
        </div>
      </div>
      <span class="badge ${priority.className}">${priority.label}</span>
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
  if (!confirm('Delete this task?')) return;
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
      <div class="modal-header"><div><p class="eyebrow">Quick add</p><h3>Choose a category</h3></div><button class="icon-btn close-modal-btn">${icon('x')}</button></div>
      <div class="category-grid">${categories.map((category) => `<button class="category-card" data-pick-category="${category.id}"><span class="category-dot" style="background:${category.color}"></span><h3>${category.name}</h3><p class="muted">Use smart presets for this area.</p></button>`).join('')}</div>
    `;
  } else {
    const category = categories.find((item) => item.id === selectedCategoryId);
    const templates = await getTemplatesByCategory(selectedCategoryId);
    body.innerHTML = `
      <div class="modal-header"><div><p class="eyebrow">${category.name}</p><h3>Create task</h3></div><button class="icon-btn close-modal-btn">${icon('x')}</button></div>
      <div class="template-row">${templates.map((template) => `<button class="template-chip" data-template='${JSON.stringify(template)}'>${template.title}</button>`).join('')}</div>
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
    <div class="modal-header"><div><p class="eyebrow">Edit task</p><h3>${escapeHtml(task.title)}</h3></div><button class="icon-btn" data-close-task>${icon('x')}</button></div>
    ${taskForm(task, categories, 'edit-task-form')}
    <div class="hero-actions"><button class="btn btn-danger" data-delete-task="${task.id}">Delete task</button></div>
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
      <input class="field" name="title" placeholder="Task title" value="${escapeAttr(task.title || '')}" required />
      <textarea class="textarea" name="description" placeholder="Description">${escapeHtml(task.description || '')}</textarea>
      <div class="two-col form-grid">
        <select class="select" name="categoryId" required>${categories.map((category) => `<option value="${category.id}" ${Number(task.categoryId) === category.id ? 'selected' : ''}>${category.name}</option>`).join('')}</select>
        <select class="select" name="priority"><option value="high" ${task.priority === 'high' ? 'selected' : ''}>High</option><option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>Medium</option><option value="low" ${task.priority === 'low' ? 'selected' : ''}>Low</option></select>
      </div>
      <div class="two-col form-grid">
        <input class="field" type="date" name="dueDate" value="${task.dueDate || ''}" />
        <select class="select" name="recurrence"><option value="none" ${task.recurrence === 'none' ? 'selected' : ''}>No repeat</option><option value="daily" ${task.recurrence === 'daily' ? 'selected' : ''}>Daily</option><option value="weekly" ${task.recurrence === 'weekly' ? 'selected' : ''}>Weekly</option><option value="monthly" ${task.recurrence === 'monthly' ? 'selected' : ''}>Monthly</option><option value="yearly" ${task.recurrence === 'yearly' ? 'selected' : ''}>Yearly</option></select>
      </div>
      <select class="select" name="reminder"><option value="">No reminder</option><option value="15">15 minutes before</option><option value="60">1 hour before</option><option value="1440">1 day before</option></select>
      <button class="btn btn-primary" type="submit">Save task</button>
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
  if (localStorage.getItem('todoMeva_onboarded')) return;
  const overlay = document.querySelector('#onboarding-overlay');
  overlay.classList.remove('hidden');
  document.querySelector('#onboarding-card').innerHTML = `<p class="eyebrow">Welcome</p><h3>Plan your day with calm clarity.</h3><p class="muted">Use categories, templates, due dates, recurrence, reminders, and export/import to keep your tasks organized.</p><button class="btn btn-primary" data-finish-onboarding>Start</button>`;
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
