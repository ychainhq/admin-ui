import { createController } from '../../src/views/NodeDetailView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const BLOCKCHAININFO = { blocks: 201, chain: 'regtest' };
const KNOWN_NODE = 'btc-regtest';
const UNKNOWN_NODE = 'eth-unknown';

function makeCtrl(nodeId = KNOWN_NODE, apiOverrides = {}) {
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ nodeId, api, router });
  return { ctrl, api, router };
}

function makeRpcWithAddress(address = 'bcrt1qabc123') {
  return jest.fn().mockImplementation((method) => {
    if (method === 'getnewaddress') return Promise.resolve({ result: address });
    return Promise.resolve({ result: null });
  });
}

function makeRpcWithBlocks(hashes = ['h1', 'h2']) {
  return jest.fn().mockResolvedValue({ result: hashes });
}

describe('NodeDetailView — createController', () => {
  // ─── Node config ──────────────────────────────────────────────────────────────
  test('notFound is false for known nodeId', () => {
    const { ctrl } = makeCtrl(KNOWN_NODE);
    expect(ctrl.notFound).toBe(false);
  });

  test('notFound is true for unknown nodeId', () => {
    const { ctrl } = makeCtrl(UNKNOWN_NODE);
    expect(ctrl.notFound).toBe(true);
  });

  test('nodeLabel is set from node config', () => {
    const { ctrl } = makeCtrl(KNOWN_NODE);
    expect(ctrl.nodeLabel).toBe('Bitcoin Core');
  });

  test('nodeNetwork is set from node config', () => {
    const { ctrl } = makeCtrl(KNOWN_NODE);
    expect(ctrl.nodeNetwork).toBe('regtest');
  });

  test('nodeId is stored on the controller', () => {
    const { ctrl } = makeCtrl(KNOWN_NODE);
    expect(ctrl.nodeId).toBe(KNOWN_NODE);
  });

  // ─── init / nodeStatus ────────────────────────────────────────────────────────
  test('init() calls api.rpc getblockchaininfo for known node', async () => {
    const { ctrl, api } = makeCtrl(KNOWN_NODE, {
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(api.rpc).toHaveBeenCalledWith('getblockchaininfo', []);
  });

  test('init() sets nodeStatus.showOnline on success', async () => {
    const { ctrl } = makeCtrl(KNOWN_NODE, {
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodeStatus.showOnline).toBe(true);
    expect(ctrl.nodeStatus.showOffline).toBe(false);
    expect(ctrl.nodeStatus.checking).toBe(false);
  });

  test('init() sets nodeStatus.blocksText from result', async () => {
    const { ctrl } = makeCtrl(KNOWN_NODE, {
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodeStatus.blocksText).toBe('201');
  });

  test('init() sets nodeStatus.showOffline on API failure', async () => {
    const { ctrl } = makeCtrl(KNOWN_NODE, {
      rpc: jest.fn().mockRejectedValue(new Error('Connection refused')),
    });
    await ctrl.init();
    expect(ctrl.nodeStatus.showOffline).toBe(true);
    expect(ctrl.nodeStatus.showOnline).toBe(false);
    expect(ctrl.nodeStatus.checking).toBe(false);
  });

  test('init() does not call api when notFound', async () => {
    const { ctrl, api } = makeCtrl(UNKNOWN_NODE, {
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(api.rpc).not.toHaveBeenCalled();
  });

  // ─── backToNodes ──────────────────────────────────────────────────────────────
  test('backToNodes() navigates to #/nodes', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.backToNodes();
    expect(router.navigate).toHaveBeenCalledWith('#/nodes');
  });

  // ─── generateAddr — initial state ─────────────────────────────────────────────
  test('generateAddr initial state is correct', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.generateAddr.wallet).toBe('');
    expect(ctrl.generateAddr.addressType).toBe('bech32');
    expect(ctrl.generateAddr.loading).toBe(false);
    expect(ctrl.generateAddr.error).toBeNull();
    expect(ctrl.generateAddr.result).toBeNull();
  });

  test('generateAddr.onWalletInput updates wallet', () => {
    const { ctrl } = makeCtrl();
    ctrl.generateAddr.onWalletInput({ target: { value: 'my-wallet' } });
    expect(ctrl.generateAddr.wallet).toBe('my-wallet');
  });

  test('generateAddr.onTypeChange updates addressType', () => {
    const { ctrl } = makeCtrl();
    ctrl.generateAddr.onTypeChange({ target: { value: 'legacy' } });
    expect(ctrl.generateAddr.addressType).toBe('legacy');
  });

  // ─── generateAddr.run ─────────────────────────────────────────────────────────
  test('generateAddr.run() with empty wallet sets error and does not call api', async () => {
    const { ctrl, api } = makeCtrl(KNOWN_NODE, { rpc: makeRpcWithAddress() });
    await ctrl.generateAddr.run();
    expect(ctrl.generateAddr.error).toBeTruthy();
    expect(api.rpc).not.toHaveBeenCalled();
  });

  test('generateAddr.run() calls createwallet, loadwallet, getnewaddress in order', async () => {
    const rpc = makeRpcWithAddress('bcrt1qabc123');
    const { ctrl } = makeCtrl(KNOWN_NODE, { rpc });
    ctrl.generateAddr.wallet = 'test-wallet';
    await ctrl.generateAddr.run();
    expect(rpc).toHaveBeenCalledWith('createwallet', expect.any(Array));
    expect(rpc).toHaveBeenCalledWith('loadwallet', ['test-wallet']);
    expect(rpc).toHaveBeenCalledWith('getnewaddress', ['', 'bech32'], { wallet: 'test-wallet' });
  });

  test('generateAddr.run() sets result on success', async () => {
    const { ctrl } = makeCtrl(KNOWN_NODE, { rpc: makeRpcWithAddress('bcrt1qabc123') });
    ctrl.generateAddr.wallet = 'test-wallet';
    await ctrl.generateAddr.run();
    expect(ctrl.generateAddr.result).toBe('bcrt1qabc123');
    expect(ctrl.generateAddr.error).toBeNull();
  });

  test('generateAddr.run() sets error when getnewaddress fails', async () => {
    const rpc = jest.fn().mockImplementation((method) => {
      if (method === 'getnewaddress') return Promise.reject(new Error('Wallet not found'));
      return Promise.resolve({ result: null });
    });
    const { ctrl } = makeCtrl(KNOWN_NODE, { rpc });
    ctrl.generateAddr.wallet = 'bad-wallet';
    await ctrl.generateAddr.run();
    expect(ctrl.generateAddr.error).toBe('Wallet not found');
    expect(ctrl.generateAddr.result).toBeNull();
  });

  test('generateAddr.loading is false after run completes', async () => {
    const { ctrl } = makeCtrl(KNOWN_NODE, { rpc: makeRpcWithAddress() });
    ctrl.generateAddr.wallet = 'test-wallet';
    await ctrl.generateAddr.run();
    expect(ctrl.generateAddr.loading).toBe(false);
  });

  test('generateAddr.run() proceeds when createwallet and loadwallet fail', async () => {
    const rpc = jest.fn().mockImplementation((method) => {
      if (method === 'createwallet') return Promise.reject(new Error('already exists'));
      if (method === 'loadwallet') return Promise.reject(new Error('already loaded'));
      if (method === 'getnewaddress') return Promise.resolve({ result: 'bcrt1qabc123' });
      return Promise.resolve({ result: null });
    });
    const { ctrl } = makeCtrl(KNOWN_NODE, { rpc });
    ctrl.generateAddr.wallet = 'existing-wallet';
    await ctrl.generateAddr.run();
    expect(ctrl.generateAddr.result).toBe('bcrt1qabc123');
  });

  // ─── mineBlocks — initial state ───────────────────────────────────────────────
  test('mineBlocks initial state is correct', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.mineBlocks.address).toBe('');
    expect(ctrl.mineBlocks.count).toBe('10');
    expect(ctrl.mineBlocks.loading).toBe(false);
    expect(ctrl.mineBlocks.error).toBeNull();
    expect(ctrl.mineBlocks.result).toBeNull();
  });

  test('mineBlocks.onAddressInput updates address', () => {
    const { ctrl } = makeCtrl();
    ctrl.mineBlocks.onAddressInput({ target: { value: 'bcrt1qabc' } });
    expect(ctrl.mineBlocks.address).toBe('bcrt1qabc');
  });

  test('mineBlocks.onCountInput updates count', () => {
    const { ctrl } = makeCtrl();
    ctrl.mineBlocks.onCountInput({ target: { value: '25' } });
    expect(ctrl.mineBlocks.count).toBe('25');
  });

  // ─── mineBlocks.run ───────────────────────────────────────────────────────────
  test('mineBlocks.run() with empty address sets error and does not call api', async () => {
    const { ctrl, api } = makeCtrl(KNOWN_NODE, { rpc: makeRpcWithBlocks() });
    await ctrl.mineBlocks.run();
    expect(ctrl.mineBlocks.error).toBeTruthy();
    expect(api.rpc).not.toHaveBeenCalled();
  });

  test('mineBlocks.run() with out-of-range count sets error', async () => {
    const { ctrl, api } = makeCtrl(KNOWN_NODE, { rpc: makeRpcWithBlocks() });
    ctrl.mineBlocks.address = 'bcrt1qabc';
    ctrl.mineBlocks.count = '9999';
    await ctrl.mineBlocks.run();
    expect(ctrl.mineBlocks.error).toBeTruthy();
    expect(api.rpc).not.toHaveBeenCalled();
  });

  test('mineBlocks.run() calls generatetoaddress with correct args', async () => {
    const rpc = makeRpcWithBlocks(['h1', 'h2', 'h3']);
    const { ctrl } = makeCtrl(KNOWN_NODE, { rpc });
    ctrl.mineBlocks.address = 'bcrt1qabc';
    ctrl.mineBlocks.count = '3';
    await ctrl.mineBlocks.run();
    expect(rpc).toHaveBeenCalledWith('generatetoaddress', [3, 'bcrt1qabc'], { useWallet: true });
  });

  test('mineBlocks.run() sets result on success', async () => {
    const { ctrl } = makeCtrl(KNOWN_NODE, { rpc: makeRpcWithBlocks(['h1', 'h2']) });
    ctrl.mineBlocks.address = 'bcrt1qabc';
    await ctrl.mineBlocks.run();
    expect(ctrl.mineBlocks.result).toContain('2 blocks');
    expect(ctrl.mineBlocks.error).toBeNull();
  });

  test('mineBlocks.run() sets error on API failure', async () => {
    const { ctrl } = makeCtrl(KNOWN_NODE, {
      rpc: jest.fn().mockRejectedValue(new Error('Mining failed')),
    });
    ctrl.mineBlocks.address = 'bcrt1qabc';
    await ctrl.mineBlocks.run();
    expect(ctrl.mineBlocks.error).toBe('Mining failed');
    expect(ctrl.mineBlocks.result).toBeNull();
  });

  test('mineBlocks.loading is false after run completes', async () => {
    const { ctrl } = makeCtrl(KNOWN_NODE, { rpc: makeRpcWithBlocks(['h1']) });
    ctrl.mineBlocks.address = 'bcrt1qabc';
    await ctrl.mineBlocks.run();
    expect(ctrl.mineBlocks.loading).toBe(false);
  });

  // ─── Sidebar ──────────────────────────────────────────────────────────────────
  test('sidebar Dev Nodes item is marked active', () => {
    const { ctrl } = makeCtrl();
    const item = ctrl.sidebar.navItems.find(i => i.label === 'Dev Nodes');
    expect(item).toBeDefined();
    expect(item.showActive).toBe(true);
  });

  test('topBar onBack navigates to #/nodes', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.topBar.onBack();
    expect(router.navigate).toHaveBeenCalledWith('#/nodes');
  });

  test('sidebar createTenant navigates to #/tenants/new', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.sidebar.createTenant();
    expect(router.navigate).toHaveBeenCalledWith('#/tenants/new');
  });
});
