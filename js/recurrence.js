export function calculateNextOccurrence(task) {
  if (!task.recurrence) return null;
  const { type, interval, endDate, daysOfWeek } = task.recurrence;
  const baseDate = task.completedAt ? new Date(task.completedAt) : new Date(task.dueDate || task.createdAt);
  const end = endDate ? new Date(endDate) : null;
  let next = new Date(baseDate);
  switch (type) {
    case 'daily':
      next.setDate(next.getDate() + (interval || 1));
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7 * (interval || 1));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + (interval || 1));
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + (interval || 1));
      break;
    case 'custom':
      next.setDate(next.getDate() + (interval || 1));
      break;
    default:
      return null;
  }
  if (end && next > end) return null;
  return next;
}

export function createRecurringTaskInstance(originalTask, newDueDate) {
  const { id, createdAt, completedAt, status, ...rest } = originalTask;
  const newTask = {
    ...rest,
    title: originalTask.title,
    description: originalTask.description,
    categoryId: originalTask.categoryId,
    templateId: originalTask.templateId,
    priority: originalTask.priority,
    startDate: originalTask.startDate || null,
    reminders: originalTask.reminders ? originalTask.reminders.map(r => ({ ...r, triggered: false })) : [],
    status: 'todo',
    dueDate: newDueDate.toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    parentTaskId: originalTask.id
  };
  return newTask;
}
