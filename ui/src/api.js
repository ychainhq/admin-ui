const TENANT_KEY_SESSION = 'chain_api_tenant_key';

export function getActiveTenantKey() {
  return sessionStorage.getItem(TENANT_KEY_SESSION) || null;
}

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

// For /api/* calls — attaches the active tenant key stored in sessionStorage.
function tenantRequest(path, options = {}) {
  const key = getActiveTenantKey();
  return request(path, {
    ...options,
    headers: {
      ...(key ? { 'X-Tenant-Key': key } : {}),
      ...options.headers,
    },
  });
}

export const api = {
  getConfig: () =>
    request('/config'),

  getTenants: ({ limit = 20, cursor } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return request(`/admin-api/tenants?${params}`);
  },

  getTenant: (id) =>
    request(`/admin-api/tenants/${encodeURIComponent(id)}`),

  createTenant: (data) =>
    request('/admin-api/tenants', { method: 'POST', body: JSON.stringify(data) }),

  getTenantConfig: async (id) => {
    const res = await request(`/admin-api/tenants/${encodeURIComponent(id)}/config`);
    return res.data ?? res;
  },

  saveTenantConfig: (id, config) =>
    request(`/admin-api/tenants/${encodeURIComponent(id)}/config`, {
      method: 'PATCH',
      body: JSON.stringify(config),
    }),

  switchTenant: async (tenantId) => {
    const data = await request('/switch-tenant', { method: 'POST', body: JSON.stringify({ tenantId }) });
    if (data.key) sessionStorage.setItem(TENANT_KEY_SESSION, data.key);
    return data;
  },

  // tenantRequest is exposed so future views can call /api/* with the active tenant key.
  tenantRequest,
};
