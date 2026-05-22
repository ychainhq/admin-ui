import { api, getActiveTenantKey } from '../src/api.js';

// Regression: request() must preserve Content-Type even when options.headers is present.
// Bug: { headers: merged, ...options } — the spread overwrote 'headers' when options had
// its own headers key, dropping Content-Type. Fixed to { ...options, headers: merged }.

function mockFetch(status = 200, body = {}) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    json: jest.fn().mockResolvedValue(body),
    clone: jest.fn().mockReturnThis(),
  };
  global.fetch = jest.fn().mockResolvedValue(response);
  return global.fetch;
}

beforeEach(() => {
  // jsdom provides sessionStorage; clear it before each test
  sessionStorage.clear();
});

describe('api — request header integrity', () => {
  test('createCustomer sends Content-Type: application/json', async () => {
    sessionStorage.setItem('chain_api_tenant_key', 'test-key');
    const fetch = mockFetch(201, { data: { id: 'cust_1' } });

    await api.createCustomer({ reference: 'ref-1', metadata: { plan: 'pro' } });

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });

  test('createCustomer sends the serialized body', async () => {
    sessionStorage.setItem('chain_api_tenant_key', 'test-key');
    const fetch = mockFetch(201, { data: { id: 'cust_1' } });

    await api.createCustomer({ reference: 'ref-1', metadata: { plan: 'pro' } });

    const [, opts] = fetch.mock.calls[0];
    expect(JSON.parse(opts.body)).toEqual({ reference: 'ref-1', metadata: { plan: 'pro' } });
  });

  test('createCustomer sends X-Tenant-Key from sessionStorage', async () => {
    sessionStorage.setItem('chain_api_tenant_key', 'my-tenant-key');
    const fetch = mockFetch(201, { data: { id: 'cust_1' } });

    await api.createCustomer({});

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['X-Tenant-Key']).toBe('my-tenant-key');
  });

  test('Content-Type is present alongside X-Tenant-Key (header merge regression)', async () => {
    // This is the exact scenario that failed: tenantRequest adds options.headers
    // containing X-Tenant-Key, and the old spread order dropped Content-Type.
    sessionStorage.setItem('chain_api_tenant_key', 'tenant-abc');
    const fetch = mockFetch(201, { data: { id: 'cust_1' } });

    await api.createCustomer({ reference: 'ref-3', metadata: { userId: 'ref-3' } });

    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(opts.headers['X-Tenant-Key']).toBe('tenant-abc');
    expect(JSON.parse(opts.body)).toEqual({ reference: 'ref-3', metadata: { userId: 'ref-3' } });
  });

  test('request() without headers option still sends Content-Type', async () => {
    const fetch = mockFetch(200, { data: [] });
    // getCustomers uses tenantRequest without extra headers
    await api.getCustomers().catch(() => {});
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/json');
  });
});
