import { addTask, getCategories, getTasks, localDateStr } from './db.js?v=1';
import { attachTaskCardEvents, renderTaskCard, refreshIcons } from './components.js?v=1';

export async function renderDashboard() {
  const { categories, tasks, categoryMap } = await loadViewData();
  const today = localDateStr();
  const openTasks = tasks.filter((task) => task.status !== 'completed');
  const overdue = openTasks.filter((task) => task.dueDate && task.dueDate < today);
  const dueToday = openTasks.filter((task) => task.dueDate === today);
  const completed = tasks.filter((task) => task.status === 'completed');
  const content = document.querySelector('#view-content');
  content.innerHTML = `
    <section class="grid stats-grid">
      ${stat('Open', openTasks.length)}${stat('Due today', dueToday.length)}${stat('Overdue', overdue.length)}${stat('Completed', completed.length)}
    </section>
    <section class="card"><h3>Quick create</h3><form id="dashboard-create" class="quick-create"><input class="field" name="title" placeholder="Add a focused task" required /><select class="select" name="categoryId">${categories.map((category) => `<option value="${category.id}">${category.name}</option>`).join('')}</select><select class="select" name="priority"><option value="medium">Medium</option><option value="high">High</option><option value="low">Low</option></select><button class="btn btn-primary">Add</button></form></section>
    ${taskSection('Overdue', overdue, categoryMap)}
    ${taskSection('Today', dueToday, categoryMap)}
    ${taskSection('All open tasks', openTasks.filter((task) => task.dueDate !== today && !(task.dueDate && task.dueDate < today)), categoryMap)}
  `;
  document.querySelector('#dashboard-create').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await addTask({ title: form.get('title'), categoryId: form.get('categoryId'), priority: form.get('priority') });
    window.refreshCurrentView();
  });
  attachTaskCardEvents(content);
  refreshIcons();
}

export async function renderUpcoming() {
  const { tasks, categoryMap } = await loadViewData();
  const today = localDateStr();
  const upcoming = tasks.filter((task) => task.status !== 'completed' && task.dueDate && task.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const content = document.querySelector('#view-content');
  content.innerHTML = taskSection('Next tasks', upcoming, categoryMap);
  attachTaskCardEvents(content);
  refreshIcons();
}

export async function renderCategory(categoryId) {
  const { categories, tasks, categoryMap } = await loadViewData();
  const category = categories.find((item) => item.id === Number(categoryId));
  const filtered = tasks.filter((task) => task.categoryId === Number(categoryId));
  document.querySelector('#view-content').innerHTML = taskSection(category?.name || 'Category', filtered, categoryMap);
  attachTaskCardEvents(document.querySelector('#view-content'));
  refreshIcons();
}

export async function renderPriorityMatrix() {
  const { tasks, categoryMap } = await loadViewData();
  const content = document.querySelector('#view-content');
  content.innerHTML = `<div class="grid stats-grid">${['high', 'medium', 'low'].map((priority) => `<section class="card"><h3>${priority[0].toUpperCase() + priority.slice(1)}</h3><div class="task-list">${tasks.filter((task) => task.priority === priority && task.status !== 'completed').map((task) => renderTaskCard(task, categoryMap.get(task.categoryId))).join('') || '<p class="empty-state">No tasks</p>'}</div></section>`).join('')}</div>`;
  attachTaskCardEvents(content);
  refreshIcons();
}

function stat(label, value) {
  return `<article class="card stat-card"><strong>${value}</strong><span>${label}</span></article>`;
}

function taskSection(title, tasks, categoryMap) {
  return `<section class="card"><div class="section-header"><h3>${title}</h3><span class="muted">${tasks.length}</span></div><div class="task-list">${tasks.map((task) => renderTaskCard(task, categoryMap.get(task.categoryId))).join('') || '<p class="empty-state">Nothing here yet.</p>'}</div></section>`;
}

async function loadViewData() {
  const [categories, tasks] = await Promise.all([getCategories(), getTasks()]);
  return { categories, tasks, categoryMap: new Map(categories.map((category) => [category.id, category])) };
}
