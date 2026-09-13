import { exportData, getCategories, getTasks, importData, seedDatabase, sendToPending } from './db.js?v=6';
import { archiveTaskById, closeQuickAdd, emptyArchiveAll, openQuickAdd, openTaskDetail, purgeTaskById, refreshIcons, renderSidebar, restoreTaskById, showOnboarding } from './components.js?v=6';
import { renderCategory, renderDashboard, renderDone, renderArchive, renderPriorityMatrix, renderSettings, renderUpcoming, renderNotificationsPanel, updateNotifBadge, updateSyncStatusUI } from './views.js?v=7';
import { checkAndFireReminders, requestNotificationPermission } from './reminder.js?v=7';
import { getNotifyPrefs, resetPrefs, setPref } from './prefs.js?v=4';
import { saveProfile } from './account.js?v=4';
import { initLang, setLang, t } from './i18n.js?v=7';
import { connectSync, disconnectSync, manualSync, pushAll, SCHEMA_SQL } from './sync.js?v=6';

let activeView = 'dashboard';
let initPromise = null;
let lastSyncRefresh = 0;

window.__enterApp = function enterApp() {
  document.querySelector('#landing-page').classList.add('hidden');
  document.querySelector('#app-shell').classList.remove('hidden');
  initApp();
};

window.__backToLanding = function backToLanding() {
  document.querySelector('#app-shell').classList.add('hidden');
  document.querySelector('#landing-page').classList.remove('hidden');
};

window.refreshCurrentView = refreshCurrentView;
window.navigateTo = navigateTo;

document.querySelectorAll('[data-enter-app]').forEach((button) => button.addEventListener('click', window.__enterApp));

async function initApp() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await seedDatabase();
    wireGlobalEvents();
    initLang();
    await refreshCurrentView();
    showOnboarding();
    autoConnect();
    setInterval(checkAndFireReminders, 30000);
    setInterval(tickFocusTimers, 1000);
  })();
  return initPromise;
}

async function autoConnect() {
  const { autoConnect: connect } = await import('./sync.js?v=6');
  await connect();
}

function wireGlobalEvents() {
  document.querySelector('#fab').addEventListener('click', () => openQuickAdd());
  document.querySelector('#mobile-menu-btn').addEventListener('click', openSidebar);
  document.querySelector('#sidebar-backdrop').addEventListener('click', closeSidebar);
  document.querySelector('#theme-toggle').addEventListener('click', toggleTheme);
  document.querySelector('#notif-btn').addEventListener('click', toggleNotifications);
  document.querySelector('#notif-panel').addEventListener('click', handleNotifPanelClick);
  document.querySelector('#import-file').addEventListener('change', handleImport);
  document.querySelector('#sidebar').addEventListener('click', handleSidebarClick);
  document.querySelector('#view-content').addEventListener('click', handleViewContentClick);
  document.querySelector('#view-content').addEventListener('submit', handleViewContentSubmit);
  document.querySelector('#quick-add-modal').addEventListener('click', (event) => { if (event.target.id === 'quick-add-modal') closeQuickAdd(); });
  document.querySelector('#task-modal').addEventListener('click', (event) => { if (event.target.id === 'task-modal') closeTaskModal(); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.notif-wrap')) closeNotifications();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openQuickAdd();
    }
    if (event.key === 'Escape') {
      closeQuickAdd();
      closeSidebar();
      closeNotifications();
    }
  });
  document.addEventListener('todomeva:sync', handleSyncEvent);
}

function openSidebar() {
  document.querySelector('#sidebar').classList.add('open');
  document.querySelector('#sidebar-backdrop').classList.add('open');
}

function closeSidebar() {
  document.querySelector('#sidebar').classList.remove('open');
  document.querySelector('#sidebar-backdrop').classList.remove('open');
}

function closeNotifications() {
  document.querySelector('#notif-panel')?.classList.add('hidden');
}

async function toggleNotifications() {
  const panel = document.querySelector('#notif-panel');
  if (!panel) return;
  if (!panel.classList.contains('hidden')) {
    closeNotifications();
    return;
  }
  panel.innerHTML = '<div class="notif-panel-loading">…</div>';
  panel.classList.remove('hidden');
  await renderNotificationsPanel();
}

function handleNotifPanelClick(event) {
  const item = event.target.closest('[data-task-id]');
  if (item) {
    closeNotifications();
    openTaskDetail(item.dataset.taskId);
    return;
  }
}

function closeTaskModal() {
  document.querySelector('#task-modal').classList.add('hidden');
}

