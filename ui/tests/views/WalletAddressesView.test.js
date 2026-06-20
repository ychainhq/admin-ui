import { createController } from '../../src/views/WalletAddressesView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const WALLET_ID = 'wal_abc123';
const HOT_WALLET = { id: WALLET_ID, name: 'Hot Wallet', wallet_role: 'tenant_hot', type: 'watch_only', status: 'active' };
const COLD_WALLET = { id: WALLET_ID, name: 'Cold Wallet', wallet_role: 'tenant_cold', type: 'watch_only', status: 'active' };

const SAMPLE_ADDRESS = {
  id: 'addr_001',
  address: 'bcrt1qexample000',
  label: 'Main hot addr',
  address_type: 'p2wpkh',
  address_role: 'tenant_hot',
  chain_id: 'bitcoin',
  status: 'active',
  created_at: 1700000000,
};

const TRON_ADDRESS = {
  id: 'addr_tron_001',
  address: 'TXexampleTRON000',
  label: 'TRON hot addr',
  address_type: 'tron',
  address_role: 'tenant_hot',
  chain_id: 'tron',
  status: 'active',
  created_at: 1700000000,
};

function makeCtrl(apiOverrides = {}) {
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ walletId: WALLET_ID, api, router });
  return { ctrl, api, router };
}

function makeRpc(impl) {
  return jest.fn().mockImplementation(impl || (() => Promise.resolve({ result: null })));
}

