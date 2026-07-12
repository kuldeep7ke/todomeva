import { getAllCategories, getTemplatesByCategory, getTask, saveTask, deleteTask, saveCategory, logActivity, getCategory } from './db.js?v=4';
import { PRIORITY_CONFIG, STATUS_CONFIG } from './seed.js?v=4';
import { createRecurringTaskInstance, calculateNextOccurrence } from './recurrence.js?v=4';

let currentView = 'dashboard';
let currentFilter = null;

export function setView(view, filter) { currentView = view; currentFilter = filter || null; }
export function getCurrentView() { return currentView; }
export function getCurrentFilter() { return currentFilter; }

export function renderSidebar(categories, activeView, activeCategoryId, counts) {
  const nav = document.getElementById('sidebar-nav');
  const catList = document.getElementById('category-list');
  const views = [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'upcoming', label: 'Upcoming', icon: 'calendar' },
    { id: 'categories', label: 'Categories', icon: 'folder-tree' },
    { id: 'priority', label: 'Priority Matrix', icon: 'gantt-chart-square' }
  ];
  nav.innerHTML = views.map(v =>
    `<button class="nav-btn ${activeView === v.id ? 'active' : ''}" data-view="${v.id}">
      <i data-lucide="${v.icon}" class="w-4 h-4 flex-shrink-0"></i>
      <span>${v.label}</span>
    </button>`
  ).join('');

  const allC = counts?.all;
  catList.innerHTML = `
    <div class="section-label">Categories</div>
    <button class="cat-btn ${activeView === 'categories' ? 'active' : ''}" data-category-id="all">
      <i data-lucide="list" class="w-4 h-4"></i>
      <span>All Tasks</span>
      ${allC !== undefined ? `<span class="cat-count">${allC}</span>` : ''}
    </button>
    ${categories.map(c => {
      const count = counts?.[c.id];
      const isActive = activeView === 'category' && activeCategoryId === c.id;
      return `<button class="cat-btn ${isActive ? 'active' : ''}" data-category-id="${c.id}">
        <i data-lucide="${c.icon}" class="w-4 h-4" style="color:${c.color}"></i>
        <span class="flex-1 text-left truncate">${c.name}</span>
        ${count !== undefined ? `<span class="cat-count">${count}</span>` : ''}
      </button>`;
    }).join('')}
    <button id="add-category-btn"><i data-lucide="plus-circle" class="w-4 h-4"></i> Add Category</button>
  `;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

