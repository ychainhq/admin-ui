/**
 * NodeDetailView tests — v3
 *
 * NodeDetailView now loads node details from api.getChainNode() (DB)
 * and routes RPC calls with nodeId to the correct BTC node.
 */
import { createController } from '../../src/views/NodeDetailView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const BLOCKCHAININFO = { blocks: 201, chain: 'regtest' };
const DB_NODE_ID  = 'node_abc123'; // v3: from chain_nodes table
const DB_NODE_DATA = { data: { id: DB_NODE_ID, label: 'BTC Node 1', network: 'regtest', role: 'full', status: 'healthy' } };

function makeCtrl(nodeId = DB_NODE_ID, apiOverrides = {}) {
  const api = makeMockApi({
    getChainNode: jest.fn().mockResolvedValue(DB_NODE_DATA),
    mineBlocks:   jest.fn().mockResolvedValue({ result: ['h1', 'h2'] }),
    rpc:          jest.fn().mockResolvedValue({ result: null }),
    ...apiOverrides,
  });
  const router = makeRouter();
  const ctrl   = createController({ nodeId, api, router });
  return { ctrl, api, router };
}

function makeRpcWithAddress(address = 'bcrt1qabc123') {
  return jest.fn().mockImplementation((method) => {
    if (method === 'getnewaddress') return Promise.resolve({ result: address });
    return Promise.resolve({ result: null });
  });
}

