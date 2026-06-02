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
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    // 401 on a tenant API call means the stored key is stale (e.g. after server reset).
    // Clear it so the next tenantRequest() uses the proxy's default key instead,
    // and surface a clear error message so the user knows to re-select their tenant.
    if (res.status === 401 && path.startsWith('/api/')) {
      const staleKey = sessionStorage.getItem(TENANT_KEY_SESSION);
      if (staleKey) {
        sessionStorage.removeItem(TENANT_KEY_SESSION);
        console.warn('[api] Tenant key expired or revoked — cleared from sessionStorage. Re-select tenant.');
      }
    }

    let message = `HTTP ${res.status}`;
    try {
      const body = await res.clone().json();
      const detail = body?.error?.message || body?.message;
      if (detail) message = `${message}: ${detail}`;
    } catch { /* ignore parse errors */ }

    // Provide actionable message only for tenant API auth failures
    if (res.status === 401 && path.startsWith('/api/')) {
      throw new Error('Session expired — please re-select your tenant from the Tenants list.');
    }
    throw new Error(message);
  }
  return res.json();
}

// For /api/* calls — attaches the active tenant key stored in sessionStorage.
// Falls back to the proxy's default key (CHAIN_API_KEY env var) when sessionStorage is empty.
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

  // rpc: route to a specific BTC node (v3) or default node (v2).
  // opts.nodeId: 'btc-node-1' | 'btc-node-2' (v3 only)
  rpc: (method, params = [], opts = {}) => {
    const body = { method, params: params ?? [] };
    if (opts?.wallet)   body.wallet = opts.wallet;
    if (opts?.useWallet) body.useWallet = true;
    if (opts?.nodeId)   body.nodeId = opts.nodeId;
    return request('/rpc', { method: 'POST', body: JSON.stringify(body) });
  },

  // v3: mine blocks on the miner node (btc-node-1)
  mineBlocks: (blocks = 1, address = null) =>
    request('/mining/generate', {
      method: 'POST',
      body: JSON.stringify({ blocks, ...(address ? { address } : {}) }),
    }),

  // --- Customer API (tenant-scoped, /api/* → /v1/*) ---

  getCustomers: ({
    limit = 20, cursor,
    // customers table
    status, party_type, id, reference, display_name, country_of_origin,
    // customer_profiles
    profile_given_name, profile_family_name, profile_middle_name, profile_business_name,
    // customer_contact
    contact_email, contact_phone,
    // customer_identifiers
    identifier_type, identifier_value,
    // customer_relationships external_party
    rel_display_name, rel_identifier_type, rel_identifier_value,
  } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor)               params.set('cursor', cursor);
    if (status)               params.set('status', status);
    if (party_type)           params.set('party_type', party_type);
    if (id)                   params.set('id', id);
    if (reference)            params.set('reference', reference);
    if (display_name)         params.set('display_name', display_name);
    if (country_of_origin)    params.set('country_of_origin', country_of_origin);
    if (profile_given_name)   params.set('profile_given_name', profile_given_name);
    if (profile_family_name)  params.set('profile_family_name', profile_family_name);
    if (profile_middle_name)  params.set('profile_middle_name', profile_middle_name);
    if (profile_business_name)params.set('profile_business_name', profile_business_name);
    if (contact_email)        params.set('contact_email', contact_email);
    if (contact_phone)        params.set('contact_phone', contact_phone);
    if (identifier_type)      params.set('identifier_type', identifier_type);
    if (identifier_value)     params.set('identifier_value', identifier_value);
    if (rel_display_name)     params.set('rel_display_name', rel_display_name);
    if (rel_identifier_type)  params.set('rel_identifier_type', rel_identifier_type);
    if (rel_identifier_value) params.set('rel_identifier_value', rel_identifier_value);
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

  upsertCustomerProfile: async (id, data) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/profile`, { method: 'PUT', body: JSON.stringify(data) });
    return res.data ?? res;
  },

  getCustomerIdentifiers: (id) =>
    tenantRequest(`/api/customers/${encodeURIComponent(id)}/identifiers`),

  addCustomerIdentifier: async (id, data) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/identifiers`, { method: 'POST', body: JSON.stringify(data) });
    return res.data ?? res;
  },

  getCustomerContact: async (id) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/contact`);
    return res.data ?? res;
  },

  upsertCustomerContact: async (id, data) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/contact`, { method: 'PUT', body: JSON.stringify(data) });
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

  addCustomerDocument: async (id, data) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/documents`, { method: 'POST', body: JSON.stringify(data) });
    return res.data ?? res;
  },

  getCustomerDataGovernance: async (id) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(id)}/data-governance`);
    return res.data ?? res;
  },

  getCustomerAddresses: (id, { limit = 50, cursor } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return tenantRequest(`/api/customers/${encodeURIComponent(id)}/addresses?${params}`);
  },

  // Customer Self-Service API — requires session token from createCustomerSession().
  // Signature: (sessionToken, opts) — NOT (customerId, opts).
  // Tenant API must NOT be used for customer data when a /me/* endpoint exists.
  getMyProfile: async (sessionToken) => {
    const res = await request('/customer/me/profile', {
      headers: { 'X-Session-Token': sessionToken },
    });
    return res.data ?? res;
  },

  getMyContact: async (sessionToken) => {
    const res = await request('/customer/me/contact', {
      headers: { 'X-Session-Token': sessionToken },
    });
    return res.data ?? res;
  },

  getMyAddresses: (sessionToken, { limit = 50, cursor } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return request(`/customer/me/addresses?${params}`, {
      headers: { 'X-Session-Token': sessionToken },
    });
  },

  getCustomerBalances: async (sessionToken) => {
    const res = await request('/customer/me/balances', {
      headers: { 'X-Session-Token': sessionToken },
    });
    return res.data ?? res;
  },

  getCustomerDeposits: (sessionToken, {
    limit = 20,
    cursor,
    depositId,
    txHash,
    address,
    assetId,
    status,
    minConfirmations,
    maxConfirmations,
  } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (depositId) params.set('depositId', depositId);
    if (txHash) params.set('txHash', txHash);
    if (address) params.set('address', address);
    if (assetId) params.set('assetId', assetId);
    if (status) params.set('status', status);
    if (minConfirmations !== undefined) params.set('minConfirmations', String(minConfirmations));
    if (maxConfirmations !== undefined) params.set('maxConfirmations', String(maxConfirmations));
    return request(`/customer/me/deposits?${params}`, {
      headers: { 'X-Session-Token': sessionToken },
    });
  },

  createDepositAddress: async (customerId, { chain }) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(customerId)}/deposit-address`, {
      method: 'POST',
      body: JSON.stringify({ chain }),
    });
    return res.data ?? res;
  },

  getDeposits: ({ limit = 20, cursor, status } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (status) params.set('status', status);
    return tenantRequest(`/api/deposits?${params}`);
  },

  createCustomerSession: async (customerId) => {
    const res = await tenantRequest(`/api/customers/${encodeURIComponent(customerId)}/sessions`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    return res.data ?? res;
  },

  createWithdrawalAsCustomer: async (sessionToken, data) => {
    const res = await request('/customer/me/withdrawals', {
      method: 'POST',
      headers: { 'X-Session-Token': sessionToken },
      body: JSON.stringify(data),
    });
    return res.data ?? res;
  },

  getWithdrawalBatches: ({ limit = 20, cursor, status, chainId } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (status) params.set('status', status);
    if (chainId) params.set('chainId', chainId);
    return tenantRequest(`/api/withdrawal-batches?${params}`);
  },

  getWallets: () =>
    tenantRequest('/api/wallets'),

  getWallet: async (id) => {
    const res = await tenantRequest(`/api/wallets/${encodeURIComponent(id)}`);
    return res.data ?? res;
  },

  getWalletAddresses: (walletId, { limit = 20, cursor } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    return tenantRequest(`/api/wallets/${encodeURIComponent(walletId)}/addresses?${params}`);
  },

  getWalletBalances: async (walletId) => {
    const res = await tenantRequest(`/api/wallets/${encodeURIComponent(walletId)}/balances`);
    return res.data ?? res;
  },

  createSweep: async (data) => {
    const res = await tenantRequest('/api/sweeps', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return res.data ?? res;
  },

  getSweepsSummary: async () => {
    const res = await tenantRequest('/api/sweeps/summary');
    return res.data ?? res;
  },

  getSweeps: ({ limit = 20, cursor, status } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (status) params.set('status', status);
    return tenantRequest(`/api/sweeps?${params}`);
  },

  getSweep: async (id) => {
    const res = await tenantRequest(`/api/sweeps/${encodeURIComponent(id)}`);
    return res.data ?? res;
  },

  getSigningTasks: ({ limit = 20, cursor, status, chainId, requestType } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (status) params.set('status', status);
    if (chainId) params.set('chainId', chainId);
    if (requestType) params.set('requestType', requestType);
    return tenantRequest(`/api/signing-tasks?${params}`);
  },

  getExternalSigners: () =>
    tenantRequest('/api/external-signers'),

  approveSigningTask: (taskId) =>
    tenantRequest(`/api/signing-tasks/${encodeURIComponent(taskId)}/approve`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  rejectSigningTask: (taskId, reason) =>
    tenantRequest(`/api/signing-tasks/${encodeURIComponent(taskId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getSignerPolicies: async () => {
    const res = await tenantRequest('/api/external-signers/policies');
    return res.data ?? res;
  },

  saveSignerPolicies: (policies) =>
    tenantRequest('/api/external-signers/policies', {
      method: 'PUT',
      body: JSON.stringify({ policies }),
    }),

  getCustomerWithdrawals: (sessionToken, { limit = 20, cursor, status, toAddress } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set('cursor', cursor);
    if (status) params.set('status', status);
    if (toAddress) params.set('toAddress', toAddress);
    return request(`/customer/me/withdrawals?${params}`, {
      headers: { 'X-Session-Token': sessionToken },
    });
  },

  getBitcoinFees: () =>
    tenantRequest('/api/chains/bitcoin/fees'),

  resolveAddress: async (address) => {
    const params = new URLSearchParams({ address });
    const res = await tenantRequest(`/api/addresses/resolve?${params}`);
    return res.data ?? res;
  },

  resolveAddressAsCustomer: async (sessionToken, address) => {
    const params = new URLSearchParams({ address });
    const res = await request(`/customer/me/addresses/resolve?${params}`, {
      headers: { 'X-Session-Token': sessionToken },
    });
    return res.data ?? res;
  },

  getActiveTenantConfig: async () => {
    const res = await tenantRequest('/api/tenant/config');
    return keysToCamel(res.data ?? res);
  },

  getWithdrawalBatchConfig: async () => {
    const res = await tenantRequest('/api/tenant/withdrawal-batch-config');
    return res.data ?? res;
  },

  getTicklers: ({ limit = 50, cursor, category, subcategory, entity_id, actor_login, from, to } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor)      params.set('cursor', cursor);
    if (category)    params.set('category', category);
    if (subcategory) params.set('subcategory', subcategory);
    if (entity_id)   params.set('entity_id', entity_id);
    if (actor_login) params.set('actor_login', actor_login);
    if (from)        params.set('from', String(from));
    if (to)          params.set('to', String(to));
    return tenantRequest(`/api/ticklers?${params}`);
  },

  // ─── v3: Infrastructure API ──────────────────────────────────────────────────

  // Chain nodes (platform admin) — GET /admin-api/chain-nodes
  getChainNodes: ({ chainId, isEnabled } = {}) => {
    const params = new URLSearchParams();
    if (chainId !== undefined)   params.set('chainId', chainId);
    if (isEnabled !== undefined) params.set('isEnabled', String(isEnabled));
    const qs = params.toString();
    return request(`/admin-api/chain-nodes${qs ? '?' + qs : ''}`);
  },

  getChainNode: (nodeId) =>
    request(`/admin-api/chain-nodes/${encodeURIComponent(nodeId)}`),

  createChainNode: (data) =>
    request('/admin-api/chain-nodes', { method: 'POST', body: JSON.stringify(data) }),

  updateChainNode: (nodeId, data) =>
    request(`/admin-api/chain-nodes/${encodeURIComponent(nodeId)}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }),

  testNodeConnection: (nodeId) =>
    request(`/admin-api/chain-nodes/${encodeURIComponent(nodeId)}/test-connection`, {
      method: 'POST', body: JSON.stringify({}),
    }),

  // Cluster status — GET /admin-api/cluster/status
  getClusterStatus: () =>
    request('/admin-api/cluster/status'),

  // Engine health — GET /engine-health (proxy checks all configured engines)
  getEngineHealth: () =>
    request('/engine-health'),

  // Proxy config — GET /config (returns btcNodes, engineUrls, isV3 flag)
  getProxyConfig: () =>
    request('/config'),

  // tenantRequest is exposed so future views can call /api/* with the active tenant key.
  tenantRequest,
};
