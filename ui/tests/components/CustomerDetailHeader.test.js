import { createCustomerDetailHeaderController } from '../../src/components/CustomerDetailHeader.js';
import { makeRouter } from '../mocks/api.js';

const CUSTOMER = {
  customerId: 'cust_abc',
  reference:  'ref-x',
  status:     'active',
  createdAt:  '2026-03-10T12:00:00Z',
};

function makeCtrl({ activeTab = 'profile', onDisable } = {}) {
  return createCustomerDetailHeaderController({
    customerId: 'cust_abc',
    activeTab,
    router: makeRouter(),
    onDisable,
  });
}

describe('createCustomerDetailHeaderController — initial state', () => {
  test('starts in loading state', () => {
    expect(makeCtrl().loading).toBe(true);
  });

  test('holds customerId from constructor', () => {
    expect(makeCtrl().customerId).toBe('cust_abc');
  });

  test('produces 5 tabs', () => {
    expect(makeCtrl().tabs).toHaveLength(5);
  });

  test('tabs have correct keys', () => {
    const keys = makeCtrl().tabs.map(t => t.key);
    expect(keys).toEqual(['profile', 'compliance', 'governance', 'balances', 'deposits']);
  });

  test('active tab receives active CSS class', () => {
    const ctrl = makeCtrl({ activeTab: 'compliance' });
    const comp = ctrl.tabs.find(t => t.key === 'compliance');
    expect(comp.tabClass).toContain('border-secondary');
  });

  test('inactive tabs do not receive active CSS class', () => {
    const ctrl = makeCtrl({ activeTab: 'profile' });
    ctrl.tabs.filter(t => t.key !== 'profile').forEach(t => {
      expect(t.tabClass).not.toContain('border-secondary');
    });
  });

  test('each tab has a navigate function', () => {
    makeCtrl().tabs.forEach(t => expect(typeof t.navigate).toBe('function'));
  });

  test('tab.navigate calls router.navigate with correct route', () => {
    const router = makeRouter();
    const ctrl = createCustomerDetailHeaderController({ customerId: 'cust_abc', activeTab: 'profile', router });
    const balancesTab = ctrl.tabs.find(t => t.key === 'balances');
    balancesTab.navigate({ preventDefault: jest.fn() });
    expect(router.navigate).toHaveBeenCalledWith('#/customers/cust_abc/balances');
  });

  test('canDisable starts false (loading, no customer)', () => {
    expect(makeCtrl().canDisable).toBe(false);
  });
});

describe('createCustomerDetailHeaderController — setCustomer()', () => {
  test('sets loading to false', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer(CUSTOMER);
    expect(ctrl.loading).toBe(false);
  });

  test('sets reference and hasReference=true', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer(CUSTOMER);
    expect(ctrl.reference).toBe('ref-x');
    expect(ctrl.hasReference).toBe(true);
  });

  test('hasReference is false when no reference', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer({ ...CUSTOMER, reference: undefined });
    expect(ctrl.hasReference).toBe(false);
  });

  test('statusLabel is uppercase', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer(CUSTOMER);
    expect(ctrl.statusLabel).toBe('ACTIVE');
  });

  test('statusBadgeClass contains tertiary for active', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer(CUSTOMER);
    expect(ctrl.statusBadgeClass).toContain('tertiary');
  });

  test('statusBadgeClass contains error for disabled', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer({ ...CUSTOMER, status: 'disabled' });
    expect(ctrl.statusBadgeClass).toContain('error');
  });

  test('createdAtLabel formats date', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer(CUSTOMER);
    expect(ctrl.createdAtLabel).toBe('2026-03-10');
  });

  test('createdAtLabel handles created_at snake_case', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer({ customerId: 'c1', status: 'active', created_at: '2025-11-01T00:00:00Z' });
    expect(ctrl.createdAtLabel).toBe('2025-11-01');
  });

  test('canDisable is true for active customer', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer(CUSTOMER);
    expect(ctrl.canDisable).toBe(true);
  });

  test('canDisable is false for disabled customer', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer({ ...CUSTOMER, status: 'disabled' });
    expect(ctrl.canDisable).toBe(false);
  });

  test('canDisable is false for frozen customer', () => {
    const ctrl = makeCtrl();
    ctrl.setCustomer({ ...CUSTOMER, status: 'frozen' });
    expect(ctrl.canDisable).toBe(false);
  });
});

describe('createCustomerDetailHeaderController — onDisable callback', () => {
  test('onDisable calls the provided callback', () => {
    const cb = jest.fn();
    const ctrl = makeCtrl({ onDisable: cb });
    ctrl.onDisable();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('onDisable does not throw when no callback provided', () => {
    const ctrl = makeCtrl();
    expect(() => ctrl.onDisable()).not.toThrow();
  });
});
