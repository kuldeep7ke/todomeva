const PROFILE_KEY = 'todoMeva_profile';

export function getProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveProfile(profile) {
  const next = { ...getProfile(), ...profile, updatedAt: new Date().toISOString() };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  return next;
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY);
}