export function renderTaskList(tasks, categories, containerId = 'view-content') {
  const container = document.getElementById(containerId);
  if (!tasks || tasks.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <i data-lucide="inbox" class="w-14 h-14"></i>
      <p>No tasks yet</p>
      <span>Click the + button to create your first task</span>
    </div>`;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    return;
  }
  container.innerHTML = `<div class="space-y-2">${tasks.map(t => renderTaskCard(t, categories)).join('')}</div>`;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  attachTaskCardEvents(container);
}

export function renderTaskCard(task, categories) {
  const cat = categories?.find(c => c.id === task.categoryId);
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const overdue = due && due < new Date() && task.status !== 'completed' && task.status !== 'archived';
  const dueSoon = due && !overdue && (due - new Date()) < 86400000 && task.status !== 'completed';

  return `<div class="task-card ${task.status === 'completed' ? 'completed' : ''}" data-task-id="${task.id}">
    <div class="flex items-start gap-3">
      <button class="status-checkbox ${task.status === 'completed' ? 'done' : ''} ${task.status === 'in_progress' ? 'in-progress' : ''}" data-task-id="${task.id}" data-action="toggle-status">
        ${task.status === 'completed' ? '<i data-lucide="check" class="w-3 h-3 text-white"></i>' : ''}
        ${task.status === 'in_progress' ? '<i data-lucide="loader" class="w-3 h-3" style="color:#FFCF9A"></i>' : ''}
      </button>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-sm font-medium ${task.status === 'completed' ? 'line-through' : ''}" style="color:${task.status === 'completed' ? 'rgba(var(--text-rgb),0.35)' : 'rgba(var(--text-rgb),0.9)'}">${esc(task.title)}</span>
          ${cat ? `<span class="badge badge-category"><i data-lucide="${cat.icon}" class="w-3 h-3"></i> ${cat.name}</span>` : ''}
          <span class="badge badge-${task.priority}"><i data-lucide="${PRIORITY_CONFIG[task.priority]?.icon || 'minus'}" class="w-3 h-3"></i> ${PRIORITY_CONFIG[task.priority]?.label || task.priority}</span>
          <span class="badge badge-status badge-${task.status}">${STATUS_CONFIG[task.status]?.label || task.status}</span>
        </div>
        ${task.description ? `<p style="color:rgba(var(--text-rgb),0.35);font-size:12px;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(task.description)}</p>` : ''}
        <div style="display:flex;align-items:center;gap:16px;margin-top:6px;font-size:11px;color:rgba(var(--text-rgb),0.25)">
          ${due ? `<span style="display:flex;align-items:center;gap:4px;${overdue ? 'color:#f87171;font-weight:500' : dueSoon ? 'color:#FFCF9A' : ''}">
            <i data-lucide="clock" class="w-3 h-3"></i>${formatDate(due)}${overdue ? ' (Overdue)' : ''}
          </span>` : ''}
          ${task.recurrence ? `<span style="display:flex;align-items:center;gap:4px;color:rgba(255,138,61,0.5)"><i data-lucide="repeat" class="w-3 h-3"></i> ${task.recurrence.type}</span>` : ''}
          ${task.reminders?.length ? `<span style="display:flex;align-items:center;gap:4px"><i data-lucide="bell" class="w-3 h-3"></i> ${task.reminders.length}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:4px;opacity:0;transition:opacity 0.15s" class="task-actions">
        <button class="p-1.5 rounded-lg" style="color:rgba(var(--text-rgb),0.25);background:transparent;border:none;cursor:pointer;transition:all 0.15s" data-task-id="${task.id}" data-action="edit"
          onmouseover="this.style.color='var(--accent-primary)';this.style.background='rgba(var(--accent-rgb),0.1)'" onmouseout="this.style.color='rgba(var(--text-rgb),0.25)';this.style.background='transparent'">
          <i data-lucide="pencil" class="w-4 h-4"></i>
        </button>
        <button class="p-1.5 rounded-lg" style="color:rgba(var(--text-rgb),0.25);background:transparent;border:none;cursor:pointer;transition:all 0.15s" data-task-id="${task.id}" data-action="delete"
          onmouseover="this.style.color='#f87171';this.style.background='rgba(248,113,113,0.1)'" onmouseout="this.style.color='rgba(var(--text-rgb),0.25)';this.style.background='transparent'">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    </div>
  </div>`;
}

export function attachTaskCardEvents(container) {
  container.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      openTaskDetail(parseInt(card.dataset.taskId));
    });
  });
  container.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleTaskStatus(parseInt(btn.dataset.taskId)); });
  });
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openTaskDetail(parseInt(btn.dataset.taskId)); });
  });
  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteTaskById(parseInt(btn.dataset.taskId)); });
  });
}

export async function toggleTaskStatus(id) {
  const task = await getTask(id);
  if (!task) return;
  const cycle = { 'todo': 'in_progress', 'in_progress': 'completed', 'completed': 'todo' };
  task.status = cycle[task.status] || 'todo';
  if (task.status === 'completed') {
    task.completedAt = new Date().toISOString();
    await saveTask(task);
    const cats = await getAllCategories();
    const cat = cats.find(c => c.id === task.categoryId);
    logActivity('task_completed', task, cat?.name);
    if (task.recurrence) {
      const next = calculateNextOccurrence(task);
      if (next) {
        const nt = createRecurringTaskInstance(task, next);
        const nid = await saveTask(nt);
        logActivity('task_recurred', { ...nt, id: nid }, cat?.name);
      }
    }
  } else {
    task.completedAt = null;
    await saveTask(task);
  }
  if (typeof window.refreshCurrentView === 'function') window.refreshCurrentView();
}

export async function deleteTaskById(id) {
  if (!confirm('Delete this task permanently?')) return;
  const task = await getTask(id);
  if (task) {
    const cats = await getAllCategories();
    const cat = cats.find(c => c.id === task.categoryId);
    logActivity('task_deleted', task, cat?.name);
  }
  await deleteTask(id);
  if (typeof window.refreshCurrentView === 'function') window.refreshCurrentView();
}

