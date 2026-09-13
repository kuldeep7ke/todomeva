import { addTask, addActivity, localDateStr } from './db.js?v=6';

export function calculateNextOccurrence(dueDate, recurrence) {
  if (!dueDate || !recurrence || recurrence === 'none') return '';
  const next = new Date(`${dueDate}T12:00:00`);
  if (recurrence === 'daily') next.setDate(next.getDate() + 1);
  if (recurrence === 'weekly') next.setDate(next.getDate() + 7);
  if (recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
  if (recurrence === 'yearly') next.setFullYear(next.getFullYear() + 1);
  return localDateStr(next);
}

export async function createRecurringTaskInstance(task) {
  const nextDue = calculateNextOccurrence(task.dueDate, task.recurrence);
  if (!nextDue) return;
  const id = await addTask({
    ...task,
    dueDate: nextDue,
    status: 'todo',
    parentTaskId: task.parentTaskId || task.id,
    focusStartedAt: '',
    reminders: (task.reminders || []).map((reminder) => ({ ...reminder, fired: false }))
  });
  await addActivity('task_recurred', id, task.title, `Next due ${nextDue}`);
}
