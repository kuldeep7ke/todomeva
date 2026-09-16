import { exportData, getCategories, getTasks, importData, localDateStr, seedDatabase, sendToPending, setTaskStatus } from './db.js?v=8';
import { archiveTaskById, closeQuickAdd, emptyArchiveAll, formStateSnapshot, openQuickAdd, openTaskDetail, openTimerPopup, purgeTaskById, refreshIcons, renderSidebar, restoreTaskById, showOnboarding } from './components.js?v=14';
import { renderBasics, renderCategory, renderDashboard, renderDone, renderArchive, renderPriorityMatrix, renderRecommended, renderSettings, renderTime, renderUpcoming, renderNotificationsPanel, openSpecialDayModal, updateNotifBadge, updateSyncStatusUI } from './views.js?v=22';
import { checkAndFireReminders, requestNotificationPermission } from './reminder.js?v=8';
import { getNotifyPrefs, resetPrefs, setPref } from './prefs.js?v=5';
import { saveProfile } from './account.js?v=4';
import { initLang, setLang, t } from './i18n.js?v=15';
import { connectSync, disconnectSync, manualSync, pushAll, SCHEMA_SQL, saveSyncLink, clearSavedSyncLink, getSavedSyncLink } from './sync.js?v=11';
import { confirmDialog, isDialogOpen } from './dialog.js?v=2';
import { getDeviceId, initBroadcasts, refreshBroadcasts } from './broadcast.js?v=6';

let activeView = 'dashboard';
let activeWindow = 'today';
let initPromise = null;
let lastSyncRefresh = 0;
let timerPopupShownFor = new Map();

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

const isReturningUser = Boolean(localStorage.getItem('todoMeva_lang'));
if (isReturningUser) window.__enterApp();

async function initApp() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await seedDatabase();
    wireGlobalEvents();
    initLang();
    await refreshCurrentView();
    showOnboarding();
    autoConnect();
    initBroadcasts();
    setInterval(checkAndFireReminders, 30000);
    setInterval(tickFocusTimers, 1000);
    setInterval(autoPendOverdue, 60000);
    autoPendOverdue();
  })();
  return initPromise;
}

async function autoPendOverdue() {
  if (!getNotifyPrefs().autoPending) return;
  const tasks = await getTasks();
  const today = localDateStr();
  let changed = false;
  for (const task of tasks) {
    if (task.deletedAt || task.status === 'pending' || task.status === 'done') continue;
    if (!task.dueDate || task.dueDate >= today) continue;
    if (task.status === 'not_started') {
      await sendToPending(task.id, 'not_started_by_due_date');
      changed = true;
    } else if (task.status === 'in_progress') {
      await sendToPending(task.id, 'in_progress_past_due');
      changed = true;
    }
  }
  if (changed) await refreshCurrentView();
}

async function autoConnect() {
  const { autoConnect: connect } = await import('./sync.js?v=11');
  await connect();
}