export async function openQuickAdd(preselectedCategory) {
  const modal = document.getElementById('quick-add-modal');
  document.getElementById('modal-overlay').classList.remove('hidden');
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  await renderQuickAddForm(preselectedCategory || null);
}

export async function openTaskDetail(taskId) {
  const task = await getTask(taskId);
  if (!task) return;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('task-detail-modal').classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  renderDetailForm(task);
}

async function renderQuickAddForm(preselected) {
  const container = document.getElementById('quick-add-body');
  const categories = await getAllCategories();
  let step = preselected ? 1 : 0;
  let selCat = preselected ? categories.find(c => c.id === preselected) || null : null;
  let selTmpl = null;

  async function render() {
    if (step === 0) {
      container.innerHTML = `
        <div style="padding:28px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
            <h2 style="font-size:18px;font-weight:700">Choose Category</h2>
            <button class="close-modal-btn" style="color:rgba(var(--text-rgb),0.3);background:none;border:none;cursor:pointer"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px">
            ${categories.map(c => `
              <button class="cat-select-btn" data-cat-id="${c.id}">
                <i data-lucide="${c.icon}" class="w-7 h-7" style="color:${c.color}"></i>
                <span>${c.name}</span>
              </button>
            `).join('')}
          </div>
        </div>`;
      container.querySelectorAll('.cat-select-btn').forEach(b => {
        b.addEventListener('click', () => { selCat = categories.find(c => c.id === parseInt(b.dataset.catId)); step = 1; render().catch(e => console.error('Quick add render error:', e)); });
      });
    } else {
      const templates = selCat ? await getTemplatesByCategory(selCat.id) : [];
      container.innerHTML = `
        <div style="padding:28px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
            <div style="display:flex;align-items:center;gap:12px">
              ${step === 1 ? '<button id="back-step" style="color:rgba(var(--text-rgb),0.3);background:none;border:none;cursor:pointer"><i data-lucide="arrow-left" class="w-5 h-5"></i></button>' : ''}
              <h2 style="font-size:18px;font-weight:700">New Task</h2>
            </div>
            <button class="close-modal-btn" style="color:rgba(var(--text-rgb),0.3);background:none;border:none;cursor:pointer"><i data-lucide="x" class="w-5 h-5"></i></button>
          </div>
          ${selCat ? `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(var(--text-rgb),0.04);border-radius:10px;margin-bottom:16px;border:1px solid rgba(var(--text-rgb),0.05)">
            <i data-lucide="${selCat.icon}" class="w-4 h-4" style="color:${selCat.color}"></i>
            <span style="font-size:13px;color:rgba(var(--text-rgb),0.7)">${selCat.name}</span>
            <button id="change-cat" style="margin-left:auto;font-size:11px;color:#FF8A3D;background:none;border:none;cursor:pointer">Change</button>
          </div>` : ''}
          ${templates.length ? `<div style="margin-bottom:16px">
            <label style="font-size:10px;font-weight:600;color:rgba(var(--text-rgb),0.35);text-transform:uppercase;letter-spacing:0.5px;display:block;margin-bottom:8px">Quick Templates</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${templates.map(t => `<button class="tmpl-btn ${selTmpl?.id === t.id ? 'selected' : ''}" data-tmpl-id="${t.id}">${esc(t.title)}</button>`).join('')}
            </div>
          </div>` : ''}
          <form id="quick-task-form">
            <div style="margin-bottom:12px">
              <label class="form-label">Title *</label>
              <input type="text" id="qt-title" required class="form-input" placeholder="What needs to be done?" value="${selTmpl ? esc(selTmpl.title) : ''}">
            </div>
            <div style="margin-bottom:12px">
              <label class="form-label">Description</label>
              <textarea id="qt-desc" class="form-input" placeholder="Add details..." rows="2">${selTmpl ? esc(selTmpl.description) : ''}</textarea>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <div>
                <label class="form-label">Priority</label>
                <select id="qt-priority" class="form-input">
                  <option value="high" ${selTmpl?.priority === 'high' ? 'selected' : ''}>High</option>
                  <option value="medium" ${!selTmpl || selTmpl.priority === 'medium' ? 'selected' : ''}>Medium</option>
                  <option value="low" ${selTmpl?.priority === 'low' ? 'selected' : ''}>Low</option>
                </select>
              </div>
              <div>
                <label class="form-label">Status</label>
                <select id="qt-status" class="form-input">
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <div><label class="form-label">Due Date</label><input type="date" id="qt-due-date" class="form-input"></div>
              <div><label class="form-label">Due Time</label><input type="time" id="qt-due-time" class="form-input"></div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
              <div><label class="form-label">Start Date</label><input type="date" id="qt-start" class="form-input"></div>
              <div>
                <label class="form-label">Recurrence</label>
                <select id="qt-recurrence" class="form-input">
                  <option value="">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <div style="margin-bottom:16px">
              <label class="form-label">Reminders</label>
              <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">
                ${[{v:15,u:'minutes',l:'15 min'},{v:30,u:'minutes',l:'30 min'},{v:1,u:'hours',l:'1 hour'},{v:2,u:'hours',l:'2 hours'},{v:1,u:'days',l:'1 day'},{v:2,u:'days',l:'2 days'}].map(r => `
                  <label class="reminder-chip" data-value="${r.v}" data-unit="${r.u}">
                    <span class="checkbox-custom"></span>
                    ${r.l}
                  </label>
                `).join('')}
              </div>
            </div>
            <div style="display:flex;gap:12px">
              <button type="button" class="close-modal-btn" style="flex:1;padding:10px;font-size:13px;font-weight:500;background:rgba(var(--text-rgb),0.05);border:1px solid rgba(var(--text-rgb),0.08);border-radius:10px;color:rgba(var(--text-rgb),0.5);cursor:pointer">Cancel</button>
              <button type="submit" style="flex:1;padding:10px;font-size:13px;font-weight:600;background:linear-gradient(135deg,var(--accent-primary),var(--accent-secondary));border:none;border-radius:10px;color:var(--button-text);cursor:pointer;font-family:inherit">Create Task</button>
            </div>
          </form>
        </div>`;

      const back = container.querySelector('#back-step');
      if (back) back.addEventListener('click', () => { step = 0; selTmpl = null; render().catch(e => console.error('Quick add render error:', e)); });
      const change = container.querySelector('#change-cat');
      if (change) change.addEventListener('click', () => { step = 0; selTmpl = null; render().catch(e => console.error('Quick add render error:', e)); });
      container.querySelectorAll('.tmpl-btn').forEach(b => {
        b.addEventListener('click', () => {
          selTmpl = templates.find(t => t.id === parseInt(b.dataset.tmplId));
          container.querySelectorAll('.tmpl-btn').forEach(x => x.classList.remove('selected'));
          b.classList.add('selected');
          document.getElementById('qt-title').value = selTmpl.title;
          document.getElementById('qt-desc').value = selTmpl.description;
          document.getElementById('qt-priority').value = selTmpl.priority;
        });
      });
      container.querySelectorAll('.reminder-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          chip.classList.toggle('active');
          const cb = chip.querySelector('.checkbox-custom');
          if (chip.classList.contains('active')) {
            cb.style.background = '#FF8A3D';
            cb.style.borderColor = '#FF8A3D';
            cb.innerHTML = '<i data-lucide="check" class="w-2.5 h-2.5 text-white"></i>';
          } else {
            cb.style.background = 'transparent';
            cb.style.borderColor = 'rgba(var(--text-rgb),0.15)';
            cb.innerHTML = '';
          }
          if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
        });
      });
      document.getElementById('quick-task-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('qt-title').value.trim();
        if (!title) return;
        const reminders = [];
        container.querySelectorAll('.reminder-chip.active').forEach(chip => {
          reminders.push({ value: parseInt(chip.dataset.value), unit: chip.dataset.unit, triggered: false });
        });
        const recType = document.getElementById('qt-recurrence').value;
        const dd = document.getElementById('qt-due-date').value;
        const dt = document.getElementById('qt-due-time').value;
        let dueDate = null;
        if (dd) dueDate = dt ? `${dd}T${dt}:00` : `${dd}T23:59:59`;
        const st = document.getElementById('qt-start').value;
        const task = {
          title, description: document.getElementById('qt-desc').value.trim(),
          categoryId: selCat?.id || null, templateId: selTmpl?.id || null,
          priority: document.getElementById('qt-priority').value,
          status: document.getElementById('qt-status').value,
          dueDate, startDate: st ? `${st}T00:00:00` : null,
          recurrence: recType ? { type: recType, interval: 1, endDate: null } : null,
          reminders: reminders.length ? reminders : null
        };
        const id = await saveTask(task);
        logActivity('task_created', { ...task, id }, selCat?.name);
        closeModals();
        if (typeof window.refreshCurrentView === 'function') window.refreshCurrentView();
      });
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
  container.onclick = (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest('.close-modal-btn')) closeModals();
  };
  await render();
}

