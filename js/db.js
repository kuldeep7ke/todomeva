import { SEED_CATEGORIES, buildSeedTemplates } from './seed.js?v=1';

const DexieCtor = window.Dexie;

if (!DexieCtor) {
  throw new Error('Dexie failed to load. Check vendor/dexie.min.js.');
}

export const db = new DexieCtor('TodoMevaDB');

db.version(2).stores({
  categories: '++id, name, order',
  templates: '++id, categoryId, order',
  tasks: '++id, categoryId, priority, status, dueDate, createdAt, completedAt, parentTaskId',
  activities: '++id, type, taskId, timestamp'
});

export function localDateStr(date = new Date()) {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function localDateTimeStr(date = new Date()) {
  const value = new Date(date);
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${localDateStr(value)}T${hours}:${minutes}`;
}

export async function seedDatabase() {
  if (await db.categories.count()) return;
  await db.transaction('rw', db.categories, db.templates, async () => {
    await db.categories.bulkAdd(SEED_CATEGORIES);
    const categories = await db.categories.orderBy('order').toArray();
    await db.templates.bulkAdd(buildSeedTemplates(categories));
  });
}

export async function getCategories() {
  return db.categories.orderBy('order').toArray();
}

export async function getTemplatesByCategory(categoryId) {
  return db.templates.where('categoryId').equals(Number(categoryId)).sortBy('order');
}

export async function getTasks() {
  return db.tasks.orderBy('createdAt').reverse().toArray();
}

export async function getTask(id) {
  return db.tasks.get(Number(id));
}

export async function addTask(task) {
  const now = localDateTimeStr();
  const id = await db.tasks.add({
    title: task.title.trim(),
    description: task.description?.trim() || '',
    categoryId: Number(task.categoryId),
    templateId: task.templateId ? Number(task.templateId) : null,
    priority: task.priority || 'medium',
    status: task.status || 'todo',
    dueDate: task.dueDate || '',
    startDate: task.startDate || '',
    recurrence: task.recurrence || 'none',
    reminders: task.reminders || [],
    createdAt: now,
    updatedAt: now,
    completedAt: '',
    parentTaskId: task.parentTaskId || null
  });
  await addActivity('task_created', id, task.title);
  return id;
}

export async function updateTask(id, updates) {
  const existing = await getTask(id);
  await db.tasks.update(Number(id), { ...updates, updatedAt: localDateTimeStr() });
  await addActivity('task_updated', Number(id), updates.title || existing?.title || 'Task');
}

export async function deleteTask(id) {
  const task = await getTask(id);
  await db.tasks.delete(Number(id));
  await addActivity('task_deleted', Number(id), task?.title || 'Task');
}

export async function setTaskStatus(id, status) {
  const task = await getTask(id);
  await db.tasks.update(Number(id), {
    status,
    completedAt: status === 'completed' ? localDateTimeStr() : '',
    updatedAt: localDateTimeStr()
  });
  if (status === 'completed') await addActivity('task_completed', Number(id), task?.title || 'Task');
}

export async function addCategory(category) {
  return db.categories.add({ ...category, order: Date.now() });
}

export async function addActivity(type, taskId, taskTitle, details = '') {
  return db.activities.add({ type, taskId, taskTitle, details, timestamp: localDateTimeStr() });
}

export async function exportData() {
  return {
    exportedAt: localDateTimeStr(),
    categories: await db.categories.toArray(),
    templates: await db.templates.toArray(),
    tasks: await db.tasks.toArray(),
    activities: await db.activities.toArray()
  };
}

export async function importData(data) {
  await db.transaction('rw', db.categories, db.templates, db.tasks, db.activities, async () => {
    await Promise.all([db.categories.clear(), db.templates.clear(), db.tasks.clear(), db.activities.clear()]);
    if (data.categories?.length) await db.categories.bulkPut(data.categories);
    if (data.templates?.length) await db.templates.bulkPut(data.templates);
    if (data.tasks?.length) await db.tasks.bulkPut(data.tasks);
    if (data.activities?.length) await db.activities.bulkPut(data.activities);
  });
}
