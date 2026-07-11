import { getAllCategories, getAllTasks, getTasksDueToday, getOverdueTasks, getUpcomingTasks, getRecentActivities, getActivityStats } from './db.js';
import { renderTaskList, renderTaskCard, formatDate, openTaskDetail, toggleTaskStatus, deleteTaskById, esc } from './components.js';

export async function renderDashboard() {
  const container = document.getElementById('view-content');
  const header = document.getElementById('view-header');
  const [categories, todayTasks, overdueTasks, allTasks, recentActivity, stats] = await Promise.all([
    getAllCategories(), getTasksDueToday(), getOverdueTasks(), getAllTasks(), getRecentActivities(10), getActivityStats()
  ]);

  const activeTasks = allTasks.filter(t => t.status !== 'archived');
  const inProgress = allTasks.filter(t => t.status === 'in_progress');

  header.querySelector('h1').textContent = 'Dashboard';
  header.querySelector('.view-subtitle').textContent = `${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`;

  let html = `
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">Total Tasks</span>
        <div class="stat-icon" style="background:rgba(255,138,61,0.12)"><i data-lucide="list" class="w-4 h-4" style="color:#FF8A3D"></i></div>
      </div>
      <div class="stat-value">${activeTasks.length}</div>
      ${stats.completedToday > 0 ? `<div class="stat-sub">${stats.completedToday} completed today</div>` : '<div class="stat-sub">&nbsp;</div>'}
    </div>
    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">Completed Today</span>
        <div class="stat-icon" style="background:rgba(52,211,153,0.15)"><i data-lucide="check-circle" class="w-4 h-4" style="color:#34d399"></i></div>
      </div>
      <div class="stat-value">${stats.completedToday}</div>
      <div class="stat-sub">${stats.completedThisWeek} this week</div>
    </div>
    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">Day Streak</span>
        <div class="stat-icon" style="background:rgba(255,207,154,0.12)"><i data-lucide="flame" class="w-4 h-4" style="color:#FFCF9A"></i></div>
      </div>
      <div class="stat-value">${stats.streak}${stats.streak === 1 ? ' day' : stats.streak > 1 ? ' days' : ''}</div>
      <div class="stat-sub">${stats.streak > 0 ? 'Keep it up! 🔥' : 'Start your streak today'}</div>
    </div>
    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">In Progress</span>
        <div class="stat-icon" style="background:rgba(255,207,154,0.1)"><i data-lucide="loader" class="w-4 h-4" style="color:#FFCF9A"></i></div>
      </div>
      <div class="stat-value">${inProgress.length}</div>
      <div class="stat-sub">${stats.completionRate}% overall completion</div>
    </div>
  </div>`;

  // Activity Feed
  if (recentActivity.length > 0) {
    html += `<div class="activity-feed">`;
    html += `<div class="section-header" style="margin-bottom:4px"><i data-lucide="activity" class="w-4 h-4" style="color:#FF8A3D"></i><h2>Recent Activity</h2></div>`;
    html += recentActivity.map(a => {
      const time = timeAgo(a.timestamp);
      const typeClass = a.type === 'task_created' ? 'created' : a.type === 'task_completed' ? 'completed' : a.type === 'task_deleted' ? 'deleted' : a.type === 'task_updated' ? 'updated' : 'recurred';
      const label = a.type === 'task_created' ? 'created' : a.type === 'task_completed' ? 'completed' : a.type === 'task_deleted' ? 'deleted' : a.type === 'task_updated' ? 'updated' : 'recurred';
      return `<div class="activity-item">
        <span class="activity-dot ${typeClass}"></span>
        <span class="activity-text"><strong>${esc(a.taskTitle)}</strong> ${label}${a.categoryName ? ' in ' + esc(a.categoryName) : ''}</span>
        <span class="activity-time">${time}</span>
      </div>`;
    }).join('');
    html += `</div>`;
  }

  // Overdue
  const filteredOverdue = overdueTasks.filter(t => t.status !== 'archived');
  if (filteredOverdue.length > 0) {
    html += `<div style="margin-bottom:24px">
      <div class="section-header"><i data-lucide="alert-circle" class="w-4 h-4" style="color:#f87171"></i><h2 style="color:#f87171">Overdue (${filteredOverdue.length})</h2></div>
      <div class="space-y-2">${filteredOverdue.map(t => renderTaskCard(t, categories)).join('')}</div>
    </div>`;
  }

  // Today's Tasks
  const filteredToday = todayTasks.filter(t => t.status !== 'completed' && t.status !== 'archived');
  html += `<div style="margin-bottom:24px">
      <div class="section-header"><i data-lucide="calendar" class="w-4 h-4" style="color:#FF8A3D"></i><h2>Today's Tasks (${filteredToday.length})</h2></div>
    ${filteredToday.length > 0
      ? `<div class="space-y-2">${filteredToday.map(t => renderTaskCard(t, categories)).join('')}</div>`
      : `<div class="empty-state" style="padding:30px"><i data-lucide="sun" class="w-10 h-10"></i><p>No tasks for today</p><span style="font-size:13px;color:rgba(255,246,236,0.3)">Enjoy your day!</span></div>`}
  </div>`;

  // Category Distribution
  if (stats.categoryDist.length > 0) {
    html += `<div class="activity-feed">
      <div class="section-header" style="margin-bottom:12px"><i data-lucide="pie-chart" class="w-4 h-4" style="color:#FF8A3D"></i><h2>Task Distribution</h2></div>
      <div style="display:flex;flex-direction:column;gap:8px">`;
    const maxCount = Math.max(...stats.categoryDist.map(c => c.count), 1);
    stats.categoryDist.forEach(c => {
      const pct = Math.round((c.count / maxCount) * 100);
      html += `<div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <i data-lucide="${c.icon}" class="w-3.5 h-3.5" style="color:${c.color};flex-shrink:0"></i>
           <span style="font-size:12px;color:rgba(255,246,236,0.55);flex:1">${c.name}</span>
           <span style="font-size:12px;color:rgba(255,246,236,0.35)">${c.count}</span>
        </div>
         <div style="height:4px;background:rgba(255,246,236,0.06);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${c.color};border-radius:2px;transition:width 0.5s ease"></div>
        </div>
      </div>`;
    });
    html += `</div></div>`;
  }

  // Upcoming 3 days
  const upcoming = await getUpcomingTasks(3);
  const filteredUpcoming = upcoming.filter(t => {
    const due = t.dueDate ? new Date(t.dueDate).toDateString() : '';
    return due !== new Date().toDateString() && t.status !== 'completed' && t.status !== 'archived';
  });
  if (filteredUpcoming.length > 0) {
    html += `<div style="margin-bottom:24px">
        <div class="section-header"><i data-lucide="clock" class="w-4 h-4" style="color:#FFCF9A"></i><h2>Next 3 Days (${filteredUpcoming.length})</h2></div>
      <div class="space-y-2">${filteredUpcoming.map(t => renderTaskCard(t, categories)).join('')}</div>
    </div>`;
  }

  container.innerHTML = html;
  lucide.createIcons();
  attachCardEvents(container);
}

