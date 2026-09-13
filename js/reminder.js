import { getTasks, updateTask } from './db.js?v=4';
import { isPrefEnabled } from './prefs.js?v=4';

export async function checkAndFireReminders() {
  if (!isPrefEnabled('reminders')) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  const tasks = await getTasks();
  for (const task of tasks) {
    if (task.status === 'completed' || !task.dueDate || !task.reminders?.length) continue;
    const due = new Date(`${task.dueDate}T09:00:00`).getTime();
    const reminders = task.reminders.map((reminder) => {
      if (reminder.fired) return reminder;
      const fireAt = due - reminder.minutesBefore * 60 * 1000;
      if (now >= fireAt) {
        new Notification('Todo Meva reminder', { body: task.title });
        return { ...reminder, fired: true };
      }
      return reminder;
    });
    if (JSON.stringify(reminders) !== JSON.stringify(task.reminders)) await updateTask(task.id, { reminders });
  }
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    return Notification.requestPermission();
  }
  return Notification.permission;
}