async function refreshCurrentView() {
  const [categories, tasks] = await Promise.all([getCategories(), getTasks()]);
  renderSidebar(categories, tasks, activeView);
  if (activeView === 'dashboard') await renderDashboard();
  if (activeView === 'upcoming') await renderUpcoming();
  if (activeView === 'priority') await renderPriorityMatrix();
  if (activeView === 'done') await renderDone();
  if (activeView === 'archive') await renderArchive();
  if (activeView === 'settings') {
    await renderSettings();
    wireSettingsEvents();
  }
  if (activeView.startsWith('category:')) await renderCategory(activeView.split(':')[1]);
  refreshIcons();
  updateNotifBadge();
}

function wireSettingsEvents() {
  const form = document.querySelector('#sync-connect-form');
  if (form) form.addEventListener('submit', handleSyncConnect);
  const dangerInput = document.querySelector('#danger-confirm-input');
  if (dangerInput) {
    dangerInput.addEventListener('input', () => {
      const button = document.querySelector('#danger-confirm-btn');
      if (button) button.disabled = dangerInput.value !== 'DELETE';
    });
  }
}

function navigateTo(view) {
  activeView = view;
  closeSidebar();
  refreshCurrentView();
}

function handleSidebarClick(event) {
  const view = event.target.closest('[data-view]');
  const category = event.target.closest('[data-category-id]');
  if (view) navigateTo(view.dataset.view);
  if (category) navigateTo(`category:${category.dataset.categoryId}`);
}

function handleViewContentSubmit(event) {
  if (event.target.id === 'sync-connect-form') handleSyncConnect(event);
}

async function handleSyncConnect(event) {
  event.preventDefault();
  const url = document.querySelector('#sync-url')?.value.trim();
  const key = document.querySelector('#sync-key')?.value.trim();
  try {
    await connectSync(url, key);
  } catch (error) {
    showSyncError(error.message || String(error));
  }
  await refreshCurrentView();
}

function showSyncError(message) {
  let error = document.querySelector('#sync-error');
  if (!error) {
    error = document.createElement('p');
    error.id = 'sync-error';
    error.className = 'muted sync-error';
    const form = document.querySelector('#sync-connect-form');
    if (form) form.before(error);
  }
  error.textContent = message;
}

function handleViewContentClick(event) {
  const action = event.target.closest('[data-settings-action]');
  if (action) {
    runSettingsAction(action);
    return;
  }
  const archiveRestore = event.target.closest('[data-archive-restore]');
  if (archiveRestore) {
    restoreTaskById(Number(archiveRestore.dataset.archiveRestore));
    return;
  }
  const archivePurge = event.target.closest('[data-archive-purge]');
  if (archivePurge) {
    purgeTaskById(Number(archivePurge.dataset.archivePurge));
    return;
  }
  const archiveEmpty = event.target.closest('[data-archive-empty]');
  if (archiveEmpty) {
    emptyArchiveAll();
    return;
  }
  const fallback = event.target.closest('[data-view-setting]');
  if (!fallback) return;
  if (fallback.dataset.viewSetting === 'theme') {
    toggleTheme();
    updateViewContentUI();
  }
  if (fallback.dataset.viewSetting === 'import') document.querySelector('#import-file').click();
  if (fallback.dataset.viewSetting === 'export') downloadExport();
}

async function runSettingsAction(action) {
  const key = action.dataset.settingsAction;
  if (key === 'dark-mode') {
    toggleTheme();
    updateViewContentUI();
    return;
  }
  if (key === 'brand') {
    applyBrand(action.dataset.brand);
    await refreshCurrentView();
    return;
  }
  if (key === 'lang') {
    setLang(action.dataset.lang);
    await refreshCurrentView();
    return;
  }
  if (key === 'pref-reminders') {
    setPref('reminders', !getNotifyPrefs().reminders);
    updateSettingsSwitch(action, 'reminders');
    return;
  }
  if (key === 'pref-onboarding') {
    setPref('onboarding', !getNotifyPrefs().onboarding);
    updateSettingsSwitch(action, 'onboarding');
    return;
  }
  if (key === 'edit-profile') {
    toggleProfileForm(true);
    return;
  }
  if (key === 'profile-cancel') {
    toggleProfileForm(false);
    return;
  }
  if (key === 'profile-save') {
    saveProfile({
      name: document.querySelector('#profile-name')?.value.trim() || '',
      email: document.querySelector('#profile-email')?.value.trim() || ''
    });
    await refreshCurrentView();
    return;
  }
  if (key === 'open-landing') {
    window.__backToLanding();
    return;
  }
  if (key === 'export') {
    downloadExport();
    return;
  }
  if (key === 'import') {
    document.querySelector('#import-file').click();
    return;
  }
  if (key === 'sync-now') {
    await manualSync();
    updateSyncStatusUI();
    return;
  }
  if (key === 'sync-disconnect') {
    disconnectSync();
    await refreshCurrentView();
    return;
  }
  if (key === 'sync-copy-sql') {
    await copySyncSql(action);
    return;
  }
  if (key === 'danger-show') {
    const main = document.querySelector('#danger-main');
    const panel = document.querySelector('#danger-confirm');
    if (main) main.classList.add('hidden');
    if (panel) panel.classList.remove('hidden');
    return;
  }
  if (key === 'danger-cancel') {
    resetDangerPanel();
    return;
  }
  if (key === 'danger-do') {
    await wipeAllData();
    return;
  }
  if (key === 'prefs-reset') {
    resetPrefs();
    await refreshCurrentView();
  }
}

