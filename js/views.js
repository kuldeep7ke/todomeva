import { addTask, getCategories, getTasks, localDateStr } from './db.js?v=4';
import { attachTaskCardEvents, icon, renderTaskCard, refreshIcons } from './components.js?v=4';
import { t } from './i18n.js?v=5';
import { getLang, getLangs } from './i18n.js?v=5';
import { getNotifyPrefs } from './prefs.js?v=4';
import { getProfile } from './account.js?v=4';
import { getSyncConfig, getSyncStatus, SCHEMA_SQL } from './sync.js?v=4';

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
      ${stat(t('stat_open'), openTasks.length)}${stat(t('stat_due_today'), dueToday.length)}${stat(t('stat_overdue'), overdue.length)}${stat(t('stat_completed'), completed.length)}
    </section>
    <section class="card"><h3>${t('quick_create')}</h3><form id="dashboard-create" class="quick-create"><input class="field" name="title" placeholder="${t('placeholder_add_task')}" required /><select class="select" name="categoryId">${categories.map((category) => `<option value="${category.id}">${escapeHtml(category.name)}</option>`).join('')}</select><select class="select" name="priority"><option value="medium">${t('priority_medium')}</option><option value="high">${t('priority_high')}</option><option value="low">${t('priority_low')}</option></select><button class="btn btn-primary">${t('add')}</button></form></section>
    ${taskSection(t('section_overdue'), overdue, categoryMap)}
    ${taskSection(t('section_today'), dueToday, categoryMap)}
    ${taskSection(t('section_all_open'), openTasks.filter((task) => task.dueDate !== today && !(task.dueDate && task.dueDate < today)), categoryMap)}
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
  content.innerHTML = taskSection(t('section_next'), upcoming, categoryMap);
  attachTaskCardEvents(content);
  refreshIcons();
}

export async function renderCategory(categoryId) {
  const { categories, tasks, categoryMap } = await loadViewData();
  const category = categories.find((item) => item.id === Number(categoryId));
  const filtered = tasks.filter((task) => task.categoryId === Number(categoryId));
  document.querySelector('#view-content').innerHTML = taskSection(category?.name || t('no_category'), filtered, categoryMap);
  attachTaskCardEvents(document.querySelector('#view-content'));
  refreshIcons();
}

export async function renderPriorityMatrix() {
  const { tasks, categoryMap } = await loadViewData();
  const content = document.querySelector('#view-content');
  content.innerHTML = `<div class="grid stats-grid">${['high', 'medium', 'low'].map((priority) => `<section class="card"><h3>${t(`priority_${priority}`)}</h3><div class="task-list">${tasks.filter((task) => task.priority === priority && task.status !== 'completed').map((task) => renderTaskCard(task, categoryMap.get(task.categoryId))).join('') || `<p class="empty-state">${t('no_tasks')}</p>`}</div></section>`).join('')}</div>`;
  attachTaskCardEvents(content);
  refreshIcons();
}

