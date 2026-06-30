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

describe('api — customer write wrappers', () => {
  beforeEach(() => {
    sessionStorage.setItem('chain_api_tenant_key', 'tk');
  });

  test('upsertCustomerProfile sends PUT to /api/customers/:id/profile', async () => {
    const fetch = mockFetch(200, { data: { id: 'cust_1' } });
    const payload = { partyType: 'natural_person', person_type: 'individual', given_name: 'Jan', family_name: 'Kowalski' };
    await api.upsertCustomerProfile('cust_1', payload);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/api/customers/cust_1/profile');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual(payload);
  });

  test('addCustomerIdentifier sends POST to /api/customers/:id/identifiers', async () => {
    const fetch = mockFetch(201, { data: { id: 'ident_1' } });
    const payload = { type: 'passport', value: 'AB123456' };
    await api.addCustomerIdentifier('cust_1', payload);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/api/customers/cust_1/identifiers');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(payload);
  });

  test('addCustomerDocument sends POST to /api/customers/:id/documents', async () => {
    const fetch = mockFetch(201, { data: { id: 'doc_1' } });
    const payload = { document_type: 'passport', storage_ref: 'ref', storage_system: 'manual' };
    await api.addCustomerDocument('cust_1', payload);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/api/customers/cust_1/documents');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual(payload);
  });

  test('upsertCustomerContact sends PUT to /api/customers/:id/contact', async () => {
    const fetch = mockFetch(200, { data: {} });
    const payload = { addresses: [{ type: 'registered', line1: 'ul. Testowa 1', city: 'Warszawa', country: 'PL', is_primary: true }] };
    await api.upsertCustomerContact('cust_1', payload);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('/api/customers/cust_1/contact');
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual(payload);
  });

  test('upsertCustomerProfile returns res.data', async () => {
    mockFetch(200, { data: { partyType: 'natural_person' } });
    const result = await api.upsertCustomerProfile('cust_1', {});
    expect(result).toEqual({ partyType: 'natural_person' });
  });

  test('createDepositAddress sends chain as URL query param, not body', async () => {
    const fetch = mockFetch(201, { data: { address: 'TAbc123', chain: 'tron' } });
    await api.createDepositAddress('cust_1', { chain: 'tron' });
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toContain('?chain=tron');
    expect(url).toContain('/api/customers/cust_1/deposit-address');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeUndefined();
  });

  test('createDepositAddress defaults chain to bitcoin', async () => {
    const fetch = mockFetch(201, { data: { address: 'bc1qabc', chain: 'bitcoin' } });
    await api.createDepositAddress('cust_1', {});
    const [url] = fetch.mock.calls[0];
    expect(url).toContain('?chain=bitcoin');
  });
});
