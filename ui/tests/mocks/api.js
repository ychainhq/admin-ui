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
    // Customer API
    getCustomers: jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } }),
    getCustomer: jest.fn().mockResolvedValue({ customerId: 'cust_test', reference: 'ref-1', status: 'active', createdAt: '2026-01-01T00:00:00Z' }),
    createCustomer: jest.fn().mockResolvedValue({ customerId: 'cust_new' }),
    disableCustomer: jest.fn().mockResolvedValue({ customerId: 'cust_test', status: 'disabled' }),
    getCustomerProfile: jest.fn().mockResolvedValue(null),
    upsertCustomerProfile: jest.fn().mockResolvedValue({}),
    getCustomerIdentifiers: jest.fn().mockResolvedValue({ data: [] }),
    addCustomerIdentifier: jest.fn().mockResolvedValue({}),
    getCustomerContact: jest.fn().mockResolvedValue(null),
    upsertCustomerContact: jest.fn().mockResolvedValue({}),
    getCustomerAmlKyc: jest.fn().mockResolvedValue(null),
    getCustomerRelationships: jest.fn().mockResolvedValue({ data: [] }),
    getCustomerDocuments: jest.fn().mockResolvedValue({ data: [] }),
    addCustomerDocument: jest.fn().mockResolvedValue({}),
    getCustomerDataGovernance: jest.fn().mockResolvedValue(null),
    getCustomerBalances: jest.fn().mockResolvedValue({ customerId: 'cust_test', balances: [] }),
    getCustomerDeposits: jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } }),
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
