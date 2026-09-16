import { SEED_CATEGORIES, buildSeedTemplates } from './seed.js?v=6';

const DexieCtor = window.Dexie;

if (!DexieCtor) {
  throw new Error('Dexie failed to load. Check vendor/dexie.min.js.');
}

export const db = new DexieCtor('TodoMevaDB');

db.version(4).stores({
  categories: '++id, uuid, name, order',
  templates: '++id, uuid, categoryId, order',
  tasks: '++id, uuid, categoryId, priority, status, dueDate, createdAt, completedAt, parentTaskId, trackingId, deletedAt, durationMinutes',
  activities: '++id, uuid, type, taskId, timestamp',
  history: '++id, uuid, taskId, trackingId, type, from, to, reason, timestamp',
  special_days: '++id, uuid, trackingId, title, type, date, recurring, categoryId, notes, createdAt, deletedAt'
}).upgrade(async (tx) => {
  await ensureUuids(tx);
  await migrateSchemaV4(tx);
});

export function makeUuid() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function trackingIdFrom(uuid) {
  const seed = String(uuid || makeUuid()).replace(/-/g, '');
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `TM-${hash.toString(36).toUpperCase().padStart(6, '0')}`;
}

async function migrateSchemaV4(tx) {
  await tx.table('tasks').toCollection().modify((row) => {
    if (row.status === 'todo') row.status = 'not_started';
    if (row.status === 'completed') row.status = 'done';
    if (row.priority === 'pending') {
      row.status = 'pending';
      row.priority = 'low';
    }
    if (!row.trackingId) row.trackingId = trackingIdFrom(row.uuid);
    if (row.focusMinutes && !row.durationMinutes) row.durationMinutes = row.focusMinutes;
    if (!row.durationMinutes && !row.focusMinutes) row.durationMinutes = 0;
  });
  await tx.table('activities').toCollection().modify((row) => {
    if (!row.trackingId) row.trackingId = trackingIdFrom(row.uuid);
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
  await tx.table('history').toCollection().modify((row) => { if (!row.uuid) row.uuid = makeUuid(); });
  await tx.table('special_days').toCollection().modify((row) => { if (!row.uuid) row.uuid = makeUuid(); });
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
  const uuid = makeUuid();
  const id = await db.tasks.add({
    uuid,
    title: task.title.trim(),
    description: task.description?.trim() || '',
    categoryId: Number(task.categoryId),
    templateId: task.templateId ? Number(task.templateId) : null,
    priority: task.priority || 'medium',
    status: task.status || 'not_started',
    dueDate: task.dueDate || '',
    startDate: task.startDate || '',
    recurrence: task.recurrence || 'none',
    reminders: task.reminders || [],
    createdAt: now,
    updatedAt: now,
    completedAt: '',
    deletedAt: '',
    durationMinutes: Number(task.durationMinutes) || Number(task.focusMinutes) || 0,
    focusStartedAt: '',
    trackingId: task.trackingId || trackingIdFrom(uuid),
    parentTaskId: task.parentTaskId || null
  });
  await addActivity('task_created', id, task.title);
  await addHistory(id, { type: 'status', from: '', to: task.status || 'not_started', reason: 'created' });
  return id;
}

export async function updateTask(id, updates) {
  const existing = await getTask(id);
  await db.tasks.update(Number(id), { ...updates, updatedAt: localDateTimeStr() });
  await addActivity('task_updated', Number(id), updates.title || existing?.title || 'Task');
  if (updates.status && updates.status !== existing?.status) {
    await addHistory(Number(id), { type: 'status', from: existing?.status || '', to: updates.status, reason: 'edit' });
  }
}

export async function archiveTask(id) {
  const task = await getTask(id);
  await db.tasks.update(Number(id), {
    deletedAt: localDateTimeStr(),
    focusStartedAt: '',
    updatedAt: localDateTimeStr()
  });
  await addActivity('task_archived', Number(id), task?.title || 'Task');
  await addHistory(Number(id), { type: 'archive', from: task?.status || '', to: 'archived', reason: 'archived' });
}

export async function restoreTask(id) {
  const task = await getTask(id);
  await db.tasks.update(Number(id), {
    deletedAt: '',
    updatedAt: localDateTimeStr()
  });
  await addActivity('task_restored', Number(id), task?.title || 'Task');
  await addHistory(Number(id), { type: 'archive', from: 'archived', to: task?.status || '', reason: 'restored' });
}

export async function permanentDeleteTask(id) {
  const task = await getTask(id);
  await db.tasks.delete(Number(id));
  await addActivity('task_deleted', Number(id), task?.title || 'Task');
  await addHistory(Number(id), { type: 'delete', from: task?.status || '', to: 'deleted', reason: 'permanent_delete' });
}

export async function sendToPending(id, reason = 'manual') {
  const task = await getTask(id);
  await db.tasks.update(Number(id), {
    status: 'pending',
    focusStartedAt: '',
    updatedAt: localDateTimeStr()
  });
  await addActivity('task_pending', Number(id), task?.title || 'Task');
  await addHistory(Number(id), { type: 'status', from: task?.status || '', to: 'pending', reason });
}

export async function resumeFromPending(id) {
  const task = await getTask(id);
  await db.tasks.update(Number(id), {
    status: 'in_progress',
    focusStartedAt: '',
    updatedAt: localDateTimeStr()
  });
  await addActivity('task_resumed', Number(id), task?.title || 'Task');
  await addHistory(Number(id), { type: 'status', from: 'pending', to: 'in_progress', reason: 'resume' });
}

export async function startFocus(id) {
  const task = await getTask(id);
  const minutes = Math.max(1, Number(task?.durationMinutes) || 25);
  await db.tasks.update(Number(id), {
    durationMinutes: minutes,
    focusStartedAt: localDateTimeStr(),
    updatedAt: localDateTimeStr()
  });
  await addHistory(Number(id), { type: 'timer', from: 'off', to: 'running', reason: 'start' });
}

export async function stopFocus(id) {
  await db.tasks.update(Number(id), {
    focusStartedAt: '',
    updatedAt: localDateTimeStr()
  });
  await addHistory(Number(id), { type: 'timer', from: 'running', to: 'off', reason: 'stop' });
}

export async function setTaskStatus(id, status, reason = 'manual') {
  const task = await getTask(id);
  const completedAt = status === 'done' ? localDateTimeStr() : '';
  const updates = { status, completedAt, updatedAt: localDateTimeStr() };
  if (status !== 'in_progress') updates.focusStartedAt = '';
  if (status === 'done') updates.durationMinutes = 0;
  await db.tasks.update(Number(id), updates);
  if (status === 'done') await addActivity('task_completed', Number(id), task?.title || 'Task');
  await addHistory(Number(id), { type: 'status', from: task?.status || '', to: status, reason });
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

export async function addHistory(taskId, entry) {
  const task = await getTask(taskId);
  return db.history.add({
    uuid: makeUuid(),
    taskId: Number(taskId),
    trackingId: task?.trackingId || '',
    type: entry.type || 'status',
    from: entry.from || '',
    to: entry.to || '',
    reason: entry.reason || '',
    timestamp: localDateTimeStr()
  });
}

export async function getHistory(taskId) {
  return db.history.where('taskId').equals(Number(taskId)).sortBy('timestamp');
}

export async function getSpecialDays() {
  return db.special_days.orderBy('date').toArray();
}

export async function addSpecialDay(sd) {
  const now = localDateTimeStr();
  const uuid = makeUuid();
  const id = await db.special_days.add({
    uuid,
    title: sd.title.trim(),
    type: sd.type || 'event',
    date: sd.date || '',
    recurring: sd.recurring || 'yearly',
    categoryId: sd.categoryId ? Number(sd.categoryId) : null,
    notes: sd.notes?.trim() || '',
    createdAt: now,
    updatedAt: now,
    deletedAt: '',
    trackingId: trackingIdFrom(uuid)
  });
  return id;
}

export async function updateSpecialDay(id, changes) {
  return db.special_days.update(Number(id), { ...changes, updatedAt: localDateTimeStr() });
}

export async function archiveSpecialDay(id) {
  return db.special_days.update(Number(id), { deletedAt: localDateTimeStr(), updatedAt: localDateTimeStr() });
}

export async function restoreSpecialDay(id) {
  return db.special_days.update(Number(id), { deletedAt: '', updatedAt: localDateTimeStr() });
}

export async function permanentDeleteSpecialDay(id) {
  return db.special_days.delete(Number(id));
}

export async function exportData() {
  return {
    exportedAt: localDateTimeStr(),
    categories: await db.categories.toArray(),
    templates: await db.templates.toArray(),
    tasks: await db.tasks.toArray(),
    activities: await db.activities.toArray(),
    history: await db.history.toArray(),
    special_days: await db.special_days.toArray()
  };
}

export async function importData(data) {
  await db.transaction('rw', db.categories, db.templates, db.tasks, db.activities, db.history, db.special_days, async () => {
    await Promise.all([db.categories.clear(), db.templates.clear(), db.tasks.clear(), db.activities.clear(), db.history.clear(), db.special_days.clear()]);
    if (data.categories?.length) await db.categories.bulkPut(data.categories);
    if (data.templates?.length) await db.templates.bulkPut(data.templates);
    if (data.tasks?.length) await db.tasks.bulkPut(data.tasks);
    if (data.activities?.length) await db.activities.bulkPut(data.activities);
    if (data.history?.length) await db.history.bulkPut(data.history);
    if (data.special_days?.length) await db.special_days.bulkPut(data.special_days);
  });
  await ensureUuids(db);
}