function renderDetailForm(task) {
  const container = document.getElementById('task-detail-body');
  const categories = []; // loaded below
  container.innerHTML = `
    <div style="padding:28px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <h2 style="font-size:18px;font-weight:700">Edit Task</h2>
        <button class="close-modal-btn" style="color:rgba(var(--text-rgb),0.3);background:none;border:none;cursor:pointer"><i data-lucide="x" class="w-5 h-5"></i></button>
      </div>
      <form id="detail-task-form">
        <div style="margin-bottom:12px">
          <label class="form-label">Title *</label>
          <input type="text" id="dt-title" required class="form-input" value="${esc(task.title)}">
        </div>
        <div style="margin-bottom:12px">
          <label class="form-label">Description</label>
          <textarea id="dt-desc" class="form-input" rows="2">${esc(task.description || '')}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label class="form-label">Priority</label>
            <select id="dt-priority" class="form-input">
              <option value="high" ${task.priority==='high'?'selected':''}>High</option>
              <option value="medium" ${task.priority==='medium'?'selected':''}>Medium</option>
              <option value="low" ${task.priority==='low'?'selected':''}>Low</option>
            </select>
          </div>
          <div>
            <label class="form-label">Status</label>
            <select id="dt-status" class="form-input">
              <option value="todo" ${task.status==='todo'?'selected':''}>To Do</option>
              <option value="in_progress" ${task.status==='in_progress'?'selected':''}>In Progress</option>
              <option value="completed" ${task.status==='completed'?'selected':''}>Completed</option>
              <option value="archived" ${task.status==='archived'?'selected':''}>Archived</option>
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div><label class="form-label">Due Date</label><input type="date" id="dt-due-date" class="form-input" value="${task.dueDate ? task.dueDate.substring(0,10) : ''}"></div>
          <div><label class="form-label">Due Time</label><input type="time" id="dt-due-time" class="form-input" value="${task.dueDate && task.dueDate.length>10 ? task.dueDate.substring(11,16) : ''}"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div><label class="form-label">Start Date</label><input type="date" id="dt-start" class="form-input" value="${task.startDate ? task.startDate.substring(0,10) : ''}"></div>
          <div>
            <label class="form-label">Recurrence</label>
            <select id="dt-recurrence" class="form-input">
              <option value="">None</option>
              <option value="daily" ${task.recurrence?.type==='daily'?'selected':''}>Daily</option>
              <option value="weekly" ${task.recurrence?.type==='weekly'?'selected':''}>Weekly</option>
              <option value="monthly" ${task.recurrence?.type==='monthly'?'selected':''}>Monthly</option>
              <option value="yearly" ${task.recurrence?.type==='yearly'?'selected':''}>Yearly</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:12px">
          <button type="button" id="delete-detail-task" style="padding:10px 20px;font-size:13px;font-weight:500;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.2);border-radius:10px;color:#f87171;cursor:pointer">Delete</button>
          <button type="button" class="close-modal-btn" style="flex:1;padding:10px;font-size:13px;font-weight:500;background:rgba(var(--text-rgb),0.05);border:1px solid rgba(var(--text-rgb),0.08);border-radius:10px;color:rgba(var(--text-rgb),0.5);cursor:pointer">Cancel</button>
          <button type="submit" style="flex:1;padding:10px;font-size:13px;font-weight:600;background:linear-gradient(135deg,var(--accent-primary),var(--accent-secondary));border:none;border-radius:10px;color:var(--button-text);cursor:pointer;font-family:inherit">Save Changes</button>
        </div>
      </form>
    </div>`;

  container.querySelectorAll('.close-modal-btn').forEach(el => el.addEventListener('click', closeModals));
  document.getElementById('delete-detail-task').addEventListener('click', async () => {
    if (!confirm('Delete this task permanently?')) return;
    const cats = await getAllCategories();
    const cat = cats.find(c => c.id === task.categoryId);
    logActivity('task_deleted', task, cat?.name);
    await deleteTask(task.id);
    closeModals();
    if (typeof window.refreshCurrentView === 'function') window.refreshCurrentView();
  });
  document.getElementById('detail-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('dt-title').value.trim();
    if (!title) return;
    const dd = document.getElementById('dt-due-date').value;
    const dt = document.getElementById('dt-due-time').value;
    task.title = title;
    task.description = document.getElementById('dt-desc').value.trim();
    task.priority = document.getElementById('dt-priority').value;
    task.status = document.getElementById('dt-status').value;
    task.dueDate = dd ? (dt ? `${dd}T${dt}:00` : `${dd}T23:59:59`) : null;
    task.startDate = document.getElementById('dt-start').value ? `${document.getElementById('dt-start').value}T00:00:00` : null;
    const recType = document.getElementById('dt-recurrence').value;
    task.recurrence = recType ? { type: recType, interval: 1, endDate: null } : null;
    task.updatedAt = new Date().toISOString();
    if (task.status === 'completed' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
      await saveTask(task);
      if (task.recurrence) {
        const next = calculateNextOccurrence(task);
        if (next) {
          const nt = createRecurringTaskInstance(task, next);
          await saveTask(nt);
        }
      }
    } else {
      if (task.status !== 'completed') task.completedAt = null;
      await saveTask(task);
    }
    const cats = await getAllCategories();
    const cat = cats.find(c => c.id === task.categoryId);
    logActivity('task_updated', task, cat?.name);
    closeModals();
    if (typeof window.refreshCurrentView === 'function') window.refreshCurrentView();
  });
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

