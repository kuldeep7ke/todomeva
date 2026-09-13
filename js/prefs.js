const PREFS_KEY = 'todoMeva_notify_prefs';

const DEFAULTS = { reminders: true, onboarding: true };

export function getNotifyPrefs() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(PREFS_KEY)) || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function isPrefEnabled(key) {
  return getNotifyPrefs()[key] !== false;
}

export function setPref(key, enabled) {
  const prefs = getNotifyPrefs();
  prefs[key] = Boolean(enabled);
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function resetPrefs() {
  localStorage.removeItem(PREFS_KEY);
}