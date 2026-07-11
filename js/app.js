import { db } from './db.js';
import { getAllCategories, getAllTasks, saveCategory, getTasksWithReminders, logActivity } from './db.js';
import { seedDatabase } from './seed.js';
import { renderSidebar, openQuickAdd, closeModals, showOnboarding, setView } from './components.js';
import { renderDashboard, renderUpcoming, renderCategoryFilter, renderPriorityMatrix } from './views.js';
import { checkAndFireReminders, requestNotificationPermission, sendNotification } from './reminder.js';

let activeView = 'dashboard';
let activeCategoryId = null;

window.refreshCurrentView = async () => {
  await renderActiveView();
  await updateSidebarCounts();
};

async function updateSidebarCounts() {
  const categories = await getAllCategories();
  const allTasks = await getAllTasks();
  const counts = { all: 0 };
  let total = 0;
  for (const cat of categories) {
    const c = allTasks.filter(t => t.categoryId === cat.id && t.status !== 'archived').length;
    counts[cat.id] = c; total += c;
  }
  counts.all = total;
  renderSidebar(categories, activeView, activeCategoryId, counts);
}

async function renderActiveView() {
  updateGreeting();
  switch (activeView) {
    case 'dashboard': await renderDashboard(); break;
    case 'upcoming': await renderUpcoming(); break;
    case 'categories': await renderCategoryFilter(null); break;
    case 'category': await renderCategoryFilter(activeCategoryId); break;
    case 'priority': await renderPriorityMatrix(); break;
    default: await renderDashboard();
  }
}

function updateGreeting() {
  const el = document.getElementById('greeting-text');
  if (!el) return;
  const h = new Date().getHours();
  if (h < 12) el.textContent = 'Good morning';
  else if (h < 17) el.textContent = 'Good afternoon';
  else el.textContent = 'Good evening';
}

function enterApp() {
  document.getElementById('landing-page').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  initApp();
}

window.__enterApp = enterApp;

async function initApp() {
  await seedDatabase();
  await renderActiveView();
  await updateSidebarCounts();

  const onboardingDone = localStorage.getItem('todoMeva_onboardingDone');
  if (!onboardingDone) {
    setTimeout(() => showOnboarding(), 500);
  }

  // Navigation
  document.getElementById('sidebar-nav').addEventListener('click', async (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    activeView = btn.dataset.view;
    activeCategoryId = null;
    setView(activeView);
    await renderActiveView();
    await updateSidebarCounts();
  });

  document.getElementById('category-list').addEventListener('click', async (e) => {
    const btn = e.target.closest('.cat-btn');
    if (btn) {
      const id = btn.dataset.categoryId;
      if (id === 'all') { activeView = 'categories'; activeCategoryId = null; }
      else { activeView = 'category'; activeCategoryId = parseInt(id); }
      setView(activeView, activeCategoryId);
      await renderActiveView();
      await updateSidebarCounts();
    }
    if (e.target.closest('#add-category-btn')) {
      const name = prompt('Category name:');
      if (name && name.trim()) {
        const icon = prompt('Lucide icon name (e.g., star, heart):') || 'star';
        const color = prompt('Color hex (e.g., #FF5733):') || '#FF8A3D';
        const cats = await getAllCategories();
        await saveCategory({ name: name.trim(), icon, color, order: cats.length + 1 });
        await window.refreshCurrentView();
      }
    }
  });

  document.getElementById('fab').addEventListener('click', () => {
    openQuickAdd(activeView === 'category' ? activeCategoryId : null);
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openQuickAdd(null); }
    if (e.key === 'Escape') closeModals();
  });

  document.getElementById('modal-overlay').addEventListener('click', closeModals);

  document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });
  document.getElementById('main-content')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
  });

  // Export
  document.getElementById('export-btn')?.addEventListener('click', async () => {
    const { exportAllData } = await import('./db.js');
    const data = await exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `todo-meva-${new Date().toISOString().substring(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  });

  // Import
  document.getElementById('import-btn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text(); const data = JSON.parse(text);
      const { importAllData } = await import('./db.js');
      await importAllData(data);
      await window.refreshCurrentView();
    };
    input.click();
  });

  await requestNotificationPermission();
  setInterval(async () => {
    const tasks = await getTasksWithReminders();
    await checkAndFireReminders(tasks, (task) => {
      sendNotification(`Reminder: ${task.title}`, `Due ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'soon'}`);
    });
  }, 30000);
}

window.logActivity = logActivity;

document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();
});
