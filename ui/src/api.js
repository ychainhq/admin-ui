const TENANT_KEY_SESSION = 'chain_api_tenant_key';

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function keysToCamel(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [snakeToCamel(k), v]));
}

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
      const detail = body?.error?.message || body?.message;
      if (detail) message = `${message}: ${detail}`;
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
    return keysToCamel(res.data ?? res);
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

  getCustomer: async (id) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}`);
    return res.data ?? res;
  },

  createCustomer: async (data) => {
    const res = await tenantRequest('/api/customers', { method: 'POST', body: JSON.stringify(data) });
    return res.data ?? res;
  },

  disableCustomer: async (id) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/disable`, { method: 'POST' });
    return res.data ?? res;
  },

  getCustomerProfile: async (id) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/profile`);
    return res.data ?? res;
  },

  getCustomerIdentifiers: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/identifiers`),

  getCustomerContact: async (id) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/contact`);
    return res.data ?? res;
  },

  getCustomerAmlKyc: async (id) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/aml-kyc`);
    return res.data ?? res;
  },

  getCustomerRelationships: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/relationships`),

  getCustomerDocuments: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/documents`),

  getCustomerDataGovernance: async (id) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/data-governance`);
    return res.data ?? res;
  },

  getCustomerBalances: async (id) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/balances`);
    return res.data ?? res;
  },

  getCustomerDeposits: (id, { limit = 20, cursor } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return tenantRequest(`/api/customers/${encodeURIComponent(id)}/deposits?${params}`);
  },

  // tenantRequest is exposed so future views can call /api/* with the active tenant key.
  tenantRequest,
};
