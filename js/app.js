import { exportData, getCategories, getTasks, importData, seedDatabase } from './db.js?v=1';
import { closeQuickAdd, openQuickAdd, refreshIcons, renderSidebar, showOnboarding } from './components.js?v=1';
import { renderCategory, renderDashboard, renderPriorityMatrix, renderUpcoming } from './views.js?v=1';
import { checkAndFireReminders, requestNotificationPermission } from './reminder.js?v=1';

let activeView = 'dashboard';
let initPromise = null;

window.__enterApp = function enterApp() {
  document.querySelector('#landing-page').classList.add('hidden');
  document.querySelector('#app-shell').classList.remove('hidden');
  initApp();
};

window.refreshCurrentView = refreshCurrentView;
window.navigateTo = navigateTo;

document.querySelectorAll('[data-enter-app]').forEach((button) => button.addEventListener('click', window.__enterApp));

async function initApp() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await seedDatabase();
    wireGlobalEvents();
    await refreshCurrentView();
    showOnboarding();
    setInterval(checkAndFireReminders, 30000);
  })();
  return initPromise;
}

function wireGlobalEvents() {
  document.querySelector('#fab').addEventListener('click', () => openQuickAdd());
  document.querySelector('#mobile-menu-btn').addEventListener('click', openSidebar);
  document.querySelector('#sidebar-backdrop').addEventListener('click', closeSidebar);
  document.querySelector('#theme-toggle').addEventListener('click', toggleTheme);
  document.querySelector('#export-btn').addEventListener('click', downloadExport);
  document.querySelector('#import-btn').addEventListener('click', () => document.querySelector('#import-file').click());
  document.querySelector('#import-file').addEventListener('change', handleImport);
  document.querySelector('#sidebar').addEventListener('click', handleSidebarClick);
  document.querySelector('#quick-add-modal').addEventListener('click', (event) => { if (event.target.id === 'quick-add-modal') closeQuickAdd(); });
  document.querySelector('#task-modal').addEventListener('click', (event) => { if (event.target.id === 'task-modal') closeTaskModal(); });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      openQuickAdd();
    }
    if (event.key === 'Escape') {
      closeQuickAdd();
      closeSidebar();
    }
  });
}

function openSidebar() {
  document.querySelector('#sidebar').classList.add('open');
  document.querySelector('#sidebar-backdrop').classList.add('open');
}

function closeSidebar() {
  document.querySelector('#sidebar').classList.remove('open');
  document.querySelector('#sidebar-backdrop').classList.remove('open');
}

function closeTaskModal() {
  document.querySelector('#task-modal').classList.add('hidden');
}

async function refreshCurrentView() {
  const [categories, tasks] = await Promise.all([getCategories(), getTasks()]);
  renderSidebar(categories, tasks, activeView);
  const title = activeView.startsWith('category:') ? categories.find((category) => category.id === Number(activeView.split(':')[1]))?.name || 'Category' : titleFor(activeView);
  document.querySelector('#view-title').textContent = title;
  if (activeView === 'dashboard') await renderDashboard();
  if (activeView === 'upcoming') await renderUpcoming();
  if (activeView === 'priority') await renderPriorityMatrix();
  if (activeView.startsWith('category:')) await renderCategory(activeView.split(':')[1]);
  refreshIcons();
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

function titleFor(view) {
  return { dashboard: 'Dashboard', upcoming: 'Upcoming', priority: 'Priority Matrix' }[view] || 'Dashboard';
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('todoMeva_theme', next);
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
  await refreshCurrentView();
  event.target.value = '';
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-request-notifications]')) requestNotificationPermission();
});

refreshIcons();
