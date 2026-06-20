import { createController } from '../../src/views/WalletsView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

jest.mock('../../src/api.js', () => ({
  getActiveTenantKey: jest.fn().mockReturnValue('tenant_key_test'),
}));

import { getActiveTenantKey } from '../../src/api.js';

const WALLET_BTC = {
  id: 'wallet_btc001',
  name: 'Customer Deposits (BTC)',
  type: 'watch_only',
  wallet_role: 'customer_deposits',
  status: 'active',
  chains: ['bitcoin'],
};

const WALLET_HOT = {
  id: 'wallet_hot001',
  name: 'Tenant Hot Wallet',
  type: 'external_signer',
  wallet_role: 'tenant_hot',
  status: 'active',
  chains: ['bitcoin', 'tron'],
};

function setup(apiOverrides = {}) {
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ api, router });
  return { ctrl, api, router };
}

describe('WalletsView — createController', () => {
  // ─── Initial state ────────────────────────────────────────────────────────────

  test('loading starts false', () => {
    const { ctrl } = setup();
    expect(ctrl.loading).toBe(false);
  });

  test('wallets starts as empty array', () => {
    const { ctrl } = setup();
    expect(ctrl.wallets).toEqual([]);
  });

  test('walletsEmpty starts true', () => {
    const { ctrl } = setup();
    expect(ctrl.walletsEmpty).toBe(true);
  });

  test('error starts null', () => {
    const { ctrl } = setup();
    expect(ctrl.error).toBeNull();
  });

  test('noActiveTenant is false when tenant key exists', () => {
    getActiveTenantKey.mockReturnValue('tenant_key_test');
    const { ctrl } = setup();
    expect(ctrl.noActiveTenant).toBe(false);
  });

  test('noActiveTenant is true when no tenant key', () => {
    getActiveTenantKey.mockReturnValueOnce(null);
    const { ctrl } = setup();
    expect(ctrl.noActiveTenant).toBe(true);
  });

  // ─── load() ───────────────────────────────────────────────────────────────────

  test('load() calls api.getWallets()', async () => {
    const { ctrl, api } = setup();
    await ctrl.load();
    expect(api.getWallets).toHaveBeenCalled();
  });

  test('load() populates wallets from api response', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC, WALLET_HOT] }),
    });
    await ctrl.load();
    expect(ctrl.wallets).toHaveLength(2);
  });

  test('load() sets walletsEmpty=false when wallets are returned', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
    });
    await ctrl.load();
    expect(ctrl.walletsEmpty).toBe(false);
  });

  test('load() sets walletsEmpty=true when no wallets', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [] }),
    });
    await ctrl.load();
    expect(ctrl.walletsEmpty).toBe(true);
  });

  test('load() sets error on api failure', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockRejectedValue(new Error('Network error')),
    });
    await ctrl.load();
    expect(ctrl.error).toBe('Network error');
  });

  test('load() sets loading=false after completion', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('load() sets loading=false even after failure', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockRejectedValue(new Error('fail')),
    });
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  // ─── chainsLabel ──────────────────────────────────────────────────────────────

  test('chainsLabel is BITCOIN for single-chain bitcoin wallet', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].chainsLabel).toBe('BITCOIN');
  });

  test('chainsLabel is BITCOIN · TRON for multi-chain hot wallet', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_HOT] }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].chainsLabel).toBe('BITCOIN · TRON');
  });

  test('chainsLabel is — for wallet with empty chains array', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [{ ...WALLET_BTC, chains: [] }] }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].chainsLabel).toBe('—');
  });

  test('chainsLabel is — when chains field is missing', async () => {
    const walletNoChains = { id: 'w1', name: 'W', type: 'watch_only', wallet_role: 'watch_only', status: 'active' };
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [walletNoChains] }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].chainsLabel).toBe('—');
  });

  // ─── wallet row fields ────────────────────────────────────────────────────────

  test('wallet id is mapped correctly', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].id).toBe('wallet_btc001');
  });

  test('wallet name is mapped correctly', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].name).toBe('Customer Deposits (BTC)');
  });

  test('wallet roleLabel is labelled', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].roleLabel).toBe('CUSTOMER DEPOSITS');
  });

  // ─── sweep() ──────────────────────────────────────────────────────────────────

  test('sweep() uses first chain as chain parameter', async () => {
    const createSweep = jest.fn().mockResolvedValue({ id: 'sweep_1' });
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_HOT] }),
      createSweep,
    });
    await ctrl.load();
    ctrl.wallets[0].sweep();
    expect(createSweep).toHaveBeenCalledWith(
      expect.objectContaining({ chain: 'bitcoin', sourceWalletId: 'wallet_hot001' })
    );
  });

  test('sweep() falls back to bitcoin when chains is empty', async () => {
    const createSweep = jest.fn().mockResolvedValue({ id: 'sweep_1' });
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [{ ...WALLET_HOT, chains: [] }] }),
      createSweep,
    });
    await ctrl.load();
    ctrl.wallets[0].sweep();
    expect(createSweep).toHaveBeenCalledWith(expect.objectContaining({ chain: 'bitcoin' }));
  });

  test('sweep() sets sweepResult on success', async () => {
    const createSweep = jest.fn().mockResolvedValue({ id: 'sweep_abc' });
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
      createSweep,
    });
    await ctrl.load();
    ctrl.wallets[0].sweep();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ctrl.sweepResult).toContain('sweep_abc');
  });

  test('sweep() sets sweepError on failure', async () => {
    const createSweep = jest.fn().mockRejectedValue(new Error('Sweep failed'));
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
      createSweep,
    });
    await ctrl.load();
    ctrl.wallets[0].sweep();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ctrl.sweepError).toBe('Sweep failed');
  });

  // ─── viewAddresses() ─────────────────────────────────────────────────────────

  test('viewAddresses() navigates to wallet addresses route', async () => {
    const { ctrl, router } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
    });
    await ctrl.load();
    ctrl.wallets[0].viewAddresses();
    expect(router.navigate).toHaveBeenCalledWith('#/wallets/wallet_btc001/addresses');
  });

  // ─── goToTenants() ───────────────────────────────────────────────────────────

  test('goToTenants() navigates to #/tenants', () => {
    const { ctrl, router } = setup();
    ctrl.goToTenants({ preventDefault: jest.fn() });
    expect(router.navigate).toHaveBeenCalledWith('#/tenants');
  });

  // ─── wallet.balance — multi-asset display ────────────────────────────────────

  test('wallet.balance shows bitcoin:BTC total_display', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
      getWalletBalances: jest.fn().mockResolvedValue({
        balances: { 'bitcoin:BTC': { total_display: '0.00100000 BTC' } },
      }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].balance).toBe('0.00100000 BTC');
  });

  test('wallet.balance joins multiple assets with |', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_HOT] }),
      getWalletBalances: jest.fn().mockResolvedValue({
        balances: {
          'tron:TRX':  { total_display: '1.000000 TRX' },
          'tron:USDT': { total_display: '5.000000 USDT' },
        },
      }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].balance).toBe('1.000000 TRX | 5.000000 USDT');
  });

  test('wallet.balance is — when balances object is empty', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
      getWalletBalances: jest.fn().mockResolvedValue({ balances: {} }),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].balance).toBe('—');
  });

  test('wallet.balance is — when getWalletBalances throws', async () => {
    const { ctrl } = setup({
      getWallets: jest.fn().mockResolvedValue({ data: [WALLET_BTC] }),
      getWalletBalances: jest.fn().mockRejectedValue(new Error('rpc error')),
    });
    await ctrl.load();
    expect(ctrl.wallets[0].balance).toBe('—');
  });
});
