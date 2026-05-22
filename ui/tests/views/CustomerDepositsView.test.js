import { createController } from '../../src/views/CustomerDepositsView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const CUSTOMER = { customerId: 'cust_x', status: 'active', createdAt: '2026-01-01T00:00:00Z' };
const DEPOSITS_PAGE = {
  data: [
    { depositId: 'dep_1', amount: '0.001', asset: 'BTC', status: 'confirmed', address: 'bc1qabcdef1234567890', detectedAt: '2026-02-01T10:00:00Z' },
    { depositId: 'dep_2', amount: '0.0005', asset: 'BTC', status: 'pending',  address: 'bc1qxyz', detectedAt: '2026-02-05T08:30:00Z' },
  ],
  pagination: { nextCursor: null },
};

function setup(overrides = {}) {
  sessionStorage.setItem('chain_api_tenant_key', 'test-key');
  const api = makeMockApi({
    getCustomer:         jest.fn().mockResolvedValue(CUSTOMER),
    getCustomerDeposits: jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } }),
    disableCustomer:     jest.fn().mockResolvedValue({ ...CUSTOMER, status: 'disabled' }),
    ...overrides,
  });
  const router = makeRouter();
  const ctrl = createController({ api, router, id: 'cust_x' });
  return { ctrl, api, router };
}

afterEach(() => sessionStorage.clear());

