import { getTasks, updateTask } from './db.js?v=8';
import { isPrefEnabled } from './prefs.js?v=5';

const CAPACITOR = () => (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ? window.Capacitor : null;
const LOCAL_NOTIF = () => { const cap = CAPACITOR(); return cap && cap.Plugins && cap.Plugins.LocalNotifications ? cap.Plugins.LocalNotifications : null; };

function notifId(taskId, minutesBefore) {
  let h = 0;
  const key = String(taskId) + ':' + String(minutesBefore);
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

export function isNotificationsSupported() { return !!LOCAL_NOTIF() || 'Notification' in window; }

export async function getNotificationPermission() {
  const ln = LOCAL_NOTIF();
  if (ln) {
    try {
      const res = await ln.checkPermissions();
      return res && res.display ? res.display : 'prompt';
    } catch (_) { return 'prompt'; }
  }
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  const ln = LOCAL_NOTIF();
  if (ln) {
    try {
      const res = await ln.requestPermissions();
      return res && res.display ? res.display : 'prompt';
    } catch (_) { return 'prompt'; }
  }
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') return Notification.requestPermission();
  return Notification.permission;
}

export async function checkAndFireReminders() {
  if (!isPrefEnabled('reminders')) return;
  const ln = LOCAL_NOTIF();
  const webOk = 'Notification' in window && Notification.permission === 'granted';
  if (!ln && !webOk) return;
  if (ln) {
    const p = await getNotificationPermission();
    if (p !== 'granted') return;
  }
  const now = Date.now();
  const tasks = await getTasks();
  for (const task of tasks) {
    if (task.status === 'done' || task.status === 'pending' || task.deletedAt || !task.dueDate || !task.reminders?.length) continue;
    const due = new Date(task.dueDate + 'T09:00:00').getTime();
    const reminders = task.reminders.map((reminder, idx) => {
      if (reminder.fired) return reminder;
      const fireAt = due - reminder.minutesBefore * 60 * 1000;
      if (now >= fireAt) {
        if (ln) {
          ln.schedule({ notifications: [{ id: notifId(task.id, reminder.minutesBefore), title: 'Todo Meva reminder', body: task.title, schedule: { at: new Date(now + 500) }, smallIcon: 'ic_stat_notify' }] }).catch(() => {});
        } else {
          new Notification('Todo Meva reminder', { body: task.title });
        }
        return { ...reminder, fired: true };
      }
      return reminder;
    });
    if (JSON.stringify(reminders) !== JSON.stringify(task.reminders)) await updateTask(task.id, { reminders });
  }
}