export async function renderSettings() {
  const content = document.querySelector('#view-content');
  const isDark = document.documentElement.dataset.theme === 'dark';
  const brand = document.documentElement.dataset.brand || 'orange';
  const notificationsAvailable = 'Notification' in window;
  const notifStateKey = notificationsAvailable
    ? (Notification.permission === 'granted' ? 's_notif_status_enabled' : Notification.permission === 'denied' ? 's_notif_status_blocked' : 's_notif_status_off')
    : 's_notif_status_unsupported';
  const notifyPrefs = getNotifyPrefs();
  const profile = getProfile();
  const sync = getSyncStatus();
  const syncConfig = getSyncConfig();
  const initials = profile.name ? profile.name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase() : 'TM';

  content.innerHTML = `
    <div class="grid settings-grid settings-grid-full">
      ${settingsCardIcon('s_account', 's_account_desc', '', icon('circle-user'), `
        <div class="profile-head">
          <div class="profile-avatar">${escapeHtml(initials)}</div>
          <div class="settings-row-copy">
            <strong>${escapeHtml(profile.name || t('s_account'))}</strong>
            <span class="muted">${escapeHtml(profile.email || 'No email')}</span>
          </div>
        </div>
        <form id="profile-form" class="hidden sync-form">
          <input class="field" id="profile-name" placeholder="${t('s_name')}" value="${escapeAttr(profile.name || '')}" />
          <input class="field" id="profile-email" type="email" placeholder="${t('s_email')}" value="${escapeAttr(profile.email || '')}" />
          <div class="sync-actions"><button class="btn btn-primary" data-settings-action="profile-save">${t('s_profile_save')}</button><button class="btn btn-ghost" type="button" data-settings-action="profile-cancel">${t('s_profile_cancel')}</button></div>
        </form>
        <div class="sync-actions">
          <button class="btn btn-ghost" data-settings-action="edit-profile">${t('s_edit_profile')}</button>
          <button class="btn btn-ghost" data-settings-action="open-landing">${t('s_open_landing')}</button>
        </div>
      `)}
      ${settingsCard('s_appearance', 's_appearance_desc', `
        ${settingsRow('moon', 's_dark_mode', 's_dark_mode_desc', `<button class="setting-switch ${isDark ? 'on' : ''}" role="switch" aria-checked="${isDark}" aria-label="${t('s_dark_mode')}" data-settings-action="dark-mode"></button>`)}
        ${settingsRow('palette', 's_app_color', 's_app_color_desc', `
          <div class="palette-row">
            <button class="palette-chip ${brand === 'orange' ? 'active' : ''}" style="--chip:#f97316" data-settings-action="brand" data-brand="orange" aria-label="${t('s_color_orange')}">${t('s_color_orange')}</button>
            <button class="palette-chip ${brand === 'blue' ? 'active' : ''}" style="--chip:#2563eb" data-settings-action="brand" data-brand="blue" aria-label="${t('s_color_blue')}">${t('s_color_blue')}</button>
            <button class="palette-chip ${brand === 'green' ? 'active' : ''}" style="--chip:#16a34a" data-settings-action="brand" data-brand="green" aria-label="${t('s_color_green')}">${t('s_color_green')}</button>
          </div>`)}
      `)}
      ${settingsCardIcon('s_language', 's_language_desc', 'purple', icon('languages'), `
        <div class="segmented">
          ${(['en', 'mr', 'hi']).map((code) => `<button class="${getLang() === code ? 'active' : ''}" data-settings-action="lang" data-lang="${code}">${getLangs()[code]}</button>`).join('')}
        </div>`)}
      ${settingsCardIcon('s_notifications', 's_notifications_desc', 'blue', icon('bell-ring'), `
        ${settingsRow('bell', 's_notif_reminders', 's_notif_reminders_desc', `<button class="setting-switch ${notifyPrefs.reminders ? 'on' : ''}" role="switch" aria-checked="${notifyPrefs.reminders}" aria-label="${t('s_notif_reminders')}" data-settings-action="pref-reminders"></button>`)}
        ${settingsRow('message-circle', 's_notif_popups', 's_notif_popups_desc', `<button class="setting-switch ${notifyPrefs.onboarding ? 'on' : ''}" role="switch" aria-checked="${notifyPrefs.onboarding}" aria-label="${t('s_notif_popups')}" data-settings-action="pref-onboarding"></button>`)}
        ${settingsRow('bell', 's_notif_reminders', t(notifStateKey), notificationsAvailable && Notification.permission === 'default' ? `<button class="btn btn-primary" data-request-notifications>${t('s_notif_enable')}</button>` : '')}
      `)}
      ${settingsCardIcon('s_sync', 's_sync_desc', 'blue', icon('refresh-cw'), `
        <div class="sync-status-row">
          <span class="sync-dot" data-state="${sync.status}"></span>
          <strong id="sync-status-label">${syncStatusLabel()}</strong>
          <span class="muted" id="sync-last-label">${sync.lastSync ? `${t('s_sync_last')} ${formatLastSync(sync.lastSync)}` : ''}</span>
        </div>
        ${sync.error ? `<p class="muted sync-error">${escapeHtml(sync.error)}</p>` : ''}
        <form id="sync-connect-form" class="sync-form">
          <input class="field" id="sync-url" placeholder="${t('s_sync_url_ph')}" value="${escapeAttr(syncConfig?.url || '')}" autocomplete="off" />
          <input class="field" id="sync-key" type="password" placeholder="${t('s_sync_key_ph')}" value="${escapeAttr(syncConfig?.key || '')}" autocomplete="off" />
          <div class="sync-actions">
            <button class="btn btn-primary" type="submit">${t('s_sync_connect')}</button>
            <button class="btn btn-ghost" type="button" data-settings-action="sync-now">${t('s_sync_now')}</button>
            <button class="btn btn-ghost" type="button" data-settings-action="sync-disconnect">${t('s_sync_disconnect')}</button>
          </div>
        </form>
        <details class="sync-how">
          <summary>${t('s_sync_how_title')}</summary>
          <ol>
            <li>${t('s_sync_sql_step1')}</li>
            <li>${t('s_sync_sql_step2')}</li>
            <li>${t('s_sync_sql_step3')}</li>
            <li>${t('s_sync_sql_step4')}</li>
          </ol>
          <pre id="sync-sql">${escapeHtml(SCHEMA_SQL)}</pre>
          <button class="btn btn-ghost" data-settings-action="sync-copy-sql">${t('s_sync_copy_sql')}</button>
        </details>
      `)}
      ${settingsCard('s_data', 's_data_desc', `
        ${settingsRow('download', 's_export', 's_export_desc', `<button class="btn btn-ghost" data-settings-action="export">${t('export')}</button>`)}
        ${settingsRow('upload', 's_import', 's_import_desc', `<button class="btn btn-ghost" data-settings-action="import">${t('import')}</button>`)}
      `)}
      ${settingsCard('s_danger', 's_danger_desc', `
        <div id="danger-main">
          ${settingsRow('trash-2', 's_clear_all', 's_clear_all_desc', `<button class="btn btn-danger" data-settings-action="danger-show">${t('s_clear_all')}</button>`)}
          ${settingsRow('rotate-ccw', 's_prefs_reset', 's_prefs_reset_desc', `<button class="btn btn-ghost" data-settings-action="prefs-reset">${t('s_prefs_reset_btn')}</button>`)}
        </div>
        <div id="danger-confirm" class="hidden">
          <p class="muted">${t('s_confirm_delete')}</p>
          <input class="field" id="danger-confirm-input" placeholder="${t('s_confirm_placeholder')}" autocomplete="off" />
          <div class="sync-actions">
            <button class="btn btn-danger" id="danger-confirm-btn" disabled data-settings-action="danger-do">${t('s_clear_all')}</button>
            <button class="btn btn-ghost" data-settings-action="danger-cancel">${t('s_profile_cancel')}</button>
          </div>
        </div>
      `)}
      ${settingsCard('s_about', 's_about_desc', `
        ${settingsRow('shield', 's_privacy', 's_privacy_desc', '<span class="muted settings-check">100% local</span>')}
        ${settingsRow('info', 's_version', 's_version_desc', '<span class="muted settings-check">v1.0</span>')}
      `)}
    </div>
  `;
  refreshIcons();
}

