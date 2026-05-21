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

  rpc: (method, params = [], opts = {}) => {
    const body = { method, params: params ?? [] };
    if (opts?.wallet) body.wallet = opts.wallet;
    if (opts?.useWallet) body.useWallet = true;
    return request('/rpc', { method: 'POST', body: JSON.stringify(body) });
  },

  // --- Customer API (tenant-scoped, /api/* → /v1/*) ---

  getCustomers: ({ limit = 20, cursor, status } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (status) params.set('status', status);
    return tenantRequest(`/api/customers?${params}`);
  },

  getCustomer: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}`),

  createCustomer: (data) =>
    tenantRequest('/api/customers', { method: 'POST', body: JSON.stringify(data) }),

  disableCustomer: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/disable`, { method: 'POST' }),

  getCustomerProfile: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/profile`),

  getCustomerIdentifiers: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/identifiers`),

  getCustomerContact: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/contact`),

  getCustomerAmlKyc: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/aml-kyc`),

  getCustomerRelationships: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/relationships`),

  getCustomerDocuments: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/documents`),

  getCustomerDataGovernance: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/data-governance`),

  getCustomerBalances: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/balances`),

  getCustomerDeposits: (id, { limit = 20, cursor } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return tenantRequest(`/api/customers/${encodeURIComponent(id)}/deposits?${params}`);
  },

  // tenantRequest is exposed so future views can call /api/* with the active tenant key.
  tenantRequest,
};