describe('WalletAddressesView — createController', () => {
  // ─── Initial state ────────────────────────────────────────────────────────────
  test('walletId is stored on controller', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.walletId).toBe(WALLET_ID);
  });

  test('walletName starts as walletId', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.walletName).toBe(WALLET_ID);
  });

  test('loading starts false', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.loading).toBe(false);
  });

  test('isBtcHotWallet and isTronHotWallet start false', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.isBtcHotWallet).toBe(false);
    expect(ctrl.isTronHotWallet).toBe(false);
  });

  test('addressesEmpty starts true', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.addressesEmpty).toBe(true);
  });

  // ─── goToWallets ──────────────────────────────────────────────────────────────
  test('goToWallets navigates to #/wallets', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.goToWallets({ preventDefault: jest.fn() });
    expect(router.navigate).toHaveBeenCalledWith('#/wallets');
  });

  test('topBar onBack navigates to #/wallets', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.topBar.onBack();
    expect(router.navigate).toHaveBeenCalledWith('#/wallets');
  });

  // ─── init — wallet metadata ───────────────────────────────────────────────────
  test('init() calls api.getWallet with walletId', async () => {
    const { ctrl, api } = makeCtrl({ getWallet: jest.fn().mockResolvedValue(HOT_WALLET) });
    await ctrl.init();
    expect(api.getWallet).toHaveBeenCalledWith(WALLET_ID);
  });

  test('init() sets walletName from api response', async () => {
    const { ctrl } = makeCtrl({ getWallet: jest.fn().mockResolvedValue(HOT_WALLET) });
    await ctrl.init();
    expect(ctrl.walletName).toBe('Hot Wallet');
  });

  test('init() sets isBtcHotWallet=true for tenant_hot BTC wallet', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.init();
    expect(ctrl.isBtcHotWallet).toBe(true);
    expect(ctrl.isTronHotWallet).toBe(false);
  });

  test('init() sets isTronHotWallet=true for tenant_hot TRON wallet', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [TRON_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.init();
    expect(ctrl.isTronHotWallet).toBe(true);
    expect(ctrl.isBtcHotWallet).toBe(false);
  });

  test('init() sets isBtcHotWallet=false for tenant_cold wallet', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(COLD_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.init();
    expect(ctrl.isBtcHotWallet).toBe(false);
  });

  test('init() keeps walletName as walletId when getWallet fails', async () => {
    const { ctrl } = makeCtrl({ getWallet: jest.fn().mockRejectedValue(new Error('Not found')) });
    await ctrl.init();
    expect(ctrl.walletName).toBe(WALLET_ID);
    expect(ctrl.isBtcHotWallet).toBe(false);
    expect(ctrl.isTronHotWallet).toBe(false);
  });

  // ─── init — addresses load ────────────────────────────────────────────────────
  test('init() calls api.getWalletAddresses with walletId', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.init();
    expect(api.getWalletAddresses).toHaveBeenCalledWith(WALLET_ID, expect.objectContaining({ limit: 20 }));
  });

  test('init() sets addressesEmpty=true when no addresses returned', async () => {
    const { ctrl } = makeCtrl({ getWalletAddresses: jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } }) });
    await ctrl.init();
    expect(ctrl.addressesEmpty).toBe(true);
  });

  test('init() populates addresses array', async () => {
    const { ctrl } = makeCtrl({
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.init();
    expect(ctrl.addresses).toHaveLength(1);
    expect(ctrl.addresses[0].address).toBe('bcrt1qexample000');
    expect(ctrl.addressesEmpty).toBe(false);
  });

  test('init() maps address fields correctly', async () => {
    const { ctrl } = makeCtrl({
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.init();
    const addr = ctrl.addresses[0];
    expect(addr.label).toBe('Main hot addr');
    expect(addr.typeLabel).toBe('P2WPKH');
    expect(addr.roleLabel).toBe('TENANT HOT');
    expect(addr.statusLabel).toBe('ACTIVE');
  });

  test('init() sets loading=false after completion', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.init();
    expect(ctrl.loading).toBe(false);
  });

  // ─── load — error handling ────────────────────────────────────────────────────
  test('load() sets error when getWalletAddresses fails', async () => {
    const { ctrl } = makeCtrl({
      getWalletAddresses: jest.fn().mockRejectedValue(new Error('Network error')),
    });
    await ctrl.load();
    expect(ctrl.error).toBe('Network error');
    expect(ctrl.loading).toBe(false);
  });

  // ─── Pagination ────────────────────────────────────────────────────────────────
  test('pagination.hasPages is false when all items fit on one page', async () => {
    const { ctrl } = makeCtrl({
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.load();
    expect(ctrl.pagination.hasPages).toBe(false);
  });

  test('pagination.nextPage advances cursor when nextCursor exists', async () => {
    const mockAddresses = jest.fn()
      .mockResolvedValueOnce({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: 'cursor_2' } })
      .mockResolvedValueOnce({ data: [], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getWalletAddresses: mockAddresses });
    await ctrl.load();
    const totalPages = ctrl.pagination.pages.length;
    expect(totalPages).toBeGreaterThanOrEqual(2);
    await ctrl.pagination.nextPage();
    expect(mockAddresses).toHaveBeenCalledTimes(2);
    expect(mockAddresses.mock.calls[1][1]).toMatchObject({ cursor: 'cursor_2' });
  });

  // ─── Address row — copy ───────────────────────────────────────────────────────
  test('addr.copy() calls navigator.clipboard.writeText with address', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, writable: true });
    const { ctrl } = makeCtrl({
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.load();
    ctrl.addresses[0].copy();
    expect(writeText).toHaveBeenCalledWith('bcrt1qexample000');
  });

  // ─── Address row — selectForPreFund ──────────────────────────────────────────
  test('addr.selectForPreFund() sets preFund.toAddress', async () => {
    const { ctrl } = makeCtrl({
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.load();
    ctrl.addresses[0].selectForPreFund();
    expect(ctrl.preFund.toAddress).toBe('bcrt1qexample000');
    expect(ctrl.preFund.hasAddress).toBe(true);
  });

  // ─── addr.canPreFund reflects wallet-level flag ───────────────────────────────
  test('addr.canPreFund is true for BTC hot wallet', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.init();
    expect(ctrl.addresses[0].canPreFund).toBe(true);
  });

  test('addr.canPreFund is true for TRON hot wallet', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [TRON_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.init();
    expect(ctrl.addresses[0].canPreFund).toBe(true);
  });

  test('addr.canPreFund is false when wallet is not tenant_hot', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(COLD_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.init();
    expect(ctrl.addresses[0].canPreFund).toBe(false);
  });

  // ─── preFund — initial state ──────────────────────────────────────────────────
  test('preFund initial state is correct', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.preFund.fromWallet).toBe('');
    expect(ctrl.preFund.toAddress).toBe('');
    expect(ctrl.preFund.hasAddress).toBe(false);
    expect(ctrl.preFund.amount).toBe('');
    expect(ctrl.preFund.blocks).toBe('1');
    expect(ctrl.preFund.loading).toBe(false);
    expect(ctrl.preFund.error).toBeNull();
    expect(ctrl.preFund.result).toBeNull();
  });

  test('preFund.onWalletChange updates fromWallet', () => {
    const { ctrl } = makeCtrl();
    ctrl.preFund.onWalletChange({ target: { value: 'btcminer' } });
    expect(ctrl.preFund.fromWallet).toBe('btcminer');
  });

  test('preFund.onAmountInput updates amount', () => {
    const { ctrl } = makeCtrl();
    ctrl.preFund.onAmountInput({ target: { value: '0.5' } });
    expect(ctrl.preFund.amount).toBe('0.5');
  });

  test('preFund.onBlocksInput updates blocks', () => {
    const { ctrl } = makeCtrl();
    ctrl.preFund.onBlocksInput({ target: { value: '3' } });
    expect(ctrl.preFund.blocks).toBe('3');
  });

  // ─── preFund.run — validation ─────────────────────────────────────────────────
  test('preFund.run() with no wallet sets error and does not call rpc', async () => {
    const rpc = makeRpc();
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.toAddress = 'bcrt1qabc';
    ctrl.preFund.amount = '0.1';
    await ctrl.preFund.run();
    expect(ctrl.preFund.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  test('preFund.run() with no address sets error and does not call rpc', async () => {
    const rpc = makeRpc();
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.amount = '0.1';
    await ctrl.preFund.run();
    expect(ctrl.preFund.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  test('preFund.run() with zero amount sets error and does not call rpc', async () => {
    const rpc = makeRpc();
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qabc';
    ctrl.preFund.amount = '0';
    await ctrl.preFund.run();
    expect(ctrl.preFund.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  test('preFund.run() with negative blocks sets error', async () => {
    const rpc = makeRpc();
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qabc';
    ctrl.preFund.amount = '0.1';
    ctrl.preFund.blocks = '-1';
    await ctrl.preFund.run();
    expect(ctrl.preFund.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  // ─── preFund.run — success ────────────────────────────────────────────────────
  test('preFund.run() calls sendtoaddress with correct args', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ result: 'txid_abc' })          // sendtoaddress
      .mockResolvedValueOnce({ result: 'bcrt1qminer' })        // getnewaddress
      .mockResolvedValueOnce({ result: ['blockhash1'] });      // generatetoaddress
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qhot';
    ctrl.preFund.amount = '0.5';
    ctrl.preFund.blocks = '1';
    await ctrl.preFund.run();
    expect(rpc).toHaveBeenCalledWith('sendtoaddress', ['bcrt1qhot', 0.5], { wallet: 'btcminer' });
  });

  test('preFund.run() calls generatetoaddress when blocks > 0', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ result: 'txid_abc' })
      .mockResolvedValueOnce({ result: 'bcrt1qminer' })
      .mockResolvedValueOnce({ result: ['h1', 'h2'] });
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qhot';
    ctrl.preFund.amount = '0.5';
    ctrl.preFund.blocks = '2';
    await ctrl.preFund.run();
    expect(rpc).toHaveBeenCalledWith('generatetoaddress', [2, 'bcrt1qminer']);
  });

  test('preFund.run() does not call generatetoaddress when blocks = 0', async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ result: 'txid_abc' });
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qhot';
    ctrl.preFund.amount = '0.5';
    ctrl.preFund.blocks = '0';
    await ctrl.preFund.run();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).not.toHaveBeenCalledWith('generatetoaddress', expect.anything());
  });

  test('preFund.run() sets result with txid on success', async () => {
    const rpc = jest.fn()
      .mockResolvedValueOnce({ result: 'txid_abc' })
      .mockResolvedValueOnce({ result: 'bcrt1qminer' })
      .mockResolvedValueOnce({ result: ['h1'] });
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qhot';
    ctrl.preFund.amount = '0.5';
    await ctrl.preFund.run();
    expect(ctrl.preFund.result).toContain('txid_abc');
    expect(ctrl.preFund.error).toBeNull();
  });

  test('preFund.run() sets result as unconfirmed when blocks = 0', async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ result: 'txid_xyz' });
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qhot';
    ctrl.preFund.amount = '0.1';
    ctrl.preFund.blocks = '0';
    await ctrl.preFund.run();
    expect(ctrl.preFund.result).toContain('unconfirmed');
  });

  // ─── preFund.run — error handling ─────────────────────────────────────────────
  test('preFund.run() sets error when sendtoaddress fails', async () => {
    const rpc = jest.fn().mockRejectedValue(new Error('Insufficient funds'));
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qhot';
    ctrl.preFund.amount = '0.5';
    await ctrl.preFund.run();
    expect(ctrl.preFund.error).toBe('Insufficient funds');
    expect(ctrl.preFund.result).toBeNull();
  });

  test('preFund.run() sets error when sendtoaddress returns error in result', async () => {
    const rpc = jest.fn().mockResolvedValue({ error: { message: 'Invalid address' } });
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qhot';
    ctrl.preFund.amount = '0.5';
    await ctrl.preFund.run();
    expect(ctrl.preFund.error).toBe('Invalid address');
  });

  test('preFund.loading is false after run completes', async () => {
    const rpc = jest.fn().mockResolvedValue({ result: 'txid_abc' });
    const { ctrl } = makeCtrl({ rpc });
    ctrl.preFund.fromWallet = 'btcminer';
    ctrl.preFund.toAddress = 'bcrt1qhot';
    ctrl.preFund.amount = '0.5';
    ctrl.preFund.blocks = '0';
    await ctrl.preFund.run();
    expect(ctrl.preFund.loading).toBe(false);
  });

  // ─── init — BTC Core wallet dropdown (hot wallet only) ────────────────────────
  test('init() calls api.rpc listwallets for BTC hot wallet', async () => {
    const rpc = jest.fn().mockResolvedValue({ result: [] });
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
      rpc,
    });
    await ctrl.init();
    expect(rpc).toHaveBeenCalledWith('listwallets', []);
  });

  test('init() does not call api.rpc listwallets for non-hot wallet', async () => {
    const rpc = jest.fn().mockResolvedValue({ result: [] });
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(COLD_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
      rpc,
    });
    await ctrl.init();
    expect(rpc).not.toHaveBeenCalled();
  });

  test('init() does not call api.rpc listwallets for TRON hot wallet', async () => {
    const rpc = jest.fn().mockResolvedValue({ result: [] });
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [TRON_ADDRESS], pagination: { nextCursor: null } }),
      rpc,
    });
    await ctrl.init();
    expect(rpc).not.toHaveBeenCalled();
  });

  test('init() sets walletOptionsHtml from listwallets result', async () => {
    const rpc = jest.fn().mockImplementation((method) => {
      if (method === 'listwallets') return Promise.resolve({ result: ['btcminer', 'wallet2'] });
      if (method === 'getbalances') return Promise.resolve({ result: { mine: { trusted: 1.5, immature: 0 } } });
      return Promise.resolve({ result: null });
    });
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
      rpc,
    });
    await ctrl.init();
    expect(ctrl.preFund.walletOptionsHtml).toContain('btcminer');
    expect(ctrl.preFund.walletOptionsHtml).toContain('wallet2');
  });

  test('init() sets fromWallet to wallet with highest spendable balance', async () => {
    const rpc = jest.fn().mockImplementation((method, _params, opts) => {
      if (method === 'listwallets') return Promise.resolve({ result: ['empty', 'funded'] });
      if (method === 'getbalances') {
        const spendable = opts?.wallet === 'funded' ? 5.0 : 0;
        return Promise.resolve({ result: { mine: { trusted: spendable, immature: 0 } } });
      }
      return Promise.resolve({ result: null });
    });
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
      rpc,
    });
    await ctrl.init();
    expect(ctrl.preFund.fromWallet).toBe('funded');
  });

  // ─── chainLabel in address rows ───────────────────────────────────────────────
  test('addr.chainLabel shows chain from address chain_id', async () => {
    const { ctrl } = makeCtrl({
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [SAMPLE_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.load();
    expect(ctrl.addresses[0].chainLabel).toBe('BITCOIN');
  });

  test('addr.chainLabel shows TRON for tron address', async () => {
    const { ctrl } = makeCtrl({
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [TRON_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.load();
    expect(ctrl.addresses[0].chainLabel).toBe('TRON');
  });

  // ─── tronFund ─────────────────────────────────────────────────────────────────
  test('tronFund initial state is correct', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.tronFund.toAddress).toBe('');
    expect(ctrl.tronFund.hasAddress).toBe(false);
    expect(ctrl.tronFund.asset).toBe('trx');
    expect(ctrl.tronFund.amount).toBe('');
    expect(ctrl.tronFund.loading).toBe(false);
    expect(ctrl.tronFund.error).toBeNull();
    expect(ctrl.tronFund.result).toBeNull();
  });

  test('tronFund.onAssetChange updates asset and amountLabel', () => {
    const { ctrl } = makeCtrl();
    ctrl.tronFund.onAssetChange({ target: { value: 'usdt' } });
    expect(ctrl.tronFund.asset).toBe('usdt');
    expect(ctrl.tronFund.amountLabel).toContain('USDT');
  });

  test('tronFund.run() converts TRX to SUN and calls api.tronFund', async () => {
    const tronFund = jest.fn().mockResolvedValue({ txid: 'tx_tron_123' });
    const { ctrl } = makeCtrl({ tronFund });
    ctrl.tronFund.toAddress = 'TXexampleTRON000';
    ctrl.tronFund.asset = 'trx';
    ctrl.tronFund.amount = '100';
    await ctrl.tronFund.run();
    expect(tronFund).toHaveBeenCalledWith(expect.objectContaining({
      toAddress: 'TXexampleTRON000',
      amount: 100_000_000,
      asset: 'trx',
    }));
    expect(ctrl.tronFund.result).toContain('tx_tron_123');
  });

  test('tronFund.run() converts USDT to micro-USDT', async () => {
    const tronFund = jest.fn().mockResolvedValue({ txid: 'tx_usdt_456' });
    const { ctrl } = makeCtrl({ tronFund });
    ctrl.tronFund.toAddress = 'TXexampleTRON000';
    ctrl.tronFund.asset = 'usdt';
    ctrl.tronFund.amount = '10';
    await ctrl.tronFund.run();
    expect(tronFund).toHaveBeenCalledWith(expect.objectContaining({ amount: 10_000_000, asset: 'usdt' }));
  });

  test('tronFund.run() sets error when no address selected', async () => {
    const { ctrl } = makeCtrl();
    ctrl.tronFund.amount = '100';
    await ctrl.tronFund.run();
    expect(ctrl.tronFund.error).toBeTruthy();
  });

  test('tronFund.run() sets error when api.tronFund throws', async () => {
    const tronFund = jest.fn().mockRejectedValue(new Error('TRON node unreachable'));
    const { ctrl } = makeCtrl({ tronFund });
    ctrl.tronFund.toAddress = 'TXexampleTRON000';
    ctrl.tronFund.amount = '10';
    await ctrl.tronFund.run();
    expect(ctrl.tronFund.error).toBe('TRON node unreachable');
    expect(ctrl.tronFund.loading).toBe(false);
  });

  test('selectForPreFund on TRON wallet sets tronFund.toAddress', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({ data: [TRON_ADDRESS], pagination: { nextCursor: null } }),
    });
    await ctrl.init();
    ctrl.addresses[0].selectForPreFund();
    expect(ctrl.tronFund.toAddress).toBe('TXexampleTRON000');
    expect(ctrl.tronFund.hasAddress).toBe(true);
    expect(ctrl.preFund.toAddress).toBe('');
  });

  // ─── selectForPreFund routes by address chain_id, not wallet-level flag ────────
  test('BTC address routes to preFund even when wallet also has TRON addresses', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({
        data: [SAMPLE_ADDRESS, TRON_ADDRESS],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.init();
    const btcAddr = ctrl.addresses.find(a => a.chainLabel === 'BITCOIN');
    btcAddr.selectForPreFund();
    expect(ctrl.preFund.toAddress).toBe('bcrt1qexample000');
    expect(ctrl.preFund.hasAddress).toBe(true);
    expect(ctrl.tronFund.toAddress).toBe('');
  });

  test('TRON address routes to tronFund even when wallet also has BTC addresses', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({
        data: [SAMPLE_ADDRESS, TRON_ADDRESS],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.init();
    const tronAddr = ctrl.addresses.find(a => a.chainLabel === 'TRON');
    tronAddr.selectForPreFund();
    expect(ctrl.tronFund.toAddress).toBe('TXexampleTRON000');
    expect(ctrl.tronFund.hasAddress).toBe(true);
    expect(ctrl.preFund.toAddress).toBe('');
  });

  test('mixed wallet shows both isBtcHotWallet and isTronHotWallet', async () => {
    const { ctrl } = makeCtrl({
      getWallet: jest.fn().mockResolvedValue(HOT_WALLET),
      getWalletAddresses: jest.fn().mockResolvedValue({
        data: [SAMPLE_ADDRESS, TRON_ADDRESS],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.init();
    expect(ctrl.isBtcHotWallet).toBe(true);
    expect(ctrl.isTronHotWallet).toBe(true);
  });
});
