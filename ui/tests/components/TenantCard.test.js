import { createTenantViewModel } from '../../src/components/TenantCard.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const activeTenant = {
  id: 'tenant_default',
  name: 'Dev Tenant',
  status: 'active',
  custody_mode: 'external_signer',
  created_at: '2023-01-15T00:00:00Z',
};

const suspendedTenant = {
  id: 'tenant_beta',
  name: 'Beta Custody',
  status: 'suspended',
  custody_mode: 'internal_hsm',
  created_at: '2022-12-05',
};

describe('createTenantViewModel', () => {
  let router;
  beforeEach(() => { router = makeRouter(); });

  test('maps basic tenant fields correctly', () => {
    const vm = createTenantViewModel(activeTenant, { router });
    expect(vm.id).toBe('tenant_default');
    expect(vm.name).toBe('Dev Tenant');
    expect(vm.status).toBe('active');
    expect(vm.custodyMode).toBe('external_signer');
    expect(vm.createdAt).toBe('2023-01-15');
  });

  test('active tenant has isActive = true', () => {
    const vm = createTenantViewModel(activeTenant, { router });
    expect(vm.isActive).toBe(true);
  });

  test('suspended tenant has isActive = false', () => {
    const vm = createTenantViewModel(suspendedTenant, { router });
    expect(vm.isActive).toBe(false);
  });

  test('active card has border-l-secondary class', () => {
    const vm = createTenantViewModel(activeTenant, { router });
    expect(vm.cardClass).toContain('border-l-secondary');
    expect(vm.cardClass).toContain('border-l-4');
  });

  test('suspended card has no border-l-secondary class', () => {
    const vm = createTenantViewModel(suspendedTenant, { router });
    expect(vm.cardClass).not.toContain('border-l-secondary');
  });

  test('internal_hsm custody uses key icon', () => {
    const vm = createTenantViewModel(suspendedTenant, { router });
    expect(vm.custodyIcon).toBe('key');
  });

  test('external_signer custody uses security icon', () => {
    const vm = createTenantViewModel(activeTenant, { router });
    expect(vm.custodyIcon).toBe('security');
  });

  test('active tenant has gold work-with button', () => {
    const vm = createTenantViewModel(activeTenant, { router });
    expect(vm.workWithBtnClass).toContain('bg-secondary');
  });

  test('suspended tenant has ghost work-with button', () => {
    const vm = createTenantViewModel(suspendedTenant, { router });
    expect(vm.workWithBtnClass).not.toContain('bg-secondary');
    expect(vm.workWithBtnClass).toContain('border');
  });

  test('viewConfig navigates to config route', () => {
    const vm = createTenantViewModel(activeTenant, { router });
    vm.viewConfig();
    expect(router.navigate).toHaveBeenCalledWith('#/tenants/tenant_default/config');
  });

  test('workWith switches tenant and does not navigate', async () => {
    const api = makeMockApi();
    const vm = createTenantViewModel(activeTenant, { router, api });
    await vm.workWith();
    expect(api.switchTenant).toHaveBeenCalledWith('tenant_default');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  test('workWith stores active tenant in localStorage', async () => {
    localStorage.clear();
    const api = makeMockApi();
    const vm = createTenantViewModel(activeTenant, { router, api });
    await vm.workWith();
    const stored = JSON.parse(localStorage.getItem('chain_api_active_tenant'));
    expect(stored.id).toBe('tenant_default');
    expect(stored.name).toBe('Dev Tenant');
  });

  test('workWith calls onTenantSelected with id and name', async () => {
    const api = makeMockApi();
    const onTenantSelected = jest.fn();
    const vm = createTenantViewModel(activeTenant, { router, api, onTenantSelected });
    await vm.workWith();
    expect(onTenantSelected).toHaveBeenCalledWith('tenant_default', 'Dev Tenant');
  });

  test('workWith works without onTenantSelected (optional)', async () => {
    const api = makeMockApi();
    const vm = createTenantViewModel(activeTenant, { router, api });
    await expect(vm.workWith()).resolves.toBeUndefined();
  });

  test('falls back when created_at is missing', () => {
    const vm = createTenantViewModel({ ...activeTenant, created_at: undefined, createdAt: '2024-06-01' }, { router });
    expect(vm.createdAt).toBe('2024-06-01');
  });

  test('all required vm properties are present', () => {
    const vm = createTenantViewModel(activeTenant, { router });
    ['id', 'name', 'status', 'custodyMode', 'custodyIcon', 'createdAt', 'isActive',
     'cardClass', 'workWithBtnClass', 'viewConfig', 'workWith'].forEach(prop => {
      expect(vm).toHaveProperty(prop);
    });
  });
});
