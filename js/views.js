import { getAllCategories, getAllTasks, getUpcomingTasks, saveTask, logActivity } from './db.js?v=4';
import { renderTaskList, renderTaskCard, formatDate, attachTaskCardEvents, esc } from './components.js?v=4';

export async function renderDashboard() {
  const container = document.getElementById('view-content');
  const header = document.getElementById('view-header');

  // Phase 1: guarantee visible content immediately
  if (container) {
    container.innerHTML = '<div style="background:rgba(var(--accent-rgb),0.06);border:2px solid var(--accent-primary);border-radius:12px;padding:30px;margin:20px;text-align:center;color:var(--text-primary)"><p style="font-size:15px">Rendering dashboard...</p></div>';
  }

  if (!container || !header) {
    console.error('renderDashboard: missing container or header');
    return;
  }

  try {
    header.querySelector('h1').textContent = 'Dashboard';
    const subtitleEl = header.querySelector('.view-subtitle');
    if (subtitleEl) subtitleEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    else console.warn('Dashboard subtitle element not found');

    const [categories, allTasks] = await Promise.all([getAllCategories(), getAllTasks()]);

    const activeTasks = allTasks.filter(t => t.status !== 'archived');
    const todoTasks = activeTasks.filter(t => t.status === 'todo');
    const inProgress = activeTasks.filter(t => t.status === 'in_progress');
    const completed = allTasks.filter(t => t.status === 'completed');
    const now = new Date();
    const todayStr = now.toDateString();
    const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed');
    const todayTasks = activeTasks.filter(t => {
      if (!t.dueDate || t.status === 'completed') return false;
      const due = new Date(t.dueDate);
      return due.toDateString() === todayStr && due >= now;
    });
    const doneCount = completed.length;
    const overdueCount = overdueTasks.length;
    const otherTasks = activeTasks.filter(t => {
      if (t.status === 'completed') return false;
      const due = t.dueDate ? new Date(t.dueDate) : null;
      if (due && due.toDateString() === todayStr) return false;
      if (due && due < now) return false;
      return true;
    });

    let html = '';

    // Quick Create
    html += `<div class="dash-quick-create">
      <form id="dash-quick-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input type="text" id="dash-quick-title" placeholder="What needs to be done?" style="flex:1;min-width:140px" class="form-input" required>
        <select id="dash-quick-cat" class="form-input" style="flex:0 0 130px">
          <option value="">No category</option>
          ${categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        <select id="dash-quick-priority" class="form-input" style="flex:0 0 90px">
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
        <button type="submit" class="dash-create-btn">+ Add</button>
      </form>
    </div>`;

    // Category Cards
    if (categories.length > 0) {
      html += `<div class="dash-cat-grid">`;
      categories.forEach(c => {
        const count = activeTasks.filter(t => t.categoryId === c.id).length;
        html += `<button class="dash-cat-card" data-action="navigate" data-view="category" data-category-id="${c.id}">
          <i data-lucide="${c.icon}" class="w-4 h-4" style="color:${c.color}"></i>
          <span class="dash-cat-name">${esc(c.name)}</span>
          <span class="dash-cat-count">${count} todo${count !== 1 ? 's' : ''}</span>
        </button>`;
      });
      html += `</div>`;
    }

    // Stats
    html += `<div class="dash-stats-bar">
      <div class="dash-stat-item"><span class="dash-stat-num">${todoTasks.length}</span><span class="dash-stat-label">To Do</span></div>
      <div class="dash-stat-item"><span class="dash-stat-num">${inProgress.length}</span><span class="dash-stat-label">Doing</span></div>
      <div class="dash-stat-item"><span class="dash-stat-num" style="color:#34d399">${doneCount}</span><span class="dash-stat-label">Done</span></div>
      <div class="dash-stat-item${overdueCount > 0 ? ' clickable' : ''}" data-action="navigate" data-view="categories">
        <span class="dash-stat-num" style="color:${overdueCount > 0 ? '#f87171' : 'rgba(var(--text-rgb),0.25)'}">${overdueCount}</span>
        <span class="dash-stat-label">Overdue</span>
      </div>
    </div>`;

    // Today / Overdue / Other
    if (todayTasks.length > 0) {
      html += `<div style="margin-bottom:14px"><div class="section-header" style="margin-bottom:6px"><i data-lucide="calendar" class="w-4 h-4" style="color:#FF8A3D"></i><h2 style="font-size:14px">Today</h2></div><div class="space-y-2">${todayTasks.map(t => renderTaskCard(t, categories)).join('')}</div></div>`;
    }
    if (overdueCount > 0) {
      html += `<div style="margin-bottom:14px"><div class="section-header" style="margin-bottom:6px"><i data-lucide="alert-circle" class="w-4 h-4" style="color:#f87171"></i><h2 style="color:#f87171;font-size:14px">Overdue</h2></div><div class="space-y-2">${overdueTasks.map(t => renderTaskCard(t, categories)).join('')}</div></div>`;
    }
    if (otherTasks.length > 0) {
      html += `<div class="space-y-2">${otherTasks.map(t => renderTaskCard(t, categories)).join('')}</div>`;
    }

    // Empty state
    if (activeTasks.length === 0 && doneCount === 0) {
      html += `<div class="empty-state" style="padding:40px 20px;margin-top:10px"><i data-lucide="inbox" class="w-14 h-14"></i><p>No tasks yet</p><span style="font-size:13px;color:rgba(var(--text-rgb),0.3)">Type a task above and hit Add to get started!</span></div>`;
    } else if (otherTasks.length === 0 && overdueCount === 0 && todayTasks.length === 0) {
      html += `<div class="empty-state" style="padding:30px 20px"><i data-lucide="check-circle" class="w-12 h-12" style="color:#34d399"></i><p>All caught up!</p><span style="font-size:13px;color:rgba(var(--text-rgb),0.3)">${doneCount} task${doneCount !== 1 ? 's' : ''} completed</span></div>`;
    }

    // Fallback — if html is still empty, insert something visible
    if (!html.trim()) html = '<div class="empty-state" style="padding:40px 20px"><p style="color:rgba(var(--text-rgb),0.4)">Dashboard loaded (empty)</p></div>';

    container.innerHTML = html;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    attachTaskCardEvents(container);

    // Navigate clicks
    container.querySelectorAll('[data-action="navigate"]').forEach(el => {
      el.addEventListener('click', () => {
        const view = el.dataset.view;
        const catId = el.dataset.categoryId || null;
        if (window.navigateTo) window.navigateTo(view, catId);
      });
    });

    // Quick create
    document.getElementById('dash-quick-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('dash-quick-title').value.trim();
      if (!title) return;
      const catId = document.getElementById('dash-quick-cat').value;
      const priority = document.getElementById('dash-quick-priority').value;
      const cat = categories.find(c => c.id === parseInt(catId));
      const taskData = { title, description: '', categoryId: catId ? parseInt(catId) : null, priority, status: 'todo', dueDate: null, startDate: null, recurrence: null, reminders: null };
      const id = await saveTask(taskData);
      logActivity('task_created', { ...taskData, id }, cat?.name);
      document.getElementById('dash-quick-title').value = '';
      if (window.refreshCurrentView) window.refreshCurrentView();
    });

  } catch (e) {
    console.error('Dashboard render error:', e);
    container.innerHTML = `<div class="empty-state" style="padding:40px 20px"><i data-lucide="alert-triangle" class="w-12 h-12" style="color:#f87171"></i><p>Something went wrong</p><span style="font-size:13px;color:rgba(var(--text-rgb),0.3)">Error: ${esc(e.message || 'Unknown')}</span></div>`;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

export async function renderUpcoming() {
  const container = document.getElementById('view-content');
  const header = document.getElementById('view-header');
  const [categories, upcoming] = await Promise.all([getAllCategories(), getUpcomingTasks(30)]);

  header.querySelector('h1').textContent = 'Upcoming';
  header.querySelector('.view-subtitle').textContent = 'Tasks scheduled for the next 30 days';

  if (upcoming.length === 0) {
    container.innerHTML = `<div class="empty-state"><i data-lucide="calendar" class="w-14 h-14"></i><p>No upcoming tasks</p><span>Schedule a task with a due date to see it here</span></div>`;
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); return;
  }

  const sorted = upcoming.sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
  const grouped = {};
  sorted.forEach(t => {
    const key = t.dueDate ? new Date(t.dueDate).toDateString() : 'unscheduled';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  const todayStr = new Date().toDateString();
  const t = new Date(); t.setDate(t.getDate() + 1); const tomorrowStr = t.toDateString();

  let html = '<div style="display:flex;flex-direction:column;gap:20px">';
  for (const [key, tasks] of Object.entries(grouped)) {
    const date = key === 'unscheduled' ? null : new Date(key);
    const label = key === 'unscheduled' ? 'Unscheduled' : key === todayStr ? 'Today' : key === tomorrowStr ? 'Tomorrow' : formatDate(date);
    html += `<div>
      <div class="section-header"><h2>${label} (${tasks.length})</h2></div>
      <div class="space-y-2">${tasks.map(t => renderTaskCard(t, categories)).join('')}</div>
    </div>`;
  }
  html += '</div>';
  container.innerHTML = html;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  attachTaskCardEvents(container);
}

export async function renderCategoryFilter(categoryId) {
  const container = document.getElementById('view-content');
  const header = document.getElementById('view-header');
  const [allCats, allTasks] = await Promise.all([getAllCategories(), getAllTasks()]);
  const cat = categoryId ? allCats.find(c => c.id === parseInt(categoryId)) : null;

  header.querySelector('h1').textContent = cat ? cat.name : 'All Tasks';
  header.querySelector('.view-subtitle').textContent = cat ? `Tasks in ${cat.name}` : 'Viewing all tasks';

  const filtered = cat ? allTasks.filter(t => t.categoryId === cat.id && t.status !== 'archived') : allTasks.filter(t => t.status !== 'archived');
  renderTaskList(filtered, allCats);
}

export async function renderPriorityMatrix() {
  const container = document.getElementById('view-content');
  const header = document.getElementById('view-header');
  const [categories, allTasks] = await Promise.all([getAllCategories(), getAllTasks()]);

  header.querySelector('h1').textContent = 'Priority Matrix';
  header.querySelector('.view-subtitle').textContent = 'Tasks grouped by importance';

  const active = allTasks.filter(t => t.status !== 'archived');
  const groups = { high: active.filter(t => t.priority === 'high'), medium: active.filter(t => t.priority === 'medium'), low: active.filter(t => t.priority === 'low') };
  const order = [
    { key: 'high', label: 'High Priority', icon: 'arrow-up', color: '#f87171', border: 'rgba(248,113,113,0.15)' },
    { key: 'medium', label: 'Medium Priority', icon: 'minus', color: '#FFCF9A', border: 'rgba(255,207,154,0.12)' },
    { key: 'low', label: 'Low Priority', icon: 'arrow-down', color: '#34d399', border: 'rgba(52,211,153,0.15)' }
  ];

  let html = '';
  for (const g of order) {
    const tasks = groups[g.key];
    html += `<div class="priority-group">
      <div class="priority-header" style="border-color:${g.border}">
        <i data-lucide="${g.icon}" class="w-4 h-4" style="color:${g.color}"></i>
        <span style="font-size:13px;font-weight:600;color:${g.color}">${g.label}</span>
        <span style="margin-left:auto;font-size:11px;color:${g.color}">${tasks.length} task${tasks.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="priority-body">
        ${tasks.length > 0
          ? `<div class="space-y-2">${tasks.map(t => renderTaskCard(t, categories)).join('')}</div>`
           : `<div style="display:flex;align-items:center;justify-content:center;padding:24px;color:rgba(var(--text-rgb),0.2);font-size:13px"><i data-lucide="inbox" class="w-4 h-4" style="margin-right:6px"></i> No tasks</div>`}
      </div>
    </div>`;
  }
  container.innerHTML = html;
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  attachTaskCardEvents(container);
}