describe('CustomerDepositsView — createController', () => {
  test('initial state: no error, not loading', () => {
    const { ctrl } = setup();
    expect(ctrl.error).toBeNull();
    expect(ctrl.loading).toBe(false);
  });

  test('header activeTab is deposits', () => {
    const { ctrl } = setup();
    expect(ctrl.header.tabs.find(t => t.key === 'deposits').tabClass).toContain('border-secondary');
  });

  test('depositsEmpty=true initially', () => {
    const { ctrl } = setup();
    expect(ctrl.depositsEmpty).toBe(true);
  });

  test('load() populates deposits', async () => {
    const { ctrl } = setup({ getCustomerDeposits: jest.fn().mockResolvedValue(DEPOSITS_PAGE) });
    await ctrl.load();
    expect(ctrl.deposits).toHaveLength(2);
    expect(ctrl.depositsEmpty).toBe(false);
  });

  test('deposit objects map correctly', async () => {
    const { ctrl } = setup({ getCustomerDeposits: jest.fn().mockResolvedValue(DEPOSITS_PAGE) });
    await ctrl.load();
    const d = ctrl.deposits[0];
    expect(d.depositId).toBe('dep_1');
    expect(d.amount).toBe('0.001');
    expect(d.asset).toBe('BTC');
    expect(d.statusLabel).toBe('CONFIRMED');
    expect(d.statusBadgeClass).toContain('tertiary');
    expect(d.detectedAt).toContain('2026-02-01');
  });

  test('deposit objects map current backend snake_case shape', async () => {
    const getCustomerDeposits = jest.fn().mockResolvedValue({
      data: [
        {
          id: 'dep_670342ff21712f34',
          chain_id: 'bitcoin',
          asset_id: 'bitcoin:BTC',
          amount_raw: '5000000000',
          amount_display: '50.00000000',
          tx_hash: '958a5035cafd9973e46ebf1f313df1166cdb99446f9bd544e22fa03671d0b65a',
          vout: 0,
          confirmations: 110,
          status: 'finalized',
          address: 'bcrt1qrqrwvxs9e9ru40u9nadvgg3uj7ujs5lyk38wuf',
          created_at: '2026-05-22T13:49:24.985Z',
        },
      ],
      pagination: { nextCursor: null },
    });
    const { ctrl } = setup({ getCustomerDeposits });

    await ctrl.load();

    expect(ctrl.depositsEmpty).toBe(false);
    expect(ctrl.deposits[0]).toMatchObject({
      depositId: 'dep_670342ff21712f34',
      amount: '50.00000000',
      asset: 'BTC',
      statusLabel: 'FINALIZED',
      address: 'bcrt1qrqrwvxs9e9ru40u9nadvgg3uj7ujs5lyk38wuf',
      addressShort: 'bcrt1qrq…k38wuf',
      detectedAt: '2026-05-22 13:49',
    });
  });

  test('pending deposit has secondary badge', async () => {
    const { ctrl } = setup({ getCustomerDeposits: jest.fn().mockResolvedValue(DEPOSITS_PAGE) });
    await ctrl.load();
    expect(ctrl.deposits[1].statusBadgeClass).toContain('secondary');
  });

  test('address is truncated in addressShort', async () => {
    const { ctrl } = setup({ getCustomerDeposits: jest.fn().mockResolvedValue(DEPOSITS_PAGE) });
    await ctrl.load();
    expect(ctrl.deposits[0].addressShort).toContain('…');
    expect(ctrl.deposits[0].address).toBe('bc1qabcdef1234567890');
  });

  test('depositsEmpty=true when empty list', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.depositsEmpty).toBe(true);
  });

  test('load() sets header customer', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.header.loading).toBe(false);
  });

  test('load() sets error on failure', async () => {
    const { ctrl } = setup({ getCustomer: jest.fn().mockRejectedValue(new Error('nope')) });
    await ctrl.load();
    expect(ctrl.error).toBe('nope');
  });

  test('next page uses nextCursor', async () => {
    const getCustomerDeposits = jest.fn()
      .mockResolvedValueOnce({ data: DEPOSITS_PAGE.data, pagination: { nextCursor: 'cur_abc' } })
      .mockResolvedValueOnce({ data: [], pagination: { nextCursor: null } });
    const { ctrl } = setup({ getCustomerDeposits });
    await ctrl.load();
    ctrl.pagination.pages.find(p => p.label === '2')?.go();
    await Promise.resolve();
    expect(getCustomerDeposits).toHaveBeenLastCalledWith('cust_x', expect.objectContaining({ cursor: 'cur_abc' }));
  });

  test('deposit search passes filters to API and resets pagination', async () => {
    const getCustomerDeposits = jest.fn()
      .mockResolvedValueOnce({ data: DEPOSITS_PAGE.data, pagination: { nextCursor: 'cur_abc' } })
      .mockResolvedValueOnce({ data: [], pagination: { nextCursor: null } })
      .mockResolvedValueOnce({ data: [DEPOSITS_PAGE.data[0]], pagination: { nextCursor: null } });
    const { ctrl } = setup({ getCustomerDeposits });
    await ctrl.load();
    ctrl.pagination.pages.find(p => p.label === '2')?.go();
    await Promise.resolve();

    ctrl.depositSearchForm.onFormInput({ target: { name: 'txHash', value: '958a*' } });
    ctrl.depositSearchForm.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Finalized', selectedIndex: 4 } });
    ctrl.depositSearchForm.onFormInput({ target: { name: 'minConfirmations', value: '100' } });
    ctrl.depositSearchForm.onSearch({ preventDefault: jest.fn() });
    await Promise.resolve();

    expect(getCustomerDeposits).toHaveBeenLastCalledWith('cust_x', expect.objectContaining({
      cursor: undefined,
      txHash: '958a*',
      status: 'finalized',
      minConfirmations: 100,
    }));
  });

  test('deposit search clear removes filters and reloads first page', async () => {
    const getCustomerDeposits = jest.fn()
      .mockResolvedValueOnce({ data: DEPOSITS_PAGE.data, pagination: { nextCursor: null } })
      .mockResolvedValueOnce({ data: DEPOSITS_PAGE.data, pagination: { nextCursor: null } })
      .mockResolvedValueOnce({ data: DEPOSITS_PAGE.data, pagination: { nextCursor: null } });
    const { ctrl } = setup({ getCustomerDeposits });
    await ctrl.load();

    ctrl.depositSearchForm.onFormInput({ target: { name: 'address', value: 'bcrt1*' } });
    ctrl.depositSearchForm.onSearch({ preventDefault: jest.fn() });
    await Promise.resolve();
    ctrl.depositSearchForm.onClear({ preventDefault: jest.fn() });
    await Promise.resolve();

    expect(ctrl._activeFilters).toEqual({});
    expect(ctrl.depositSearchForm._form.address).toBe('');
    expect(getCustomerDeposits).toHaveBeenLastCalledWith('cust_x', expect.not.objectContaining({ address: 'bcrt1*' }));
  });

  test('noActiveTenant=true when no key', () => {
    sessionStorage.clear();
    const ctrl = createController({ api: makeMockApi(), router: makeRouter(), id: 'cust_x' });
    expect(ctrl.noActiveTenant).toBe(true);
  });

  test('disableCustomer() updates header', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    await ctrl.disableCustomer();
    expect(ctrl.header.canDisable).toBe(false);
  });
});