describe('NodeDetailView — createController', () => {

  // ─── Initial state ────────────────────────────────────────────────────────

  test('notFound is false by default', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.notFound).toBe(false);
  });

  test('nodeId is stored on the controller', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.nodeId).toBe(DB_NODE_ID);
  });

  // ─── init() loads node from API ──────────────────────────────────────────

  test('init() calls api.getChainNode with nodeId', async () => {
    const { ctrl, api } = makeCtrl(DB_NODE_ID, {
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(api.getChainNode).toHaveBeenCalledWith(DB_NODE_ID);
  });

  test('init() sets nodeLabel from API response', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, {
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodeLabel).toBe('BTC Node 1');
  });

  test('init() sets nodeNetwork from API response', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, {
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodeNetwork).toBe('regtest');
  });

  test('init() uses nodeId as fallback label when API fails', async () => {
    const { ctrl } = makeCtrl('some-legacy-id', {
      getChainNode: jest.fn().mockRejectedValue(new Error('not found')),
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodeLabel).toBe('some-legacy-id');
  });

  // ─── init() calls RPC with nodeId ────────────────────────────────────────

  test('init() calls api.rpc getblockchaininfo with nodeId option', async () => {
    const rpc = jest.fn().mockResolvedValue({ result: BLOCKCHAININFO });
    const { ctrl } = makeCtrl(DB_NODE_ID, { rpc });
    await ctrl.init();
    expect(rpc).toHaveBeenCalledWith('getblockchaininfo', [], { nodeId: DB_NODE_ID });
  });

  test('init() sets nodeStatus.showOnline on success', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, {
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodeStatus.showOnline).toBe(true);
    expect(ctrl.nodeStatus.showOffline).toBe(false);
    expect(ctrl.nodeStatus.checking).toBe(false);
  });

  test('init() sets nodeStatus.blocksText from result', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, {
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodeStatus.blocksText).toBe('201');
  });

  test('init() sets nodeStatus.showOffline on RPC failure', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, {
      rpc: jest.fn().mockRejectedValue(new Error('Connection refused')),
    });
    await ctrl.init();
    expect(ctrl.nodeStatus.showOffline).toBe(true);
    expect(ctrl.nodeStatus.showOnline).toBe(false);
    expect(ctrl.nodeStatus.checking).toBe(false);
  });

  // ─── backToNodes ──────────────────────────────────────────────────────────

  test('backToNodes() navigates to #/nodes', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.backToNodes();
    expect(router.navigate).toHaveBeenCalledWith('#/nodes');
  });

  // ─── generateAddr ─────────────────────────────────────────────────────────

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

  test('generateAddr.run() with empty wallet sets error and does not call rpc', async () => {
    const rpc = makeRpcWithAddress();
    const { ctrl } = makeCtrl(DB_NODE_ID, { rpc });
    await ctrl.generateAddr.run();
    expect(ctrl.generateAddr.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  test('generateAddr.run() calls rpc with nodeId', async () => {
    const rpc = makeRpcWithAddress('bcrt1qabc123');
    const { ctrl } = makeCtrl(DB_NODE_ID, { rpc });
    ctrl.generateAddr.wallet = 'test-wallet';
    await ctrl.generateAddr.run();
    expect(rpc).toHaveBeenCalledWith('getnewaddress', ['', 'bech32'],
      expect.objectContaining({ nodeId: DB_NODE_ID, wallet: 'test-wallet' }));
  });

  test('generateAddr.run() sets result on success', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, { rpc: makeRpcWithAddress('bcrt1qabc123') });
    ctrl.generateAddr.wallet = 'test-wallet';
    await ctrl.generateAddr.run();
    expect(ctrl.generateAddr.result).toBe('bcrt1qabc123');
    expect(ctrl.generateAddr.error).toBeNull();
  });

  test('generateAddr.loading is false after run completes', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, { rpc: makeRpcWithAddress() });
    ctrl.generateAddr.wallet = 'test-wallet';
    await ctrl.generateAddr.run();
    expect(ctrl.generateAddr.loading).toBe(false);
  });

  // ─── mineBlocks ──────────────────────────────────────────────────────────

  test('mineBlocks initial state is correct', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.mineBlocks.address).toBe('');
    expect(ctrl.mineBlocks.count).toBe('10');
    expect(ctrl.mineBlocks.loading).toBe(false);
    expect(ctrl.mineBlocks.error).toBeNull();
    expect(ctrl.mineBlocks.result).toBeNull();
  });

  test('mineBlocks.run() with empty address sets error', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.mineBlocks.run();
    expect(ctrl.mineBlocks.error).toBeTruthy();
  });

  test('mineBlocks.run() calls api.mineBlocks (v3 — uses miner node)', async () => {
    const mineBlocks = jest.fn().mockResolvedValue({ result: ['h1', 'h2', 'h3'] });
    const { ctrl } = makeCtrl(DB_NODE_ID, { mineBlocks });
    ctrl.mineBlocks.address = 'bcrt1qabc';
    ctrl.mineBlocks.count   = '3';
    await ctrl.mineBlocks.run();
    expect(mineBlocks).toHaveBeenCalledWith(3, 'bcrt1qabc');
  });

  test('mineBlocks.run() sets result on success', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, {
      mineBlocks: jest.fn().mockResolvedValue({ result: ['h1', 'h2'] }),
    });
    ctrl.mineBlocks.address = 'bcrt1qabc';
    await ctrl.mineBlocks.run();
    expect(ctrl.mineBlocks.result).toContain('2 block');
    expect(ctrl.mineBlocks.error).toBeNull();
  });

  test('mineBlocks.run() sets error on failure', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, {
      mineBlocks: jest.fn().mockRejectedValue(new Error('Mining failed')),
    });
    ctrl.mineBlocks.address = 'bcrt1qabc';
    await ctrl.mineBlocks.run();
    expect(ctrl.mineBlocks.error).toBe('Mining failed');
    expect(ctrl.mineBlocks.result).toBeNull();
  });

  test('mineBlocks.loading is false after run completes', async () => {
    const { ctrl } = makeCtrl(DB_NODE_ID, {
      mineBlocks: jest.fn().mockResolvedValue({ result: ['h1'] }),
    });
    ctrl.mineBlocks.address = 'bcrt1qabc';
    await ctrl.mineBlocks.run();
    expect(ctrl.mineBlocks.loading).toBe(false);
  });

  // ─── UI framework smoke tests ─────────────────────────────────────────────

  test('sidebar Chain Nodes item is marked active', () => {
    const { ctrl } = makeCtrl();
    const item = ctrl.sidebar.navItems.find(i => i.label === 'Chain Nodes');
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

  test('mobileDrawer starts closed', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.mobileDrawer.isOpen).toBe(false);
  });

  test('topBar.onMenuOpen opens mobileDrawer', () => {
    const { ctrl } = makeCtrl();
    ctrl.topBar.onMenuOpen();
    expect(ctrl.mobileDrawer.isOpen).toBe(true);
  });

  test('activeTenant.isEmpty when no tenant stored', () => {
    sessionStorage.clear();
    const { ctrl } = makeCtrl();
    expect(ctrl.activeTenant.isEmpty).toBe(true);
  });
});
