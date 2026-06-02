/**
 * NodeListView tests — v3
 *
 * NodeListView no longer uses static NODES array.
 * It fetches chain nodes from api.getChainNodes() and engine instances
 * from api.getClusterStatus().
 */
import { createController } from '../../src/views/NodeListView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const MOCK_CHAIN_NODES = {
  data: [
    {
      id: 'node_abc123',
      chainId: 'bitcoin',
      label: 'BTC Node 1',
      network: 'regtest',
      role: 'full',
      status: 'healthy',
      blockHeight: 101,
      lastCheckedAt: Math.floor(Date.now() / 1000) - 5,
      priority: 10,
      rpcUrl: 'http://btc-node-1:18443',
    },
    {
      id: 'node_def456',
      chainId: 'bitcoin',
      label: 'BTC Node 2',
      network: 'regtest',
      role: 'full',
      status: 'healthy',
      blockHeight: 101,
      lastCheckedAt: Math.floor(Date.now() / 1000) - 10,
      priority: 20,
      rpcUrl: 'http://btc-node-2:18443',
    },
  ],
};

const MOCK_CLUSTER = {
  data: {
    instanceId: 'engine_host1_1234_1000',
    instances: [
      { id: 'engine_host1_1234_1000', engineUrl: 'http://engine-1:3000', version: '1.0.1', lastSeenAt: Math.floor(Date.now() / 1000) - 3 },
      { id: 'engine_host2_5678_2000', engineUrl: 'http://engine-2:3000', version: '1.0.1', lastSeenAt: Math.floor(Date.now() / 1000) - 8 },
    ],
    note: 'Active-active mode',
  },
};

const MOCK_PROXY_CONFIG = {
  btcNodes: [{ id: 'btc-node-1', url: 'http://localhost:18443', isMiner: true }],
  isV3: true,
};

function makeCtrl(apiOverrides = {}) {
  const api = makeMockApi({
    getChainNodes:    jest.fn().mockResolvedValue(MOCK_CHAIN_NODES),
    getClusterStatus: jest.fn().mockResolvedValue(MOCK_CLUSTER),
    getProxyConfig:   jest.fn().mockResolvedValue(MOCK_PROXY_CONFIG),
    mineBlocks:       jest.fn().mockResolvedValue({ result: ['blockhash1'] }),
    ...apiOverrides,
  });
  const router = makeRouter();
  const ctrl   = createController({ api, router });
  return { ctrl, api, router };
}

describe('NodeListView — createController', () => {

  test('initial state: chainNodes and engineInstances are empty arrays', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.chainNodes).toEqual([]);
    expect(ctrl.engineInstances).toEqual([]);
  });

  test('initial state: loading is false (set to true during init)', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.loading).toBe(false);
  });

  test('init() calls api.getChainNodes', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.init();
    expect(api.getChainNodes).toHaveBeenCalled();
  });

  test('init() calls api.getClusterStatus', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.init();
    expect(api.getClusterStatus).toHaveBeenCalled();
  });

  test('init() populates chainNodes from API', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.init();
    expect(ctrl.chainNodes.length).toBe(2);
    expect(ctrl.chainNodes[0].id).toBe('node_abc123');
    expect(ctrl.chainNodes[0].label).toBe('BTC Node 1');
  });

  test('init() sets loading to false after completion', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.init();
    expect(ctrl.loading).toBe(false);
  });

  test('init() populates engineInstances from cluster status', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.init();
    expect(ctrl.engineInstances.length).toBe(2);
  });

  test('engineInstances marks self instance correctly', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.init();
    const selfInst = ctrl.engineInstances.find(e => e.isSelf);
    expect(selfInst).toBeDefined();
    expect(selfInst.id).toBe('engine_host1_1234_1000');
  });

  test('chainNodes[0].openDetail() navigates to node detail route', async () => {
    const { ctrl, router } = makeCtrl();
    await ctrl.init();
    ctrl.chainNodes[0].openDetail();
    expect(router.navigate).toHaveBeenCalledWith('#/nodes/node_abc123');
  });

  test('chainNodes have statusClass and dotClass set', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.init();
    expect(ctrl.chainNodes[0].statusClass).toBeTruthy();
    expect(ctrl.chainNodes[0].dotClass).toBeTruthy();
  });

  test('chainNodes have blockHeightText set', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.init();
    expect(ctrl.chainNodes[0].blockHeightText).toBe('101');
  });

  test('init() handles getChainNodes failure gracefully', async () => {
    const { ctrl } = makeCtrl({
      getChainNodes: jest.fn().mockRejectedValue(new Error('network error')),
    });
    await ctrl.init();
    expect(ctrl.loading).toBe(false);
    expect(ctrl.error).toMatch(/network error/);
  });

  test('init() handles getClusterStatus failure gracefully (leaves engineInstances empty)', async () => {
    const { ctrl } = makeCtrl({
      getClusterStatus: jest.fn().mockRejectedValue(new Error('no admin key')),
    });
    await ctrl.init();
    expect(ctrl.engineInstances).toEqual([]);
    expect(ctrl.loading).toBe(false);
  });

  test('refresh() re-calls init', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.init();
    ctrl.refresh();
    expect(api.getChainNodes).toHaveBeenCalledTimes(2);
  });

  test('mining.mine() calls api.mineBlocks', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.init();
    self.mining = ctrl.mining;
    ctrl.mining.blocks = 3;
    await ctrl.mining.mine();
    expect(api.mineBlocks).toHaveBeenCalledWith(3);
  });

  test('mining.mine() sets result on success', async () => {
    const { ctrl } = makeCtrl({
      mineBlocks: jest.fn().mockResolvedValue({ result: ['h1', 'h2'] }),
    });
    await ctrl.init();
    ctrl.mining.blocks = 2;
    await ctrl.mining.mine();
    expect(ctrl.mining.result).toMatch(/Mined 2/);
  });

  test('mining.mine() sets error on failure', async () => {
    const { ctrl } = makeCtrl({
      mineBlocks: jest.fn().mockRejectedValue(new Error('RPC error')),
    });
    await ctrl.init();
    await ctrl.mining.mine();
    expect(ctrl.mining.error).toMatch(/RPC error/);
    expect(ctrl.mining.result).toBe('');
  });

  // ─── UI framework smoke tests ─────────────────────────────────────────────

  test('sidebar Chain Nodes item is marked active', () => {
    const { ctrl } = makeCtrl();
    const item = ctrl.sidebar.navItems.find(i => i.label === 'Chain Nodes');
    expect(item).toBeDefined();
    expect(item.showActive).toBe(true);
  });

  test('topBar title is set correctly', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.topBar.title).toBe('Chain Nodes');
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
