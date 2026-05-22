import { createController } from '../../src/views/CustomerListView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const CUSTOMERS = [
  { customerId: 'cust_1', reference: 'ref-1', status: 'active',   createdAt: '2026-01-01T00:00:00Z' },
  { customerId: 'cust_2', reference: 'ref-2', status: 'disabled', createdAt: '2026-02-01T00:00:00Z' },
  { customerId: 'cust_3', reference: '',      status: 'frozen',   createdAt: '2026-03-01T00:00:00Z' },
];
const PAGE = { data: CUSTOMERS, pagination: { nextCursor: null } };

function setup(apiOverrides = {}, sessionKey = 'test-key') {
  if (sessionKey) sessionStorage.setItem('chain_api_tenant_key', sessionKey);
  else sessionStorage.removeItem('chain_api_tenant_key');
  const api = makeMockApi({ getCustomers: jest.fn().mockResolvedValue(PAGE), ...apiOverrides });
  const router = makeRouter();
  const ctrl = createController({ api, router });
  return { ctrl, api, router };
}

afterEach(() => sessionStorage.clear());

describe('CustomerListView — createController', () => {

  // --- initial state ---

  test('initial state: loading false, customers empty, no error', () => {
    const { ctrl } = setup();
    expect(ctrl.loading).toBe(false);
    expect(ctrl.customers).toHaveLength(0);
    expect(ctrl.error).toBeNull();
  });

  test('initial state: hasSearched is false', () => {
    const { ctrl } = setup();
    expect(ctrl.hasSearched).toBe(false);
  });

  test('noActiveTenant is false when tenant key is set', () => {
    const { ctrl } = setup();
    expect(ctrl.noActiveTenant).toBe(false);
  });

  test('noActiveTenant is true when no tenant key', () => {
    const { ctrl } = setup({}, null);
    expect(ctrl.noActiveTenant).toBe(true);
  });

  // --- searchForm component is wired ---

  test('searchForm is attached to scope', () => {
    const { ctrl } = setup();
    expect(ctrl.searchForm).toBeDefined();
    expect(typeof ctrl.searchForm.onSearch).toBe('function');
    expect(typeof ctrl.searchForm.onClear).toBe('function');
  });

  // --- init: NO auto-load ---

  test('init() does NOT call load regardless of tenant state', async () => {
    const { ctrl, api } = setup();
    await ctrl.init();
    expect(api.getCustomers).not.toHaveBeenCalled();
  });

  test('init() does not call load when noActiveTenant', async () => {
    const { ctrl, api } = setup({}, null);
    await ctrl.init();
    expect(api.getCustomers).not.toHaveBeenCalled();
  });

  // --- searchForm.onSearch triggers view load ---

  test('searchForm.onSearch sets hasSearched to true', () => {
    const { ctrl } = setup();
    ctrl.searchForm.onSearch({ preventDefault: jest.fn() });
    expect(ctrl.hasSearched).toBe(true);
  });

  test('searchForm.onSearch calls getCustomers', async () => {
    const getCustomers = jest.fn().mockResolvedValue(PAGE);
    const { ctrl } = setup({ getCustomers });
    ctrl.searchForm.onSearch({ preventDefault: jest.fn() });
    await Promise.resolve();
    expect(getCustomers).toHaveBeenCalledTimes(1);
  });

  test('searchForm.onSearch passes filters to getCustomers', async () => {
    const getCustomers = jest.fn().mockResolvedValue(PAGE);
    const { ctrl } = setup({ getCustomers });
    ctrl.searchForm.onFormInput({ target: { name: 'reference', value: 'REF-001' } });
    ctrl.searchForm.onFormInput({ target: { name: 'status', value: 'active' } });
    ctrl.searchForm.onSearch({ preventDefault: jest.fn() });
    await Promise.resolve();
    expect(getCustomers).toHaveBeenCalledWith(expect.objectContaining({
      reference: 'REF-001',
      status: 'active',
    }));
  });

  test('second searchForm.onSearch resets cursor and prevCursors', async () => {
    const getCustomers = jest.fn().mockResolvedValue({ data: CUSTOMERS, pagination: { nextCursor: 'next_abc' } });
    const { ctrl } = setup({ getCustomers });
    ctrl.searchForm.onSearch({ preventDefault: jest.fn() });
    await Promise.resolve();
    ctrl._cursor = 'next_abc';
    ctrl._prevCursors = ['prev_1'];
    ctrl.searchForm.onSearch({ preventDefault: jest.fn() });
    expect(ctrl._cursor).toBeUndefined();
    expect(ctrl._prevCursors).toHaveLength(0);
  });

  // --- searchForm.onClear ---

  test('searchForm.onClear resets hasSearched to false', async () => {
    const { ctrl } = setup();
    ctrl.searchForm.onSearch({ preventDefault: jest.fn() });
    await Promise.resolve();
    ctrl.searchForm.onClear({ preventDefault: jest.fn() });
    expect(ctrl.hasSearched).toBe(false);
  });

  test('searchForm.onClear empties customers', async () => {
    const { ctrl } = setup();
    ctrl.searchForm.onSearch({ preventDefault: jest.fn() });
    await Promise.resolve();
    ctrl.searchForm.onClear({ preventDefault: jest.fn() });
    expect(ctrl.customers).toHaveLength(0);
  });

  test('searchForm.onClear does NOT call getCustomers', () => {
    const getCustomers = jest.fn().mockResolvedValue(PAGE);
    const { ctrl } = setup({ getCustomers });
    ctrl.searchForm.onClear({ preventDefault: jest.fn() });
    expect(getCustomers).not.toHaveBeenCalled();
  });

  // --- load ---

  test('load() populates customers', async () => {
    const { ctrl } = setup();
    ctrl.hasSearched = true;
    await ctrl.load();
    expect(ctrl.customers).toHaveLength(3);
  });

  test('load() sets isEmpty when no results', async () => {
    const { ctrl } = setup({ getCustomers: jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } }) });
    ctrl.hasSearched = true;
    await ctrl.load();
    expect(ctrl.isEmpty).toBe(true);
  });

  test('load() clears isEmpty on successful load with data', async () => {
    const { ctrl } = setup();
    ctrl.hasSearched = true;
    await ctrl.load();
    expect(ctrl.isEmpty).toBe(false);
  });

  test('load() sets error on API failure', async () => {
    const { ctrl } = setup({ getCustomers: jest.fn().mockRejectedValue(new Error('Network error')) });
    await ctrl.load();
    expect(ctrl.error).toBe('Network error');
    expect(ctrl.loading).toBe(false);
  });

  test('load() clears error on retry', async () => {
    const getCustomers = jest.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(PAGE);
    const { ctrl } = setup({ getCustomers });
    await ctrl.load();
    expect(ctrl.error).toBe('fail');
    await ctrl.load();
    expect(ctrl.error).toBeNull();
  });

  test('loading is false after successful load', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('loading is false after failed load', async () => {
    const { ctrl } = setup({ getCustomers: jest.fn().mockRejectedValue(new Error('x')) });
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  // --- customer view models ---

  test('customers are mapped to view models with statusLabel', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.customers[0].statusLabel).toBe('ACTIVE');
    expect(ctrl.customers[1].statusLabel).toBe('DISABLED');
  });

  test('customer view model has view function', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(typeof ctrl.customers[0].view).toBe('function');
  });

  test('customer.view() navigates to profile sub-route', async () => {
    const { ctrl, router } = setup();
    await ctrl.load();
    ctrl.customers[0].view();
    expect(router.navigate).toHaveBeenCalledWith('#/customers/cust_1/profile');
  });

  // --- navigation ---

  test('createCustomer() navigates to /customers/new', () => {
    const { ctrl, router } = setup();
    ctrl.createCustomer();
    expect(router.navigate).toHaveBeenCalledWith('#/customers/new');
  });

  test('goToTenants() navigates to /tenants', () => {
    const { ctrl, router } = setup();
    ctrl.goToTenants();
    expect(router.navigate).toHaveBeenCalledWith('#/tenants');
  });

  // --- pagination ---

  test('pagination is updated after load', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.pagination).toBeDefined();
    expect(ctrl.pagination.showingText).toContain('3');
  });

  test('next page uses nextCursor and keeps active filters', async () => {
    const getCustomers = jest.fn()
      .mockResolvedValueOnce({ data: CUSTOMERS, pagination: { nextCursor: 'next_abc' } })
      .mockResolvedValueOnce({ data: [], pagination: { nextCursor: null } });
    const { ctrl } = setup({ getCustomers });
    ctrl.searchForm.onFormInput({ target: { name: 'status', value: 'active' } });
    ctrl.searchForm.onSearch({ preventDefault: jest.fn() });
    await Promise.resolve();
    ctrl.pagination.pages.find(p => p.label === '2')?.go();
    await Promise.resolve();
    expect(getCustomers).toHaveBeenLastCalledWith(expect.objectContaining({
      cursor: 'next_abc',
      status: 'active',
    }));
  });

  // --- layout helpers ---

  test('sidebar has Customers nav item active', () => {
    const { ctrl } = setup();
    const item = ctrl.sidebar.navItems.find(i => i.label === 'Customers');
    expect(item).toBeDefined();
    expect(item.showActive).toBe(true);
  });

  test('bottomNav has Customers item active', () => {
    const { ctrl } = setup();
    const item = ctrl.bottomNav.items.find(i => i.label === 'Customers');
    expect(item).toBeDefined();
    expect(item.itemClass).toContain('secondary');
  });
});
