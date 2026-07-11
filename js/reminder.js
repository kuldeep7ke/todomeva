import { db } from './db.js';

let notificationPermission = Notification.permission;

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return true;
  }
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  notificationPermission = result;
  return result === 'granted';
}

export function sendNotification(title, body) {
  if (notificationPermission === 'granted') {
    try {
      const n = new Notification(title, { body, icon: '/favicon.ico' });
      setTimeout(() => n.close(), 5000);
      return true;
    } catch (e) {
      return false;
    }
  }
  return false;
}

export function timeUntilTrigger(task) {
  if (!task.dueDate || !task.reminders || task.reminders.length === 0) return Infinity;
  const due = new Date(task.dueDate).getTime();
  const now = Date.now();
  let minDiff = Infinity;
  for (const reminder of task.reminders) {
    if (reminder.triggered) continue;
    const msBefore = reminder.value * (
      reminder.unit === 'minutes' ? 60000 :
      reminder.unit === 'hours' ? 3600000 :
      reminder.unit === 'days' ? 86400000 : 60000
    );
    const triggerTime = due - msBefore;
    const diff = triggerTime - now;
    if (diff <= 0 && diff > -60000) {
      minDiff = Math.min(minDiff, Math.abs(diff));
    }
  }
  return minDiff === Infinity ? Infinity : minDiff;
}

export async function checkAndFireReminders(tasks, onNotify) {
  const now = Date.now();
  for (const task of tasks) {
    if (!task.reminders || !task.dueDate) continue;
    const due = new Date(task.dueDate).getTime();
    let updated = false;
    for (let i = 0; i < task.reminders.length; i++) {
      const r = task.reminders[i];
      if (r.triggered) continue;
      const msBefore = r.value * (
        r.unit === 'minutes' ? 60000 :
        r.unit === 'hours' ? 3600000 :
        r.unit === 'days' ? 86400000 : 60000
      );
      const triggerTime = due - msBefore;
      if (triggerTime <= now && triggerTime > now - 60000) {
        r.triggered = true;
        updated = true;
        if (onNotify) onNotify(task);
      }
    }
    if (updated) {
      await db.tasks.put(task);
    }
  }
}
