import { SEED_CATEGORIES, buildSeedTemplates } from './seed.js?v=5';

const DexieCtor = window.Dexie;

if (!DexieCtor) {
  throw new Error('Dexie failed to load. Check vendor/dexie.min.js.');
}

export const db = new DexieCtor('TodoMevaDB');

db.version(3).stores({
  categories: '++id, uuid, name, order',
  templates: '++id, uuid, categoryId, order',
  tasks: '++id, uuid, categoryId, priority, status, dueDate, createdAt, completedAt, parentTaskId',
  activities: '++id, uuid, type, taskId, timestamp'
}).upgrade(async (tx) => {
  await ensureUuids(tx);
});

export function makeUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function categorySeedUuid(name) {
  return `seed-cat-${slugify(name)}`;
}

export function templateSeedUuid(categoryName, order) {
  return `seed-tpl-${slugify(categoryName)}-${order}`;
}

export async function ensureUuids(tx = db) {
  const catMap = new Map((await tx.table('categories').toArray()).map((c) => [c.id, c]));
  await tx.table('categories').toCollection().modify((row) => {
    const seed = SEED_CATEGORIES.some((s) => s.name === row.name);
    row.uuid = seed ? categorySeedUuid(row.name) : (row.uuid || makeUuid());
  });
  const templates = await tx.table('templates').toArray();
  await tx.table('templates').toCollection().modify((row) => {
    const name = catMap.get(row.categoryId)?.name || '';
    const isSeed = SEED_CATEGORIES.some((s) => s.name === name);
    row.uuid = isSeed ? templateSeedUuid(name, row.order) : (row.uuid || makeUuid());
  });
  await tx.table('tasks').toCollection().modify((row) => { if (!row.uuid) row.uuid = makeUuid(); });
  await tx.table('activities').toCollection().modify((row) => { if (!row.uuid) row.uuid = makeUuid(); });
}

export function getByUuid(table, uuid) {
  return db.table(table).where('uuid').equals(uuid).first();
}

export async function seedDatabase() {
  if (await db.categories.count()) return;
  await db.transaction('rw', db.categories, db.templates, async () => {
    const categories = SEED_CATEGORIES.map((c) => ({ ...c, uuid: categorySeedUuid(c.name) }));
    await db.categories.bulkAdd(categories);
    const inserted = await db.categories.orderBy('order').toArray();
    const templates = buildSeedTemplates(inserted).map((t) => ({
      ...t,
      uuid: templateSeedUuid(inserted.find((c) => c.id === t.categoryId)?.name || '', t.order)
    }));
    await db.templates.bulkAdd(templates);
  });
}

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
    uuid: makeUuid(),
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
    deletedAt: '',
    focusMinutes: Number(task.focusMinutes) || 0,
    focusStartedAt: '',
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

export async function archiveTask(id) {
  const task = await getTask(id);
  await db.tasks.update(Number(id), {
    deletedAt: localDateTimeStr(),
    focusStartedAt: '',
    updatedAt: localDateTimeStr()
  });
  await addActivity('task_archived', Number(id), task?.title || 'Task');
}

export async function restoreTask(id) {
  const task = await getTask(id);
  await db.tasks.update(Number(id), {
    deletedAt: '',
    updatedAt: localDateTimeStr()
  });
  await addActivity('task_restored', Number(id), task?.title || 'Task');
}

export async function permanentDeleteTask(id) {
  const task = await getTask(id);
  await db.tasks.delete(Number(id));
  await addActivity('task_deleted', Number(id), task?.title || 'Task');
}

export async function sendToPending(id) {
  const task = await getTask(id);
  await db.tasks.update(Number(id), {
    priority: 'pending',
    focusStartedAt: '',
    updatedAt: localDateTimeStr()
  });
  await addActivity('task_pending', Number(id), task?.title || 'Task');
}

export async function startFocus(id) {
  const task = await getTask(id);
  const minutes = Math.max(1, Number(task?.focusMinutes) || 25);
  await db.tasks.update(Number(id), {
    focusMinutes: minutes,
    focusStartedAt: localDateTimeStr(),
    updatedAt: localDateTimeStr()
  });
}

export async function stopFocus(id) {
  await db.tasks.update(Number(id), {
    focusStartedAt: '',
    updatedAt: localDateTimeStr()
  });
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
  return db.categories.add({ ...category, uuid: makeUuid(), order: Date.now() });
}

export async function updateCategory(id, changes) {
  return db.categories.update(Number(id), changes);
}

export async function addActivity(type, taskId, taskTitle, details = '') {
  return db.activities.add({ uuid: makeUuid(), type, taskId, taskTitle, details, timestamp: localDateTimeStr() });
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
  await ensureUuids(db);
}