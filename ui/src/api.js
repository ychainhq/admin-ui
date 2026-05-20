async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.clone().json();
      message = body?.error?.message || body?.message || message;
    } catch { /* ignore parse errors */ }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  getConfig: () =>
    request('/config'),

  getTenants: ({ search = '', page = 1 } = {}) =>
    request(`/admin-api/tenants?${new URLSearchParams({ search, page: String(page) })}`),

  getTenant: (id) =>
    request(`/admin-api/tenants/${encodeURIComponent(id)}`),

  createTenant: (data) =>
    request('/admin-api/tenants', { method: 'POST', body: JSON.stringify(data) }),

  getTenantConfig: (id) =>
    request(`/admin-api/tenants/${encodeURIComponent(id)}/config`),

  saveTenantConfig: (id, config) =>
    request(`/admin-api/tenants/${encodeURIComponent(id)}/config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    }),

  switchTenant: (tenantId) =>
    request('/switch-tenant', { method: 'POST', body: JSON.stringify({ tenantId }) }),
};
