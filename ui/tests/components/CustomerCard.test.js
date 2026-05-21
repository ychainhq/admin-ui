import { createCustomerViewModel, customerStatusBadgeClass, CUSTOMER_STATUS_BADGE } from '../../src/components/CustomerCard.js';
import { makeRouter } from '../mocks/api.js';

const RAW = {
  customerId: 'cust_abc123',
  reference:  'user-abc',
  status:     'active',
  createdAt:  '2026-01-15T10:00:00Z',
};

function makeVM(overrides = {}) {
  return createCustomerViewModel({ ...RAW, ...overrides }, { router: makeRouter() });
}

describe('createCustomerViewModel', () => {
  test('maps customerId from raw.customerId', () => {
    expect(makeVM().customerId).toBe('cust_abc123');
  });

  test('falls back to raw.id when customerId absent', () => {
    const vm = createCustomerViewModel({ id: 'cust_fallback', status: 'active' }, { router: makeRouter() });
    expect(vm.customerId).toBe('cust_fallback');
  });

  test('returns — when no id field present', () => {
    const vm = createCustomerViewModel({ status: 'active' }, { router: makeRouter() });
    expect(vm.customerId).toBe('—');
  });

  test('maps reference and sets hasReference=true', () => {
    const vm = makeVM();
    expect(vm.reference).toBe('user-abc');
    expect(vm.hasReference).toBe(true);
  });

  test('hasReference is false when reference absent', () => {
    const vm = makeVM({ reference: undefined });
    expect(vm.hasReference).toBe(false);
  });

  test('statusLabel is uppercase status', () => {
    expect(makeVM({ status: 'active' }).statusLabel).toBe('ACTIVE');
    expect(makeVM({ status: 'disabled' }).statusLabel).toBe('DISABLED');
    expect(makeVM({ status: 'frozen' }).statusLabel).toBe('FROZEN');
  });

  test('statusBadgeClass uses tertiary for active', () => {
    expect(makeVM({ status: 'active' }).statusBadgeClass).toContain('tertiary');
  });

  test('statusBadgeClass uses error for disabled', () => {
    expect(makeVM({ status: 'disabled' }).statusBadgeClass).toContain('error');
  });

  test('statusBadgeClass falls back for unknown status', () => {
    expect(makeVM({ status: 'unknown_xyz' }).statusBadgeClass).toBeDefined();
  });

  test('createdAt formats ISO date to YYYY-MM-DD', () => {
    expect(makeVM().createdAt).toBe('2026-01-15');
  });

  test('createdAt returns — for null value', () => {
    expect(makeVM({ createdAt: null }).createdAt).toBe('—');
  });

  test('createdAt handles created_at snake_case fallback', () => {
    const vm = createCustomerViewModel({ customerId: 'c1', status: 'active', created_at: '2025-06-01T00:00:00Z' }, { router: makeRouter() });
    expect(vm.createdAt).toBe('2025-06-01');
  });

  test('view() navigates to customer profile route', () => {
    const router = makeRouter();
    const vm = createCustomerViewModel(RAW, { router });
    vm.view();
    expect(router.navigate).toHaveBeenCalledWith('#/customers/cust_abc123/profile');
  });

  test('view() URL-encodes customer id', () => {
    const router = makeRouter();
    const vm = createCustomerViewModel({ ...RAW, customerId: 'cust/slash' }, { router });
    vm.view();
    expect(router.navigate).toHaveBeenCalledWith('#/customers/cust%2Fslash/profile');
  });
});

describe('customerStatusBadgeClass', () => {
  test('returns active badge for active', () => {
    expect(customerStatusBadgeClass('active')).toBe(CUSTOMER_STATUS_BADGE.active);
  });

  test('returns error badge for disabled', () => {
    expect(customerStatusBadgeClass('disabled')).toBe(CUSTOMER_STATUS_BADGE.disabled);
  });

  test('returns frozen badge for frozen', () => {
    expect(customerStatusBadgeClass('frozen')).toBe(CUSTOMER_STATUS_BADGE.frozen);
  });

  test('falls back to frozen badge for unknown status', () => {
    expect(customerStatusBadgeClass('foobar')).toBe(CUSTOMER_STATUS_BADGE.frozen);
  });
});
