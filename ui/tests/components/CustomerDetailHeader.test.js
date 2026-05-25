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

  test('produces 6 tabs', () => {
    expect(makeCtrl().tabs).toHaveLength(6);
  });

  test('tabs have correct keys', () => {
    const keys = makeCtrl().tabs.map(t => t.key);
    expect(keys).toEqual(['profile', 'compliance', 'governance', 'balances', 'deposits', 'withdrawals']);
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

describe('createCustomerDetailHeaderController — setProfile()', () => {
  test('sets fullName from given + family name', () => {
    const ctrl = makeCtrl();
    ctrl.setProfile({ given_name: 'Jan', family_name: 'Kowalski' });
    expect(ctrl.fullName).toBe('Jan Kowalski');
    expect(ctrl.hasFullName).toBe(true);
  });

  test('includes middle name when present', () => {
    const ctrl = makeCtrl();
    ctrl.setProfile({ given_name: 'Jan', middle_name: 'Adam', family_name: 'Kowalski' });
    expect(ctrl.fullName).toBe('Jan Adam Kowalski');
  });

  test('skips null middle name', () => {
    const ctrl = makeCtrl();
    ctrl.setProfile({ given_name: 'Jan', middle_name: null, family_name: 'Kowalski' });
    expect(ctrl.fullName).toBe('Jan Kowalski');
  });

  test('hasFullName=false when profileData is null', () => {
    const ctrl = makeCtrl();
    ctrl.setProfile(null);
    expect(ctrl.hasFullName).toBe(false);
  });

  test('hasFullName=false when no name fields', () => {
    const ctrl = makeCtrl();
    ctrl.setProfile({});
    expect(ctrl.hasFullName).toBe(false);
  });
});

describe('createCustomerDetailHeaderController — setContact()', () => {
  test('sets city from primary address', () => {
    const ctrl = makeCtrl();
    ctrl.setContact({ addresses: [{ city: 'Warszawa', is_primary: true }] });
    expect(ctrl.city).toBe('Warszawa');
    expect(ctrl.hasCity).toBe(true);
  });

  test('falls back to first address when none is primary', () => {
    const ctrl = makeCtrl();
    ctrl.setContact({ addresses: [{ city: 'Kraków', is_primary: false }] });
    expect(ctrl.city).toBe('Kraków');
  });

  test('hasCity=false when contactData is null', () => {
    const ctrl = makeCtrl();
    ctrl.setContact(null);
    expect(ctrl.hasCity).toBe(false);
  });

  test('hasCity=false when addresses empty', () => {
    const ctrl = makeCtrl();
    ctrl.setContact({ addresses: [] });
    expect(ctrl.hasCity).toBe(false);
  });

  test('hasCity=false when address has no city', () => {
    const ctrl = makeCtrl();
    ctrl.setContact({ addresses: [{ city: '', is_primary: true }] });
    expect(ctrl.hasCity).toBe(false);
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