export function closeModals() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  document.getElementById('modal-overlay')?.classList.add('hidden');
  document.body.classList.remove('overflow-hidden');
}

// Onboarding
const ONBOARDING_STEPS = [
  {
    icon: 'sparkles', title: 'Welcome to Todo Meva',
    desc: 'Your intelligent productivity companion with smart categories, domain-specific templates, and beautiful glassmorphism design. Let\'s take a quick tour!'
  },
  {
    icon: 'layout-dashboard', title: 'Your Dashboard',
    desc: 'The Dashboard shows your activity stats, task completion streak, and a timeline of recent actions. It adapts to how you work.'
  },
  {
    icon: 'folder-tree', title: 'Smart Categories',
    desc: '8 domain-specific categories come pre-loaded with templates. Select a category in Quick Add to instantly see relevant task captions.'
  },
  {
    icon: 'zap', title: 'Quick Add (Ctrl+K)',
    desc: 'Press Ctrl+K or click the + button to open the Quick Add modal. Pick a category, click a template, and your task is pre-filled in seconds.'
  },
  {
    icon: 'bell', title: 'Reminders & Recurrence',
    desc: 'Set reminders with Web Notifications, configure recurring tasks (daily/weekly/monthly), and they auto-generate when completed. You\'re all set!'
  }
];

