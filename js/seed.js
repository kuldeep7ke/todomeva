export const PRIORITY_CONFIG = {
  high: { label: 'High', className: 'high' },
  medium: { label: 'Medium', className: 'medium' },
  low: { label: 'Low', className: 'low' }
};

export const STATUS_CONFIG = {
  todo: { label: 'Todo' },
  in_progress: { label: 'In progress' },
  completed: { label: 'Completed' }
};

export const SEED_CATEGORIES = [
  { name: 'Bank & Finance', icon: 'landmark', color: '#3B82F6', order: 1 },
  { name: 'Farm & Agriculture', icon: 'sprout', color: '#22C55E', order: 2 },
  { name: 'Business', icon: 'briefcase', color: '#8B5CF6', order: 3 },
  { name: 'Work & Administrative', icon: 'building-2', color: '#6366F1', order: 4 },
  { name: 'Personal', icon: 'user', color: '#14B8A6', order: 5 },
  { name: 'Family & Home', icon: 'home', color: '#F59E0B', order: 6 },
  { name: 'Kids', icon: 'baby', color: '#EC4899', order: 7 },
  { name: 'Education & Learning', icon: 'graduation-cap', color: '#06B6D4', order: 8 }
];

const templates = {
  'Bank & Finance': ['Pay bill', 'Review bank statement', 'Update budget', 'Track expense', 'Renew insurance', 'Plan investment'],
  'Farm & Agriculture': ['Check irrigation', 'Order farm supplies', 'Review crop calendar', 'Inspect equipment', 'Record harvest', 'Call vendor'],
  Business: ['Follow up lead', 'Send invoice', 'Review inventory', 'Plan campaign', 'Call customer', 'Update accounts'],
  'Work & Administrative': ['Prepare report', 'Schedule meeting', 'Reply email', 'Submit document', 'Review checklist', 'File records'],
  Personal: ['Exercise', 'Doctor appointment', 'Plan week', 'Meditate', 'Personal errand', 'Review goals'],
  'Family & Home': ['Grocery list', 'Home cleaning', 'Pay household bill', 'Family call', 'Meal prep', 'Repair task'],
  Kids: ['School homework', 'Pack school bag', 'Activity reminder', 'Doctor visit', 'Parent meeting', 'Study time'],
  'Education & Learning': ['Read chapter', 'Practice lesson', 'Watch course', 'Revise notes', 'Submit assignment', 'Plan study block']
};

export function buildSeedTemplates(categoryRows) {
  return categoryRows.flatMap((category) =>
    templates[category.name].map((title, index) => ({
      categoryId: category.id,
      title,
      description: `Use this smart preset to quickly create: ${title.toLowerCase()}.`,
      priority: index % 3 === 0 ? 'high' : index % 3 === 1 ? 'medium' : 'low',
      order: index + 1
    }))
  );
}
