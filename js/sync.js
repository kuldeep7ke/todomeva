import { db, getByUuid, localDateTimeStr, makeUuid } from './db.js?v=8';

const CONFIG_KEY = 'todoMeva_sync';
const LAST_URL_KEY = 'todoMeva_syncLastUrl';
const SAVED_LINK_KEY = 'todoMeva_savedLink';
const RECONNECT_INTERVAL = 30000;
const PUSH_DEBOUNCE = 800;
const PULL_DEBOUNCE = 1200;
const URL_RE = /^https:\/\/([a-zA-Z0-9-]+\.)+supabase\.co$/;

export const SCHEMA_SQL = `-- Multi-Device Sync for Todo Meva (run once in Supabase SQL Editor)
-- Stores every entity type (category, template, task, activity) in one sync_docs table.
create table if not exists public.sync_docs (
  id text primary key,
  entity text not null default '',
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists sync_docs_entity_idx on public.sync_docs (entity);
create index if not exists sync_docs_updated_at_idx on public.sync_docs (updated_at);

alter table public.sync_docs enable row level security;

-- Tables created via the SQL Editor are not exposed to the anon/authenticated
-- roles by default, so explicit grants are required for the app to sync.
grant select, insert, update, delete on table public.sync_docs to anon;
grant select, insert, update, delete on table public.sync_docs to authenticated;

drop policy if exists "sync_docs_anon_all" on public.sync_docs;
create policy "sync_docs_anon_all"
  on public.sync_docs
  for all
  to anon
  using (true)
  with check (true);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sync_docs'
  ) then
    alter publication supabase_realtime add table public.sync_docs;
  end if;
end $$;`;

const state = {
  client: null,
  channel: null,
  pollTimer: null,
  onlineHandler: null,
  status: 'disconnected',
  lastSync: null,
  error: null,
  applyingRemote: false,
  pushTimer: null,
  pullTimer: null
};

export function getSyncStatus() {
  return { status: state.status, lastSync: state.lastSync, error: state.error };
}

export function getSyncConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY));
  } catch {
    return null;
  }
}

function emit() {
  document.dispatchEvent(new CustomEvent('todomeva:sync', { detail: getSyncStatus() }));
}

function entityTable(entity) {
  return ({ category: 'categories', activity: 'activities', special_day: 'special_days', history: 'history' }[entity] || `${entity}s`);
}

function isConnected() {
  return Boolean(state.client && state.status !== 'error');
}

function toIso(record) {
  const source = record.updatedAt || record.timestamp || record.createdAt;
  if (source && typeof source === 'string') {
    const time = new Date(source).getTime();
    if (!Number.isNaN(time)) return new Date(time).toISOString();
  }
  return new Date().toISOString();
}

function toLocalTimestamp(record) {
  const source = record.updatedAt || record.updated_at || record.timestamp || record.createdAt;
  if (!source) return 0;
  const time = new Date(source).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function normalizeTimestamps(entity, data) {
  const fields = entity === 'activity' ? ['timestamp'] : ['updatedAt', 'createdAt', 'completedAt', 'deletedAt', 'focusStartedAt'];
  for (const field of fields) {
    const value = data[field];
    if (value && /\dT\d{2}:\d{2}/.test(value)) data[field] = localDateTimeStr(value);
  }
}

export async function pushDeletion(entity, uuid) {
  if (!state.client || !entity || !uuid) return;
  const now = new Date().toISOString();
  try {
    const { error } = await state.client.from('sync_docs').upsert({
      id: `${entity}:${uuid}`,
      entity,
      data: { uuid, deleted: true, updatedAt: now },
      updated_at: now
    }, { onConflict: 'id' });
    if (error) throw error;
    state.lastSync = new Date().toISOString();
    state.status = 'connected';
    state.error = null;
  } catch (error) {
    state.status = 'error';
    state.error = error.message || String(error);
  }
  emit();
}

function docRows(entity, records) {
  return records.map((record) => ({
    id: `${entity}:${record.uuid}`,
    entity,
    data: record,
    updated_at: toIso(record)
  }));
}

export async function pushAll() {
  if (!state.client) return;
  state.status = 'syncing';
  emit();
  try {
    const rows = [
      ...docRows('category', await db.categories.toArray()),
      ...docRows('template', await db.templates.toArray()),
      ...docRows('task', await db.tasks.toArray()),
      ...docRows('activity', await db.activities.toArray()),
      ...docRows('history', await db.history.toArray()),
      ...docRows('special_day', await db.special_days.toArray())
    ];
    if (rows.length) {
      const { error } = await state.client.from('sync_docs').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    }
    state.lastSync = new Date().toISOString();
    state.status = 'connected';
    state.error = null;
  } catch (error) {
    state.status = 'error';
    state.error = error.message || String(error);
  }
  emit();
}

function schedulePush() {
  if (!isConnected()) return;
  clearTimeout(state.pushTimer);
  state.pushTimer = setTimeout(pushAll, PUSH_DEBOUNCE);
}

async function applyEntity(entity, rows, remap) {
  const table = db.table(entityTable(entity));
  for (const row of rows) {
    const remote = row.data;
    if (!remote || !remote.uuid) continue;
    if (remote.deleted) {
      const local = await getByUuid(entityTable(entity), remote.uuid);
      if (local) await table.delete(local.id);
      continue;
    }
    const remoteId = remote.id;
    const local = await getByUuid(entityTable(entity), remote.uuid);
    let newId = null;
    if (local) {
      if (toLocalTimestamp(local) > new Date(row.updated_at).getTime()) continue;
      newId = local.id;
    }
    const data = { ...remote };
    if (typeof data.id !== 'undefined') delete data.id;
    if (data.categoryId != null) data.categoryId = remap[`category:${data.categoryId}`] ?? data.categoryId;
    if (data.templateId != null) data.templateId = remap[`template:${data.templateId}`] ?? data.templateId;
    if (data.parentTaskId != null) data.parentTaskId = remap[`task:${data.parentTaskId}`] ?? data.parentTaskId;
    if (data.taskId != null) data.taskId = remap[`task:${data.taskId}`] ?? data.taskId;
    if (entity === 'task' && data.status === 'todo') data.status = 'not_started';
    if (entity === 'task' && data.status === 'completed') data.status = 'done';
    if (entity === 'task' && typeof data.focusMinutes !== 'undefined' && !data.durationMinutes) data.durationMinutes = data.focusMinutes;
    normalizeTimestamps(entity, data);
    if (newId == null) newId = await table.add(data);
    else await table.update(newId, data);
    remap[`${entity}:${remote.uuid}`] = newId;
    if (remoteId != null) remap[`${entity}:${remoteId}`] = newId;
  }
}

export async function applyRemote() {
  if (!state.client) return;
  state.status = 'syncing';
  emit();
  try {
    const { data, error } = await state.client.from('sync_docs').select('*').order('updated_at', { ascending: true });
    if (error) throw error;
    const byEntity = { category: [], template: [], task: [], activity: [], history: [], special_day: [] };
    for (const row of data || []) {
      if (byEntity[row.entity]) byEntity[row.entity].push(row);
    }
    state.applyingRemote = true;
    try {
      const remap = {};
      await applyEntity('category', byEntity.category, remap);
      await applyEntity('template', byEntity.template, remap);
      await applyEntity('task', byEntity.task, remap);
      await applyEntity('activity', byEntity.activity, remap);
      await applyEntity('history', byEntity.history, remap);
      await applyEntity('special_day', byEntity.special_day, remap);
    } finally {
      state.applyingRemote = false;
    }
    state.lastSync = new Date().toISOString();
    state.status = 'connected';
    state.error = null;
  } catch (error) {
    state.status = 'error';
    state.error = error.message || String(error);
  }
  emit();
}

function scheduleApply() {
  if (!state.client) return;
  clearTimeout(state.pullTimer);
  state.pullTimer = setTimeout(() => {
    if (!state.applyingRemote) applyRemote();
  }, PULL_DEBOUNCE);
}

function startRealtime() {
  if (!state.client) return;
  state.channel = state.client
    .channel('todomeva-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sync_docs' }, () => scheduleApply())
    .subscribe();
  state.pollTimer = setInterval(() => {
    if (!state.applyingRemote) applyRemote();
  }, RECONNECT_INTERVAL);
}