export function syncStatusLabel() {
  const { status } = getSyncStatus();
  if (status === 'connected') return t('s_sync_status_connected');
  if (status === 'syncing') return t('s_sync_status_syncing');
  if (status === 'error') return t('s_sync_status_error');
  return t('s_sync_status_disconnected');
}

export function updateSyncStatusUI() {
  const label = document.querySelector('#sync-status-label');
  const last = document.querySelector('#sync-last-label');
  const dot = document.querySelector('.sync-dot');
  const error = document.querySelector('.sync-error');
  const status = getSyncStatus();
  if (label) label.textContent = syncStatusLabel();
  if (last) last.textContent = status.lastSync ? `${t('s_sync_last')} ${formatLastSync(status.lastSync)}` : '';
  if (dot) dot.dataset.state = status.status;
  if (error) error.textContent = status.error || '';
}

function formatLastSync(iso) {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function settingsCard(titleKey, descKey, body) {
  return `
    <section class="card">
      <div class="settings-card-header"><div><h3>${t(titleKey)}</h3><p class="muted">${t(descKey)}</p></div></div>
      <div class="settings-list">${body}</div>
    </section>`;
}

function settingsCardIcon(titleKey, descKey, gradient, iconName, body) {
  return `
    <section class="card ${gradient ? `card-gradient-${gradient}` : ''}">
      <div class="settings-card-header"><div>${iconName}<h3>${t(titleKey)}</h3><p class="muted">${t(descKey)}</p></div></div>
      <div class="settings-list">${body}</div>
    </section>`;
}

function settingsRow(iconName, titleKey, descKey, control) {
  return `
    <div class="settings-row">
      <div class="settings-row-icon">${icon(iconName)}</div>
      <div class="settings-row-copy"><strong>${t(titleKey)}</strong><span class="muted">${t(descKey)}</span></div>
      ${control}
    </div>`;
}

function stat(label, value) {
  return `<article class="card stat-card"><strong>${value}</strong><span>${label}</span></article>`;
}

function taskSection(title, tasks, categoryMap) {
  return `<section class="card"><div class="section-header"><h3>${title}</h3><span class="muted">${tasks.length}</span></div><div class="task-list">${tasks.map((task) => renderTaskCard(task, categoryMap.get(task.categoryId))).join('') || `<p class="empty-state">${t('nothing_here')}</p>`}</div></section>`;
}

async function loadViewData() {
  const [categories, tasks] = await Promise.all([getCategories(), getTasks()]);
  return { categories, tasks, categoryMap: new Map(categories.map((category) => [category.id, category])) };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, '&#039;');
}

