export const db = new Dexie('TodoMevaDB');

db.version(1).stores({
  categories: '++id, name, order',
  templates: '++id, categoryId, title, order',
  tasks: '++id, title, categoryId, priority, status, dueDate, startDate, createdAt'
});

db.version(2).stores({
  categories: '++id, name, order',
  templates: '++id, categoryId, title, order',
  tasks: '++id, title, categoryId, priority, status, dueDate, startDate, createdAt',
  activities: '++id, type, timestamp'
});

// Categories
export async function getAllCategories() {
  return db.categories.orderBy('order').toArray();
}
export async function getCategory(id) {
  return db.categories.get(id);
}
export async function saveCategory(category) {
  if (category.id) { await db.categories.put(category); return category.id; }
  return db.categories.add(category);
}
export async function deleteCategory(id) {
  await db.templates.where('categoryId').equals(id).delete();
  await db.categories.delete(id);
}

// Templates
export async function getTemplatesByCategory(categoryId) {
  return db.templates.where('categoryId').equals(categoryId).sortBy('order');
}
export async function getTemplate(id) {
  return db.templates.get(id);
}
export async function saveTemplate(template) {
  if (template.id) { await db.templates.put(template); return template.id; }
  return db.templates.add(template);
}
export async function deleteTemplate(id) {
  await db.templates.delete(id);
}

// Tasks
export async function getAllTasks() {
  return db.tasks.toArray();
}
export async function getTask(id) {
  return db.tasks.get(id);
}
export async function saveTask(task) {
  const now = new Date().toISOString();
  task.updatedAt = now;
  if (task.id) { await db.tasks.put(task); return task.id; }
  task.createdAt = now;
  return db.tasks.add(task);
}
export async function deleteTask(id) {
  await db.tasks.delete(id);
}
export async function getTasksByStatus(status) {
  return db.tasks.where('status').equals(status).toArray();
}
export async function getTasksByCategory(categoryId) {
  return db.tasks.where('categoryId').equals(categoryId).toArray();
}
export async function getTasksByPriority(priority) {
  return db.tasks.where('priority').equals(priority).toArray();
}
function localPad(n) { return String(n).padStart(2,'0'); }
function localDateStr(d) {
  return `${d.getFullYear()}-${localPad(d.getMonth()+1)}-${localPad(d.getDate())}`;
}
function localDateTimeStr(d) {
  return `${localDateStr(d)}T${localPad(d.getHours())}:${localPad(d.getMinutes())}:${localPad(d.getSeconds())}`;
}

export async function getTasksDueToday() {
  const d = new Date();
  const start = `${localDateStr(d)}T00:00:00`;
  const end = `${localDateStr(d)}T23:59:59`;
  return db.tasks.where('dueDate').between(start, end).toArray();
}
export async function getOverdueTasks() {
  const now = localDateTimeStr(new Date());
  return db.tasks.filter(t => t.dueDate && t.dueDate < now && t.status !== 'completed' && t.status !== 'archived').toArray();
}
export async function getUpcomingTasks(days = 7) {
  const now = new Date();
  const start = localDateTimeStr(now);
  const endD = new Date(now); endD.setDate(endD.getDate() + days);
  const end = `${localDateStr(endD)}T23:59:59`;
  return db.tasks.where('dueDate').between(start, end)
    .filter(t => t.status !== 'completed' && t.status !== 'archived').toArray();
}
export async function getTasksWithReminders() {
  return db.tasks.filter(t => t.reminders && t.reminders.length > 0 && t.status !== 'completed' && t.status !== 'archived').toArray();
}

// Activities
export async function logActivity(type, task, categoryName) {
  return db.activities.add({
    type,
    taskId: task.id,
    taskTitle: task.title || '',
    categoryName: categoryName || '',
    details: task.description || '',
    timestamp: new Date().toISOString()
  });
}

export async function getRecentActivities(limit = 10) {
  return db.activities.orderBy('id').reverse().limit(limit).toArray();
}

export async function getActivityStats(days = 7) {
  const all = await db.tasks.toArray();
  const active = all.filter(t => t.status !== 'archived');
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - days);

  const completedToday = all.filter(t => t.status === 'completed' && t.completedAt &&
    new Date(t.completedAt).toDateString() === now.toDateString()).length;

  const completedThisWeek = all.filter(t => t.status === 'completed' && t.completedAt &&
    new Date(t.completedAt) >= weekAgo).length;

  // Streak: consecutive days with at least one completion going backward from today
  let streak = 0;
  const checkDate = new Date(now);
  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toDateString();
    const hasCompletion = all.some(t => t.status === 'completed' && t.completedAt &&
      new Date(t.completedAt).toDateString() === dateStr);
    if (hasCompletion) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (i === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    } else break;
  }

  const totalTasks = active.length;
  const completedCount = all.filter(t => t.status === 'completed').length;
  const completionRate = all.length > 0 ? Math.round((completedCount / all.length) * 100) : 0;

  // Category distribution
  const categories = await getAllCategories();
  const categoryDist = categories.map(c => ({
    name: c.name,
    color: c.color,
    icon: c.icon,
    count: active.filter(t => t.categoryId === c.id).length
  })).filter(c => c.count > 0).sort((a, b) => b.count - a.count);

  return { completedToday, completedThisWeek, streak, totalTasks, completionRate, categoryDist };
}

// Export / Import
export async function exportAllData() {
  const categories = await getAllCategories();
  const templates = await db.templates.toArray();
  const tasks = await db.tasks.toArray();
  const activities = await db.activities.toArray();
  return { categories, templates, tasks, activities, exportedAt: new Date().toISOString() };
}

export async function importAllData(data) {
  await db.categories.clear();
  await db.templates.clear();
  await db.tasks.clear();
  await db.activities.clear();
  if (data.categories) { for (const c of data.categories) await db.categories.put(c); }
  if (data.templates) { for (const t of data.templates) await db.templates.put(t); }
  if (data.tasks) { for (const t of data.tasks) await db.tasks.put(t); }
  if (data.activities) { for (const a of data.activities) await db.activities.put(a); }
}
