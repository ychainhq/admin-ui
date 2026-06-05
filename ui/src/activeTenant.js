const STORAGE_KEY = 'chain_api_active_tenant';

export function setActiveTenant(id, name) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, name }));
}

export function getActiveTenant() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearActiveTenant() {
  localStorage.removeItem(STORAGE_KEY);
}