export async function renderUpcoming() {
  const container = document.getElementById('view-content');
  const header = document.getElementById('view-header');
  const [categories, upcoming] = await Promise.all([getAllCategories(), getUpcomingTasks(30)]);

  header.querySelector('h1').textContent = 'Upcoming';
  header.querySelector('.view-subtitle').textContent = 'Tasks scheduled for the next 30 days';

  if (upcoming.length === 0) {
    container.innerHTML = `<div class="empty-state"><i data-lucide="calendar" class="w-14 h-14"></i><p>No upcoming tasks</p><span>Schedule a task with a due date to see it here</span></div>`;
    lucide.createIcons(); return;
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
  lucide.createIcons();
  attachCardEvents(container);
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
           : `<div style="display:flex;align-items:center;justify-content:center;padding:24px;color:rgba(255,246,236,0.2);font-size:13px"><i data-lucide="inbox" class="w-4 h-4" style="margin-right:6px"></i> No tasks</div>`}
      </div>
    </div>`;
  }
  container.innerHTML = html;
  lucide.createIcons();
  attachCardEvents(container);
}

function attachCardEvents(container) {
  container.querySelectorAll('.task-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      openTaskDetail(parseInt(card.dataset.taskId));
    });
  });
  container.querySelectorAll('[data-action="toggle-status"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleTaskStatus(parseInt(btn.dataset.taskId)); });
  });
  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteTaskById(parseInt(btn.dataset.taskId)); });
  });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
