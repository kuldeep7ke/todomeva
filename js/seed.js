export const SEED_CATEGORIES = [
  { id: 1, name: 'Bank & Finance', icon: 'landmark', color: '#3B82F6', order: 1 },
  { id: 2, name: 'Farm & Agriculture', icon: 'sprout', color: '#22C55E', order: 2 },
  { id: 3, name: 'Business', icon: 'briefcase', color: '#8B5CF6', order: 3 },
  { id: 4, name: 'Work & Administrative', icon: 'building2', color: '#6366F1', order: 4 },
  { id: 5, name: 'Personal', icon: 'user', color: '#14B8A6', order: 5 },
  { id: 6, name: 'Family & Home', icon: 'home', color: '#F59E0B', order: 6 },
  { id: 7, name: 'Kids', icon: 'baby', color: '#EC4899', order: 7 },
  { id: 8, name: 'Education & Learning', icon: 'graduation-cap', color: '#06B6D4', order: 8 }
];

export const SEED_TEMPLATES = [
  // Bank & Finance (categoryId: 1)
  { id: 1, categoryId: 1, title: 'KYC Update', description: 'Complete KYC documentation for bank accounts', priority: 'high', order: 1 },
  { id: 2, categoryId: 1, title: 'Maintain Minimum Balance', description: 'Ensure minimum balance is maintained in all accounts', priority: 'medium', order: 2 },
  { id: 3, categoryId: 1, title: 'Loan EMI Payment', description: 'Pay monthly loan EMI before due date', priority: 'high', order: 3 },
  { id: 4, categoryId: 1, title: 'Credit Card Bill Due', description: 'Pay credit card bill to avoid late fees', priority: 'high', order: 4 },
  { id: 5, categoryId: 1, title: 'FD/RD Renewal', description: 'Renew fixed deposit or recurring deposit', priority: 'medium', order: 5 },
  { id: 6, categoryId: 1, title: 'Tax Filing Prep', description: 'Prepare documents for tax filing', priority: 'high', order: 6 },
  { id: 7, categoryId: 1, title: 'Bank Statement Audit', description: 'Review and audit monthly bank statements', priority: 'low', order: 7 },

  // Farm & Agriculture (categoryId: 2)
  { id: 8, categoryId: 2, title: 'Crop Watering/Irrigation', description: 'Schedule watering for crops', priority: 'high', order: 1 },
  { id: 9, categoryId: 2, title: 'Fertilizer/Pesticide Schedule', description: 'Apply fertilizer or pesticide as per schedule', priority: 'high', order: 2 },
  { id: 10, categoryId: 2, title: 'Equipment/Tractor Maintenance', description: 'Service and maintain farm equipment', priority: 'medium', order: 3 },
  { id: 11, categoryId: 2, title: 'Harvest Planning', description: 'Plan and prepare for upcoming harvest', priority: 'medium', order: 4 },
  { id: 12, categoryId: 2, title: 'Labor Management', description: 'Manage farm labor schedule and payments', priority: 'medium', order: 5 },
  { id: 13, categoryId: 2, title: 'Seed Procurement', description: 'Purchase seeds for next planting cycle', priority: 'high', order: 6 },
  { id: 14, categoryId: 2, title: 'Weather Check', description: 'Check weather forecast for farming activities', priority: 'low', order: 7 },

  // Business (categoryId: 3)
  { id: 15, categoryId: 3, title: 'Client Follow-up', description: 'Follow up with clients on pending items', priority: 'high', order: 1 },
  { id: 16, categoryId: 3, title: 'GST/Tax Compliance', description: 'File GST returns and tax compliance', priority: 'high', order: 2 },
  { id: 17, categoryId: 3, title: 'Inventory Check', description: 'Review and update inventory records', priority: 'medium', order: 3 },
  { id: 18, categoryId: 3, title: 'Vendor Payments', description: 'Process vendor/supplier payments', priority: 'high', order: 4 },
  { id: 19, categoryId: 3, title: 'Invoice Generation', description: 'Generate and send invoices', priority: 'medium', order: 5 },
  { id: 20, categoryId: 3, title: 'Marketing Campaign Review', description: 'Review performance of marketing campaigns', priority: 'medium', order: 6 },
  { id: 21, categoryId: 3, title: 'Payroll Processing', description: 'Process employee payroll', priority: 'high', order: 7 },

  // Work & Administrative (categoryId: 4)
  { id: 22, categoryId: 4, title: 'Daily Standup Prep', description: 'Prepare for daily standup meeting', priority: 'medium', order: 1 },
  { id: 23, categoryId: 4, title: 'Project Deadline', description: 'Complete project deadline deliverables', priority: 'high', order: 2 },
  { id: 24, categoryId: 4, title: 'Meeting Follow-ups', description: 'Send follow-up notes and action items from meetings', priority: 'medium', order: 3 },
  { id: 25, categoryId: 4, title: 'Email Inbox Zero', description: 'Clear and organize email inbox', priority: 'low', order: 4 },
  { id: 26, categoryId: 4, title: 'Performance Review Prep', description: 'Prepare self-assessment for performance review', priority: 'medium', order: 5 },
  { id: 27, categoryId: 4, title: 'Weekly Report Submission', description: 'Compile and submit weekly report', priority: 'medium', order: 6 },

  // Personal (categoryId: 5)
  { id: 28, categoryId: 5, title: 'Workout/Fitness Routine', description: 'Complete daily workout and exercise routine', priority: 'medium', order: 1 },
  { id: 29, categoryId: 5, title: 'Health Checkup', description: 'Schedule and attend regular health checkup', priority: 'high', order: 2 },
  { id: 30, categoryId: 5, title: 'Medication Reminder', description: 'Take prescribed medication on time', priority: 'high', order: 3 },
  { id: 31, categoryId: 5, title: 'Goal Tracking', description: 'Review and track personal goals progress', priority: 'low', order: 4 },
  { id: 32, categoryId: 5, title: 'Habit Check-in', description: 'Daily habit tracking and check-in', priority: 'low', order: 5 },

  // Family & Home (categoryId: 6)
  { id: 33, categoryId: 6, title: 'Grocery/Household Shopping', description: 'Buy groceries and household essentials', priority: 'medium', order: 1 },
  { id: 34, categoryId: 6, title: 'Utility Bill Payments', description: 'Pay electricity, water, and Wi-Fi bills', priority: 'high', order: 2 },
  { id: 35, categoryId: 6, title: 'Home Maintenance/Repairs', description: 'Schedule home maintenance or repairs', priority: 'medium', order: 3 },
  { id: 36, categoryId: 6, title: 'Family Outing Plan', description: 'Plan family outing or weekend activity', priority: 'low', order: 4 },
  { id: 37, categoryId: 6, title: 'Elder Care/Medical Appointments', description: 'Schedule elder care or medical appointments', priority: 'high', order: 5 },

  // Kids (categoryId: 7)
  { id: 38, categoryId: 7, title: 'School Fee Payment', description: 'Pay school fees before due date', priority: 'high', order: 1 },
  { id: 39, categoryId: 7, title: 'Parent-Teacher Meeting (PTM)', description: 'Attend parent-teacher meeting', priority: 'medium', order: 2 },
  { id: 40, categoryId: 7, title: 'Homework/Project Assistance', description: 'Help kids with homework or school project', priority: 'medium', order: 3 },
  { id: 41, categoryId: 7, title: 'Extracurricular Schedule', description: 'Manage extracurricular activity schedule', priority: 'medium', order: 4 },
  { id: 42, categoryId: 7, title: 'School Supply Shopping', description: 'Purchase school supplies and stationery', priority: 'low', order: 5 },
  { id: 43, categoryId: 7, title: 'Vaccination/Health Tracker', description: 'Track and schedule vaccinations and health checkups', priority: 'high', order: 6 },

  // Education & Learning (categoryId: 8)
  { id: 44, categoryId: 8, title: 'Assignment Submission', description: 'Complete and submit assignment before deadline', priority: 'high', order: 1 },
  { id: 45, categoryId: 8, title: 'Exam Preparation', description: 'Study and prepare for upcoming exams', priority: 'high', order: 2 },
  { id: 46, categoryId: 8, title: 'Watch Course Lecture', description: 'Watch online course lecture video', priority: 'medium', order: 3 },
  { id: 47, categoryId: 8, title: 'Research/Reading Session', description: 'Dedicated time for research or reading', priority: 'medium', order: 4 },
  { id: 48, categoryId: 8, title: 'Skill Practice/Revision', description: 'Practice skills or revise learned concepts', priority: 'medium', order: 5 }
];

export const PRIORITY_CONFIG = {
  high: { label: 'High', color: 'bg-red-100 text-red-800 border-red-200', icon: 'arrow-up' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: 'minus' },
  low: { label: 'Low', color: 'bg-green-100 text-green-800 border-green-200', icon: 'arrow-down' }
};

export const STATUS_CONFIG = {
  todo: { label: 'To Do', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  archived: { label: 'Archived', color: 'bg-purple-100 text-purple-700' }
};

export async function seedDatabase() {
  const count = await db.categories.count();
  if (count > 0) return;
  await db.categories.bulkAdd(SEED_CATEGORIES);
  await db.templates.bulkAdd(SEED_TEMPLATES);
}
