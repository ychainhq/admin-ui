const SESSION_KEY = 'chain_api_active_tenant';

export function setActiveTenant(id, name) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, name }));
}

export function getActiveTenant() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearActiveTenant() {
  sessionStorage.removeItem(SESSION_KEY);
}
