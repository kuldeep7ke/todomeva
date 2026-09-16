export const TIME_WINDOWS = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'this_month',
  'last_month',
  'last_six_months',
  'this_year',
  'upcoming',
  'no_date'
];

function parse(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dayStr(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function mondayOf(date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const delta = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - delta);
  return day;
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function startOfWeek() {
  return mondayOf(new Date());
}

export function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export function startOfLastMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

export function startOfLastSixMonths() {
  return addMonths(new Date(), -6);
}

export function startOfYear() {
  return new Date(new Date().getFullYear(), 0, 1);
}

export function resolveWindow(dateStr) {
  if (!dateStr) return 'no_date';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = parse(dateStr);
  const todayMs = today.getTime();
  const targetMs = target.getTime();
  if (targetMs === todayMs) return 'today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (targetMs === yesterday.getTime()) return 'yesterday';
  const monday = mondayOf(today);
  if (targetMs >= monday.getTime() && targetMs < todayMs) return 'this_week';
  const lastMonday = new Date(monday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  if (targetMs >= lastMonday.getTime() && targetMs < monday.getTime()) return 'last_week';
  const firstMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  if (targetMs >= firstMonth.getTime() && targetMs < monday.getTime()) return 'this_month';
  const firstLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  if (targetMs >= firstLastMonth.getTime() && targetMs < firstMonth.getTime()) return 'last_month';
  const sixMonths = addMonths(today, -6);
  if (targetMs >= sixMonths.getTime() && targetMs < firstLastMonth.getTime()) return 'last_six_months';
  const jan1 = new Date(today.getFullYear(), 0, 1);
  if (targetMs >= jan1.getTime() && targetMs < sixMonths.getTime()) return 'this_year';
  if (targetMs > todayMs) return 'upcoming';
  if (targetMs >= jan1.getTime()) return 'this_year';
  return 'this_year';
}

export function bucketByWindow(items, keyFn) {
  const buckets = {};
  TIME_WINDOWS.forEach((window) => { buckets[window] = []; });
  for (const item of items) {
    const window = resolveWindow(keyFn(item));
    if (buckets[window]) buckets[window].push(item);
  }
  return buckets;
}

export function sortByDate(items, keyFn, descending = false) {
  return [...items].sort((a, b) => {
    const left = keyFn(a) || '';
    const right = keyFn(b) || '';
    return descending ? right.localeCompare(left) : left.localeCompare(right);
  });
}