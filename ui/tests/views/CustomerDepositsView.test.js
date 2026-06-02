/**
 * CustomerDepositsView tests — UPDATED for customer session token rule.
 * Per CLAUDE.md: transactional data (deposits) must use Customer Self-Service API
 * with a session token, NOT Tenant API.
 *
 * api.getCustomerDeposits(sessionToken, opts) — first arg is token, NOT customerId.
 * Controller calls api.createCustomerSession(id) first and passes the token.
 */
import { createController } from '../../src/views/CustomerDepositsView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const SESSION_TOKEN = 'eyJ.test.session.token';
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
    getCustomer:            jest.fn().mockResolvedValue(CUSTOMER),
    // createCustomerSession must be mocked — controller requires it
    createCustomerSession:  jest.fn().mockResolvedValue({ token: SESSION_TOKEN }),
    getCustomerDeposits:    jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } }),
    disableCustomer:        jest.fn().mockResolvedValue({ ...CUSTOMER, status: 'disabled' }),
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

  test('load() creates customer session before fetching deposits', async () => {
    const { ctrl, api } = setup();
    await ctrl.load();
    expect(api.createCustomerSession).toHaveBeenCalledWith('cust_x');
  });

  test('load() passes session token (not customerId) to getCustomerDeposits', async () => {
    const getCustomerDeposits = jest.fn().mockResolvedValue(DEPOSITS_PAGE);
    const { ctrl } = setup({ getCustomerDeposits });
    await ctrl.load();
    // First arg must be session token, NOT customerId
    expect(getCustomerDeposits.mock.calls[0][0]).toBe(SESSION_TOKEN);
    expect(getCustomerDeposits.mock.calls[0][0]).not.toBe('cust_x');
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

  test('next page uses nextCursor and passes session token', async () => {
    const getCustomerDeposits = jest.fn()
      .mockResolvedValueOnce({ data: DEPOSITS_PAGE.data, pagination: { nextCursor: 'cur_abc' } })
      .mockResolvedValueOnce({ data: [], pagination: { nextCursor: null } });
    const { ctrl } = setup({ getCustomerDeposits });
    await ctrl.load();
    ctrl.pagination.pages.find(p => p.label === '2')?.go();
    await Promise.resolve();
    // First arg is session token, second has cursor
    expect(getCustomerDeposits).toHaveBeenLastCalledWith(SESSION_TOKEN, expect.objectContaining({ cursor: 'cur_abc' }));
  });

  test('deposit search passes filters to API with session token and resets pagination', async () => {
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

    // First arg = session token, second has filters
    expect(getCustomerDeposits).toHaveBeenLastCalledWith(SESSION_TOKEN, expect.objectContaining({
      cursor: undefined,
      txHash: '958a*',
      status: 'finalized',
      minConfirmations: 100,
    }));
  });

  test('deposit search clear removes filters and reloads with session token', async () => {
    const getCustomerDeposits = jest.fn()
      .mockResolvedValue({ data: DEPOSITS_PAGE.data, pagination: { nextCursor: null } });
    const { ctrl } = setup({ getCustomerDeposits });
    await ctrl.load();

    ctrl.depositSearchForm.onFormInput({ target: { name: 'address', value: 'bcrt1*' } });
    ctrl.depositSearchForm.onSearch({ preventDefault: jest.fn() });
    await Promise.resolve();
    ctrl.depositSearchForm.onClear({ preventDefault: jest.fn() });
    await Promise.resolve();

    expect(ctrl._activeFilters).toEqual({});
    expect(ctrl.depositSearchForm._form.address).toBe('');
    // First arg always session token, not customerId
    expect(getCustomerDeposits).toHaveBeenLastCalledWith(SESSION_TOKEN, expect.not.objectContaining({ address: 'bcrt1*' }));
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

  test('depositAddr.create() adds address to depositAddresses list immediately', async () => {
    const createDepositAddress = jest.fn().mockResolvedValue({ address: 'bc1qimmediate', chain: 'bitcoin' });
    const { ctrl } = setup({ createDepositAddress });
    await ctrl.load();
    await ctrl.depositAddr.create();
    expect(ctrl.depositAddresses[0].addressShort).toBe('bc1qimmediate');
    expect(ctrl.depositAddressesEmpty).toBe(false);
    expect(ctrl.depositAddr.address).toBe('bc1qimmediate');
    expect(ctrl.depositAddr.showCreate).toBe(false);
  });

  test('depositAddressesEmpty=true initially', () => {
    const { ctrl } = setup();
    expect(ctrl.depositAddressesEmpty).toBe(true);
    expect(ctrl.depositAddresses).toHaveLength(0);
  });

  test('deposit addresses loaded and mapped on load()', async () => {
    const addrsData = { data: [
      { address: 'bc1qabcd', chain_id: 'bitcoin', status: 'active' },
      { address: 'bc1qefgh', chain_id: 'bitcoin', status: 'archived' },
    ] };
    const { ctrl } = setup({ getMyAddresses: jest.fn().mockResolvedValue(addrsData) });
    await ctrl.load();
    expect(ctrl.depositAddresses).toHaveLength(2);
    expect(ctrl.depositAddresses[0].addressShort).toBe('bc1qabcd');
  });
});
