import { createController } from '../../src/views/CustomerBalancesView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const CUSTOMER = { customerId: 'cust_x', status: 'active', createdAt: '2026-01-01T00:00:00Z' };
const BALANCES = {
  customerId: 'cust_x',
  balances: [
    { asset: 'BTC', chain: 'bitcoin',  available: '0.05', pending: '0.01', hold: '0.00' },
    { asset: 'USDC', chain: 'ethereum', available: '500', pending: '0',    hold: '50' },
  ],
};

function setup(overrides = {}) {
  sessionStorage.setItem('chain_api_tenant_key', 'test-key');
  const api = makeMockApi({
    getCustomer:         jest.fn().mockResolvedValue(CUSTOMER),
    getCustomerBalances: jest.fn().mockResolvedValue({ customerId: 'cust_x', balances: [] }),
    disableCustomer:     jest.fn().mockResolvedValue({ ...CUSTOMER, status: 'disabled' }),
    ...overrides,
  });
  const router = makeRouter();
  const ctrl = createController({ api, router, id: 'cust_x' });
  return { ctrl, api, router };
}

afterEach(() => sessionStorage.clear());

describe('CustomerBalancesView — createController', () => {
  test('initial state: no error, not loading', () => {
    const { ctrl } = setup();
    expect(ctrl.error).toBeNull();
    expect(ctrl.loading).toBe(false);
  });

  test('header activeTab is balances', () => {
    const { ctrl } = setup();
    expect(ctrl.header.tabs.find(t => t.key === 'balances').tabClass).toContain('border-secondary');
  });

  test('balancesEmpty=true initially', () => {
    const { ctrl } = setup();
    expect(ctrl.balancesEmpty).toBe(true);
  });

  test('load() sets balances from API', async () => {
    const { ctrl } = setup({ getCustomerBalances: jest.fn().mockResolvedValue(BALANCES) });
    await ctrl.load();
    expect(ctrl.balances).toHaveLength(2);
    expect(ctrl.balancesEmpty).toBe(false);
  });

  test('balance objects map correctly', async () => {
    const { ctrl } = setup({ getCustomerBalances: jest.fn().mockResolvedValue(BALANCES) });
    await ctrl.load();
    expect(ctrl.balances[0].asset).toBe('BTC');
    expect(ctrl.balances[0].chain).toBe('bitcoin');
    expect(ctrl.balances[0].available).toBe('0.05');
    expect(ctrl.balances[0].pending).toBe('0.01');
    expect(ctrl.balances[0].hold).toBe('0.00');
  });

  test('balancesEmpty=true when empty balances list', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.balancesEmpty).toBe(true);
  });

  test('load() sets header customer', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.header.loading).toBe(false);
  });

  test('load() sets error on failure', async () => {
    const { ctrl } = setup({ getCustomer: jest.fn().mockRejectedValue(new Error('fail')) });
    await ctrl.load();
    expect(ctrl.error).toBe('fail');
  });

  test('noActiveTenant=true when no key', () => {
    sessionStorage.clear();
    const api = makeMockApi();
    const ctrl = createController({ api, router: makeRouter(), id: 'cust_x' });
    expect(ctrl.noActiveTenant).toBe(true);
  });

  test('init() skips load when noActiveTenant', async () => {
    sessionStorage.clear();
    const api = makeMockApi();
    const ctrl = createController({ api, router: makeRouter(), id: 'cust_x' });
    await ctrl.init();
    expect(api.getCustomer).not.toHaveBeenCalled();
  });

  test('disableCustomer() updates header', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    await ctrl.disableCustomer();
    expect(ctrl.header.canDisable).toBe(false);
  });

  test('balance fields use — for missing values', async () => {
    const { ctrl } = setup({ getCustomerBalances: jest.fn().mockResolvedValue({ balances: [{ asset: '', chain: '' }] }) });
    await ctrl.load();
    expect(ctrl.balances[0].asset).toBe('—');
    expect(ctrl.balances[0].chain).toBe('—');
  });

  test('load() accepts current backend data array shape', async () => {
    const { ctrl } = setup({
      getCustomerBalances: jest.fn().mockResolvedValue([
        {
          asset_id: 'bitcoin:BTC',
          pending: '0',
          settled: '50000000000',
          total: '50000000000',
        },
      ]),
    });

    await ctrl.load();

    expect(ctrl.balancesEmpty).toBe(false);
    expect(ctrl.balances).toEqual([
      {
        asset: 'BTC',
        chain: 'bitcoin',
        available: '500.00000000',
        pending: '0.00000000',
        hold: '0.00000000',
        total: '500.00000000',
      },
    ]);
  });
});
