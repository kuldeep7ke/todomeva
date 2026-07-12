import { getAllCategories, getAllTasks, saveCategory, getTasksWithReminders, logActivity } from './db.js?v=4';
import { seedDatabase } from './seed.js?v=4';
import { renderSidebar, openQuickAdd, closeModals, showOnboarding, setView } from './components.js?v=4';
import { renderDashboard, renderUpcoming, renderCategoryFilter, renderPriorityMatrix } from './views.js?v=4';
import { checkAndFireReminders, requestNotificationPermission, sendNotification } from './reminder.js?v=4';

let activeView = 'dashboard';
let activeCategoryId = null;
let initPromise = null;

applyTheme();

window.refreshCurrentView = async () => {
  await renderActiveView();
  await updateSidebarCounts();
};

window.navigateTo = async (view, categoryId) => {
  activeView = view;
  activeCategoryId = categoryId || null;
  setView(activeView, activeCategoryId);
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

function applyTheme(theme) {
  if (!theme) {
    try {
      theme = localStorage.getItem('todoMeva_theme') || 'dark';
    } catch (e) {
      theme = 'dark';
    }
  }
  document.documentElement.setAttribute('data-theme', theme);
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    const icon = toggle.querySelector('i');
    const label = document.getElementById('theme-label');
    if (theme === 'light') {
      if (icon) icon.setAttribute('data-lucide', 'moon');
      if (label) label.textContent = 'Dark Mode';
    } else {
      if (icon) icon.setAttribute('data-lucide', 'sun');
      if (label) label.textContent = 'Light Mode';
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  try {
    localStorage.setItem('todoMeva_theme', next);
  } catch (e) {}
  applyTheme(next);
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
  try {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    const vc = document.getElementById('view-content');
    if (vc) {
      vc.innerHTML = '<div style="background:rgba(var(--accent-rgb),0.08);border:2px solid var(--accent-primary);border-radius:12px;padding:30px;margin:20px;text-align:center;color:var(--text-primary)"><p style="font-size:15px">Loading dashboard...</p></div>';
    } else {
      console.error('enterApp: view-content not found');
    }
    initApp().catch(e => console.error('initApp failed:', e));
  } catch (e) {
    console.error('enterApp error:', e);
  }
}

window.__enterApp = enterApp;
window._initApp = initApp;

async function initApp() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await seedDatabase();
    } catch (e) {
      console.error('seedDatabase failed:', e);
      document.getElementById('view-content').innerHTML = '<div style="background:rgba(248,113,113,0.1);border:2px solid #f87171;border-radius:12px;padding:30px;margin:20px;text-align:center;color:#f87171"><p style="font-size:15px">Database error</p><p style="font-size:12px;margin-top:8px;opacity:0.6">' + e.message + '</p></div>';
      throw e;
    }
    await renderActiveView();
    await updateSidebarCounts();

    let onboardingDone = true;
    try {
      onboardingDone = localStorage.getItem('todoMeva_onboardingDone');
    } catch (e) {}
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

    // Theme toggle
    document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

    // Export
    document.getElementById('export-btn')?.addEventListener('click', async () => {
    const { exportAllData } = await import('./db.js?v=4');
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
      const { importAllData } = await import('./db.js?v=4');
      await importAllData(data);
      await window.refreshCurrentView();
    };
    input.click();
    });

    // Avoid showing the browser permission prompt on app startup.
    if ('Notification' in window && Notification.permission === 'granted') {
      await requestNotificationPermission();
    }
    setInterval(async () => {
    const tasks = await getTasksWithReminders();
    await checkAndFireReminders(tasks, (task) => {
      sendNotification(`Reminder: ${task.title}`, `Due ${task.dueDate ? new Date(task.dueDate).toLocaleString() : 'soon'}`);
    });
    }, 30000);
  })().catch(e => {
    initPromise = null;
    throw e;
  });

  return initPromise;
}

window.openQuickAdd = openQuickAdd;
window.closeModals = closeModals;
window.logActivity = logActivity;

if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();

// If user clicked Launch App before module loaded, init now
try {
  if (!document.getElementById('app-shell').classList.contains('hidden')) {
    initApp().catch(e => console.error('initApp auto failed:', e));
  }
} catch (e) {
  console.error('Todo Meva init error:', e);
}