function updateSettingsSwitch(action, prefKey) {
  const on = getNotifyPrefs()[prefKey];
  action.classList.toggle('on', on);
  action.setAttribute('aria-checked', String(on));
}

function toggleProfileForm(show) {
  const form = document.querySelector('#profile-form');
  if (!form) return;
  form.classList.toggle('hidden', !show);
}

function resetDangerPanel() {
  const main = document.querySelector('#danger-main');
  const panel = document.querySelector('#danger-confirm');
  const input = document.querySelector('#danger-confirm-input');
  const button = document.querySelector('#danger-confirm-btn');
  if (main) main.classList.remove('hidden');
  if (panel) panel.classList.add('hidden');
  if (input) input.value = '';
  if (button) button.disabled = true;
}

async function wipeAllData() {
  await importData({ categories: [], templates: [], tasks: [], activities: [] });
  await seedDatabase();
  await pushAll();
  resetDangerPanel();
  await refreshCurrentView();
}

async function copySyncSql(action) {
  try {
    await navigator.clipboard.writeText(SCHEMA_SQL);
  } catch {
    const pre = document.querySelector('#sync-sql');
    if (pre) {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
  const original = action.textContent;
  action.textContent = t('s_sync_sql_done');
  setTimeout(() => { action.textContent = original; }, 2000);
}

function updateViewContentUI() {
  const switchElAction = document.querySelector('[data-settings-action="dark-mode"]');
  if (switchElAction) {
    const isDark = document.documentElement.dataset.theme === 'dark';
    switchElAction.classList.toggle('on', isDark);
    switchElAction.setAttribute('aria-checked', String(isDark));
    return;
  }
  const switchEl = document.querySelector('[data-view-setting="theme"]');
  if (!switchEl) return;
  const isDark = document.documentElement.dataset.theme === 'dark';
  switchEl.classList.toggle('on', isDark);
  switchEl.setAttribute('aria-checked', String(isDark));
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('todoMeva_theme', next);
}

function applyBrand(brand) {
  document.documentElement.dataset.brand = brand;
  localStorage.setItem('todoMeva_brand', brand);
}

function handleSyncEvent(event) {
  if (activeView === 'settings') {
    updateSyncStatusUI();
    return;
  }
  if (event.detail?.status !== 'connected') return;
  if (!document.querySelector('#quick-add-modal').classList.contains('hidden')) return;
  if (!document.querySelector('#task-modal').classList.contains('hidden')) return;
  const now = Date.now();
  if (now - lastSyncRefresh < 1500) return;
  lastSyncRefresh = now;
  refreshCurrentView();
}

function tickFocusTimers() {
  const now = Date.now();
  getTasks().then((tasks) => {
    let changed = false;
    for (const task of tasks) {
      if (!task.focusStartedAt || task.status === 'completed' || task.priority === 'pending' || task.deletedAt) continue;
      const end = new Date(task.focusStartedAt).getTime() + (Number(task.focusMinutes) || 25) * 60000;
      if (now >= end) {
        sendToPending(task.id);
        changed = true;
      }
    }
    if (changed) {
      window.refreshCurrentView();
      return;
    }
    document.querySelectorAll('[data-focus-chip]').forEach((span) => {
      const task = tasks.find((item) => String(item.id) === span.dataset.focusChip);
      if (!task?.focusStartedAt) return;
      const end = new Date(task.focusStartedAt).getTime() + (Number(task.focusMinutes) || 25) * 60000;
      span.textContent = formatFocusRemaining(end - now);
    });
  });
}

function formatFocusRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(total / 60)).padStart(2, '0');
  const ss = String(total % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

async function downloadExport() {
  const data = await exportData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `todo-meva-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  await importData(data);
  await pushAll();
  await refreshCurrentView();
  event.target.value = '';
}

document.addEventListener('click', async (event) => {
  if (event.target.closest('[data-request-notifications]')) {
    await requestNotificationPermission();
    if (activeView === 'settings') await refreshCurrentView();
  }
});

refreshIcons();