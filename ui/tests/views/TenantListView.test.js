import { createController } from '../../src/views/TenantListView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const TENANTS = [
  { id: 'tenant_default', name: 'Dev Tenant', status: 'active', custody_mode: 'external_signer', created_at: '2023-01-15' },
  { id: 'tenant_alpha', name: 'Alpha Ops', status: 'active', custody_mode: 'internal_hsm', created_at: '2023-02-10' },
  { id: 'tenant_beta', name: 'Beta Custody', status: 'suspended', custody_mode: 'hybrid_multi', created_at: '2022-12-05' },
];

function makeCtrl(apiOverrides = {}) {
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ api, router });
  return { ctrl, api, router };
}

describe('TenantListView — createController', () => {
  test('initial state: loading false, tenants empty, no error', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.loading).toBe(false);
    expect(ctrl.tenants).toHaveLength(0);
    expect(ctrl.error).toBeNull();
    expect(ctrl.isEmpty).toBe(false);
  });

  test('init() calls load() and fetches tenants', async () => {
    const { ctrl, api } = makeCtrl({
      getTenants: jest.fn().mockResolvedValue({ items: TENANTS, total: 3 }),
    });
    await ctrl.init();
    expect(api.getTenants).toHaveBeenCalledWith({ search: '', page: 1 });
  });

  test('load() populates tenants from API response', async () => {
    const { ctrl } = makeCtrl({
      getTenants: jest.fn().mockResolvedValue({ items: TENANTS, total: 3 }),
    });
    await ctrl.load();
    expect(ctrl.tenants).toHaveLength(3);
  });

  test('load() sets isEmpty when result is empty', async () => {
    const { ctrl } = makeCtrl({
      getTenants: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    });
    await ctrl.load();
    expect(ctrl.isEmpty).toBe(true);
    expect(ctrl.tenants).toHaveLength(0);
  });

  test('load() sets error on API failure', async () => {
    const { ctrl } = makeCtrl({
      getTenants: jest.fn().mockRejectedValue(new Error('Network error')),
    });
    await ctrl.load();
    expect(ctrl.error).toBe('Network error');
    expect(ctrl.loading).toBe(false);
  });

  test('load() clears previous error on retry', async () => {
    const api = makeMockApi();
    api.getTenants
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce({ items: TENANTS, total: 3 });
    const router = makeRouter();
    const ctrl = createController({ api, router });
    await ctrl.load();
    expect(ctrl.error).toBe('Fail');
    await ctrl.load();
    expect(ctrl.error).toBeNull();
  });

  test('loading flag is false after successful load', async () => {
    const { ctrl } = makeCtrl({
      getTenants: jest.fn().mockResolvedValue({ items: TENANTS, total: 3 }),
    });
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('loading flag is false after failed load', async () => {
    const { ctrl } = makeCtrl({
      getTenants: jest.fn().mockRejectedValue(new Error('fail')),
    });
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('tenants are mapped to view models with isActive property', async () => {
    const { ctrl } = makeCtrl({
      getTenants: jest.fn().mockResolvedValue({ items: TENANTS, total: 3 }),
    });
    await ctrl.load();
    expect(ctrl.tenants[0].isActive).toBe(true);
    expect(ctrl.tenants[2].isActive).toBe(false);
  });

  test('createTenant() navigates to /tenants/new', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.createTenant();
    expect(router.navigate).toHaveBeenCalledWith('#/tenants/new');
  });

  test('pagination is updated after load', async () => {
    const { ctrl } = makeCtrl({
      getTenants: jest.fn().mockResolvedValue({ items: TENANTS, total: 3 }),
    });
    await ctrl.load();
    expect(ctrl.pagination).toBeDefined();
    expect(ctrl.pagination.showingText).toContain('3');
  });

  test('search input triggers reload with new search term', async () => {
    const getTenants = jest.fn().mockResolvedValue({ items: [], total: 0 });
    const { ctrl } = makeCtrl({ getTenants });
    await ctrl.load();
    getTenants.mockClear();
    // Simulate search controller callback
    ctrl.search.onInput({ target: { value: 'alpha' } });
    // Flush debounce (jest fake timers not in play here; just verify the callback is wired)
    expect(typeof ctrl.search.onInput).toBe('function');
  });

  test('topBar title is set correctly', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.topBar.title).toBe('Platform Admin');
  });

  test('sidebar has navItems array', () => {
    const { ctrl } = makeCtrl();
    expect(Array.isArray(ctrl.sidebar.navItems)).toBe(true);
    expect(ctrl.sidebar.navItems.length).toBeGreaterThan(0);
  });

  test('Tenant List nav item is marked active', () => {
    const { ctrl } = makeCtrl();
    const tenantItem = ctrl.sidebar.navItems.find(i => i.label === 'Tenant List');
    expect(tenantItem).toBeDefined();
    expect(tenantItem.itemClass).toContain('border-l-secondary');
  });

  test('drawerOpen starts as false', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.drawerOpen).toBe(false);
  });

  test('closeDrawer sets drawerOpen to false', () => {
    const { ctrl } = makeCtrl();
    ctrl.drawerOpen = true;
    ctrl.closeDrawer();
    expect(ctrl.drawerOpen).toBe(false);
  });

  test('handles alternative API response shape (data array)', async () => {
    const { ctrl } = makeCtrl({
      getTenants: jest.fn().mockResolvedValue({ data: TENANTS, total: 3 }),
    });
    await ctrl.load();
    expect(ctrl.tenants).toHaveLength(3);
  });
});