function wireGlobalEvents() {
  renderFabMenu();
  document.querySelector('#fab').addEventListener('click', toggleFabMenu);
  document.querySelector('#fab-menu').addEventListener('click', handleFabMenuClick);
  document.querySelector('#mobile-menu-btn').addEventListener('click', openSidebar);
  document.querySelector('#sidebar-backdrop').addEventListener('click', closeSidebar);
  document.querySelector('#theme-toggle').addEventListener('click', toggleTheme);
  document.querySelector('#notif-btn').addEventListener('click', toggleNotifications);
  document.querySelector('#notif-panel').addEventListener('click', handleNotifPanelClick);
  document.querySelector('#import-file').addEventListener('change', handleImport);
  document.querySelector('#sidebar').addEventListener('click', handleSidebarClick);
  document.querySelector('#view-content').addEventListener('click', handleViewContentClick);
  document.querySelector('#view-content').addEventListener('submit', handleViewContentSubmit);
  document.querySelector('#quick-add-modal').addEventListener('click', (event) => { if (event.target.id === 'quick-add-modal') guardModalClose('#quick-add-modal', closeQuickAdd); });
  document.querySelector('#task-modal').addEventListener('click', (event) => { if (event.target.id === 'task-modal') guardModalClose('#task-modal', closeTaskModal); });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('.fab-wrap')) closeFabMenu();
    if (!event.target.closest('.notif-wrap')) closeNotifications();
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openQuickAdd();
    }
    if (event.key === 'Escape') {
      const quickModal = document.querySelector('#quick-add-modal');
      const taskModal = document.querySelector('#task-modal');
      if (!quickModal.classList.contains('hidden')) {
        guardModalClose('#quick-add-modal', closeQuickAdd);
        return;
      }
      if (!taskModal.classList.contains('hidden')) {
        guardModalClose('#task-modal', closeTaskModal);
        return;
      }
      const sdModal = document.querySelector('#special-day-modal');
      if (sdModal && !sdModal.classList.contains('hidden')) {
        sdModal.classList.add('hidden');
        return;
      }
      const timerPopup = document.querySelector('#timer-popup');
      if (timerPopup && !timerPopup.classList.contains('hidden')) {
        timerPopup.classList.add('hidden');
        return;
      }
      closeFabMenu();
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

function renderFabMenu() {
  const menu = document.querySelector('#fab-menu');
  if (!menu) return;
  menu.innerHTML = `
    <button class="fab-menu-item" type="button" data-fab-action="quick-task" data-i18n="fab_quick_task"><i data-lucide="zap"></i>${t('fab_quick_task')}</button>
    <button class="fab-menu-item" type="button" data-fab-action="special-day" data-i18n="fab_special_day"><i data-lucide="calendar-heart"></i>${t('fab_special_day')}</button>
  `;
  refreshIcons();
}

function toggleFabMenu() {
  const menu = document.querySelector('#fab-menu');
  const fab = document.querySelector('#fab');
  if (!menu) return;
  const isOpen = menu.classList.toggle('hidden') === false;
  fab?.setAttribute('aria-expanded', String(isOpen));
}

function closeFabMenu() {
  const menu = document.querySelector('#fab-menu');
  const fab = document.querySelector('#fab');
  if (menu) menu.classList.add('hidden');
  fab?.setAttribute('aria-expanded', 'false');
}

function handleFabMenuClick(event) {
  const item = event.target.closest('[data-fab-action]');
  if (!item) return;
  closeFabMenu();
  const action = item.dataset.fabAction;
  if (action === 'quick-task') openQuickAdd();
  if (action === 'special-day') openSpecialDayModal();
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

async function guardModalClose(modalId, closeFn) {
  if (isDialogOpen()) return;
  const modal = document.querySelector(modalId);
  const baseline = modal?.dataset.formBaseline;
  const form = modal?.querySelector('form');
  const changed = Boolean(form && baseline && formStateSnapshot(form) !== baseline);
  if (!changed) {
    closeFn();
    return;
  }
  const shouldDiscard = await confirmDialog({
    title: t('discard_changes'),
    message: t('modal_discard_confirm'),
    confirmText: t('discard_changes'),
    dismissText: t('cancel')
  });
  if (shouldDiscard) closeFn();
}

async function refreshCurrentView() {
  const [categories, tasks] = await Promise.all([getCategories(), getTasks()]);
  renderSidebar(categories, tasks, activeView);
  if (activeView === 'dashboard') await renderDashboard();
  if (activeView === 'time') await renderTime(activeWindow);
  if (activeView === 'upcoming') await renderUpcoming();
  if (activeView === 'priority') await renderPriorityMatrix();
  if (activeView === 'done') await renderDone();
  if (activeView === 'archive') await renderArchive(activeWindow);
  if (activeView === 'settings') {
    await renderSettings();
    wireSettingsEvents();
  }
  if (activeView === 'basics') await renderBasics();
  if (activeView === 'recommended') await renderRecommended();
  if (activeView.startsWith('category:')) await renderCategory(activeView.split(':')[1]);
  refreshIcons();
  updateNotifBadge();
}

function wireSettingsEvents() {
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
  const windowTab = event.target.closest('[data-window]');
  if (windowTab) {
    activeWindow = windowTab.dataset.window;
    refreshCurrentView();
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
  if (key === 'pref-auto-pending') {
    setPref('autoPending', !getNotifyPrefs().autoPending);
    updateSettingsSwitch(action, 'autoPending');
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
      email: document.querySelector('#profile-email')?.value.trim() || '',
      contact: document.querySelector('#profile-contact')?.value.trim() || ''
    });
    await refreshCurrentView();
    return;
  }
  if (key === 'open-landing') {
    window.__backToLanding();
    return;
  }
  if (key === 'nav-dashboard') {
    navigateTo('dashboard');
    return;
  }
  if (key === 'nav-settings') {
    navigateTo('settings');
    return;
  }
  if (key === 'nav-basics') {
    navigateTo('basics');
    return;
  }
  if (key === 'nav-recommended') {
    navigateTo('recommended');
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
  if (key === 'sync-save-link') {
    const url = document.querySelector('#sync-url')?.value.trim() || '';
    const key = document.querySelector('#sync-key')?.value.trim() || '';
    saveSyncLink(url, key);
    await refreshCurrentView();
    return;
  }
  if (key === 'sync-copy-link') {
    const link = getSavedSyncLink();
    const url = link?.url || document.querySelector('#sync-url')?.value.trim() || '';
    const key = link?.key || document.querySelector('#sync-key')?.value.trim() || '';
    const text = [url, key].filter(Boolean).join('\n');
    if (!text) return;
    await copyTextToClipboard(text);
    const btn = document.querySelector('[data-settings-action="sync-copy-link"]');
    if (btn) {
      const original = btn.textContent;
      btn.textContent = t('s_sync_link_copied');
      setTimeout(() => { btn.textContent = original; }, 2000);
    }
    return;
  }
  if (key === 'sync-clear-link') {
    clearSavedSyncLink();
    await refreshCurrentView();
    return;
  }
  if (key === 'sync-reconnect') {
    const link = getSavedSyncLink();
    if (!link || !link.url) return;
    try {
      await connectSync(link.url, link.key);
    } catch (error) {
      showSyncError(error.message || String(error));
    }
    await refreshCurrentView();
    return;
  }
  if (key === 'sync-copy-sql') {
    await copySyncSql(action);
    return;
  }
  if (key === 'sync-how-trigger') {
    const details = document.querySelector('#sync-how-details');
    if (details) {
      details.classList.toggle('hidden');
      const trigger = document.querySelector('.sync-how-trigger');
      if (trigger) trigger.setAttribute('aria-expanded', String(!details.classList.contains('hidden')));
    }
    return;
  }
  if (key === 'bc-copy-id') {
    await copyTextToClipboard(getDeviceId());
    const btn = document.querySelector('[data-settings-action="bc-copy-id"]');
    if (btn) {
      btn.textContent = t('bc_copied');
      setTimeout(() => { btn.textContent = t('bc_copy_id'); }, 1500);
    }
    return;
  }
  if (key === 'bc-refresh') {
    await refreshBroadcasts();
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
  await importData({ categories: [], templates: [], tasks: [], activities: [], history: [], special_days: [] });
  await seedDatabase();
  await pushAll();
  resetDangerPanel();
  await refreshCurrentView();
}

async function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  textarea.setAttribute('readonly', '');
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  textarea.remove();
  return ok;
}

async function copySyncSql(action) {
  await copyTextToClipboard(SCHEMA_SQL);
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
    for (const task of tasks) {
      if (!task.focusStartedAt || task.status !== 'in_progress' || task.deletedAt) continue;
      const end = new Date(task.focusStartedAt).getTime() + (Number(task.durationMinutes) || 25) * 60000;
      if (now >= end && timerPopupShownFor.get(task.id) !== end) {
        timerPopupShownFor.set(task.id, end);
        openTimerPopup(task);
      }
    }
    document.querySelectorAll('[data-timer-chip]').forEach((span) => {
      const task = tasks.find((item) => String(item.id) === span.dataset.timerChip);
      if (!task?.focusStartedAt) return;
      const end = new Date(task.focusStartedAt).getTime() + (Number(task.durationMinutes) || 25) * 60000;
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