export async function updateNotifBadge() {
  const badge = document.querySelector('#notif-badge');
  if (!badge) return;
  const tasks = await getTasks();
  const today = localDateStr();
  const count = tasks.filter((task) => task.status !== 'completed' && task.dueDate && task.dueDate <= today).length;
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.classList.toggle('hidden', count === 0);
}

export async function renderNotificationsPanel() {
  const content = document.querySelector('#notif-panel');
  if (!content) return;
  const { tasks, categoryMap } = await loadViewData();
  const today = localDateStr();
  const soonLimit = addDaysDateStr(3);
  const openTasks = tasks.filter((task) => task.status !== 'completed');
  const groups = [
    { key: 'section_overdue', items: openTasks.filter((task) => task.dueDate && task.dueDate < today) },
    { key: 'section_today', items: openTasks.filter((task) => task.dueDate === today) },
    { key: 'notif_due_soon', items: openTasks.filter((task) => task.dueDate && task.dueDate > today && task.dueDate <= soonLimit).sort((a, b) => a.dueDate.localeCompare(b.dueDate)) }
  ]
    .map((group) => ({ ...group, items: group.items.slice(0, 20) }))
    .filter((group) => group.items.length > 0);
  const canNotif = 'Notification' in window && Notification.permission === 'default';
  const button = document.querySelector('#notif-btn');
  if (button) button.setAttribute('aria-label', t('notif_title'));
  content.innerHTML = `
    <div class="notif-panel-head"><strong>${t('notif_title')}</strong></div>
    <div class="notif-list">${groups.length ? groups.map((group) => `
      <p class="notif-group-label">${t(group.key)}</p>
      ${group.items.map((task) => notifItem(task, categoryMap.get(task.categoryId), notifMeta(task.dueDate, today))).join('')}
    `).join('') : `<p class="notif-empty">${t('notif_empty')}</p>`}</div>
    ${canNotif ? `<div class="notif-panel-footer"><button class="btn btn-ghost" data-request-notifications>${t('s_notif_enable')}</button></div>` : ''}
  `;
  await updateNotifBadge();
  refreshIcons();
}

function notifItem(task, category, meta) {
  return `<button class="notif-item" data-task-id="${task.id}" title="${escapeAttr(task.title)}">
    <span class="notif-dot" style="background:${escapeHtml(category?.color || '#6b7280')}"></span>
    <span class="notif-copy"><strong>${escapeHtml(task.title)}</strong><span class="muted">${escapeHtml(category?.name || '')}</span></span>
    <span class="notif-pill">${escapeHtml(meta)}</span>
  </button>`;
}

function addDaysDateStr(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function notifMeta(due, today) {
  if (due < today) return t('section_overdue');
  if (due === today) return t('section_today');
  if (due === addDaysDateStr(1)) return t('notif_tomorrow');
  const days = Math.max(2, Math.round((new Date(due + 'T00:00:00') - new Date(today + 'T00:00:00')) / 86400000));
  return t('notif_in_days').replace('{n}', days);
}