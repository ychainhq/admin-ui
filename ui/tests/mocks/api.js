export function makeMockApi(overrides = {}) {
  return {
    getConfig: jest.fn().mockResolvedValue({ hasAdminKey: true, hasApiKey: false }),
    getTenants: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getTenant: jest.fn().mockResolvedValue({}),
    createTenant: jest.fn().mockResolvedValue({ id: 'new_tenant' }),
    getTenantConfig: jest.fn().mockResolvedValue({}),
    saveTenantConfig: jest.fn().mockResolvedValue({}),
    switchTenant: jest.fn().mockResolvedValue({ success: true }),
    rpc: jest.fn().mockResolvedValue({ result: null }),
    ...overrides,
  };
}

export function makeRouter() {
  return {
    navigate: jest.fn(),
    on: jest.fn().mockReturnThis(),
    start: jest.fn(),
    stop: jest.fn(),
  };
}