function stopRealtime() {
  if (state.channel && state.client) state.client.removeChannel(state.channel);
  if (state.pollTimer) clearInterval(state.pollTimer);
  if (state.onlineHandler) window.removeEventListener('online', state.onlineHandler);
  state.channel = null;
  state.pollTimer = null;
  state.onlineHandler = null;
}

export function disconnectSync() {
  stopRealtime();
  state.client = null;
  state.status = 'disconnected';
  state.lastSync = null;
  state.error = null;
  localStorage.removeItem(CONFIG_KEY);
  emit();
}

export async function connectSync(url, key) {
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    state.error = 'Supabase library not loaded. Check vendor/supabase.min.js.';
    emit();
    throw new Error(state.error);
  }
let raw = String(url).trim();
  if (raw && !/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  if (!URL_RE.test(raw)) {
    state.error = 'Enter a valid Supabase URL like https://xxxx.supabase.co';
    emit();
    throw new Error(state.error);
  }
  if (!String(key).trim()) {
    state.error = 'Enter your Supabase anon / publishable key';
    emit();
    throw new Error(state.error);
  }
  disconnectSync();
  state.client = window.supabase.createClient(raw, String(key).trim(), { auth: { persistSession: false } });
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: raw, key: String(key).trim() }));
  state.onlineHandler = () => {
    if (!state.applyingRemote) {
      pushAll();
      applyRemote();
    }
  };
  window.addEventListener('online', state.onlineHandler);
  startRealtime();
  await pushAll();
  await applyRemote();
  localStorage.setItem(LAST_URL_KEY, raw);
  saveSyncLink(raw, String(key).trim());
}

export function getLastUrl() {
  return localStorage.getItem(LAST_URL_KEY) || '';
}

export function getSavedSyncLink() {
  try {
    const raw = localStorage.getItem(SAVED_LINK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSyncLink(url, key) {
  const clean = {
    url: String(url || '').trim(),
    key: String(key || '').trim()
  };
  if (clean.url || clean.key) {
    try { localStorage.setItem(SAVED_LINK_KEY, JSON.stringify(clean)); } catch {}
  }
  return clean;
}

export function clearSavedSyncLink() {
  try { localStorage.removeItem(SAVED_LINK_KEY); } catch {}
}

export async function manualSync() {
  await pushAll();
  if (!state.applyingRemote) await applyRemote();
}

export async function autoConnect() {
  const config = getSyncConfig();
  if (!config || !config.url) return;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') return;
  state.client = window.supabase.createClient(config.url, config.key, { auth: { persistSession: false } });
  state.onlineHandler = () => {
    if (!state.applyingRemote) applyRemote();
  };
  window.addEventListener('online', state.onlineHandler);
  startRealtime();
  await applyRemote();
}

['categories', 'templates', 'tasks', 'activities'].forEach((tableName) => {
  const table = db[tableName];
  ['creating', 'updating', 'deleting'].forEach((hookName) => {
    table.hook(hookName, () => {
      if (!state.applyingRemote) schedulePush();
    });
  });
});

export { makeUuid };