export function showOnboarding() {
  const overlay = document.getElementById('onboarding-overlay');
  overlay.classList.remove('hidden');
  let step = 0;

  function renderStep() {
    const s = ONBOARDING_STEPS[step];
    document.querySelector('#onb-icon').innerHTML = `<i data-lucide="${s.icon}" class="w-8 h-8" style="color:#FF8A3D"></i>`;
    document.getElementById('onb-title').textContent = s.title;
    document.getElementById('onb-desc').textContent = s.desc;
    document.querySelectorAll('.onb-step-dot').forEach((dot, i) => {
      dot.className = 'onb-step-dot' + (i === step ? ' active' : i < step ? ' done' : '');
    });
    document.getElementById('onb-next').textContent = step < ONBOARDING_STEPS.length - 1 ? 'Next' : 'Get Started';
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  renderStep();

  document.getElementById('onb-next').onclick = () => {
    if (step < ONBOARDING_STEPS.length - 1) { step++; renderStep(); }
    else { closeOnboarding(); }
  };
  document.getElementById('onb-skip').onclick = closeOnboarding;
}

function closeOnboarding() {
  document.getElementById('onboarding-overlay').classList.add('hidden');
  try {
    localStorage.setItem('todoMeva_onboardingDone', 'true');
  } catch (e) {}
}

export function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

export function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const t = new Date(now); t.setDate(t.getDate() + 1);
  if (d.toDateString() === t.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}
