import { createController } from '../../src/views/NodeListView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const BLOCKCHAININFO = { blocks: 101, chain: 'regtest', headers: 101 };

function makeCtrl(apiOverrides = {}) {
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ api, router });
  return { ctrl, api, router };
}

describe('NodeListView — createController', () => {
  test('initial state: nodes is empty array', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.nodes).toEqual([]);
  });

  test('init() calls api.rpc with getblockchaininfo', async () => {
    const { ctrl, api } = makeCtrl({
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(api.rpc).toHaveBeenCalledWith('getblockchaininfo', []);
  });

  test('init() populates nodes from NODES config', async () => {
    const { ctrl } = makeCtrl({
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodes.length).toBeGreaterThan(0);
    expect(ctrl.nodes[0].id).toBe('btc-regtest');
  });

  test('init() marks node as online on success', async () => {
    const { ctrl } = makeCtrl({
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodes[0].showOnline).toBe(true);
    expect(ctrl.nodes[0].showOffline).toBe(false);
    expect(ctrl.nodes[0].checking).toBe(false);
  });

  test('init() sets blocksText from getblockchaininfo result', async () => {
    const { ctrl } = makeCtrl({
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    expect(ctrl.nodes[0].blocksText).toBe('101');
  });

  test('init() marks node as offline on API failure', async () => {
    const { ctrl } = makeCtrl({
      rpc: jest.fn().mockRejectedValue(new Error('Connection refused')),
    });
    await ctrl.init();
    expect(ctrl.nodes[0].showOffline).toBe(true);
    expect(ctrl.nodes[0].showOnline).toBe(false);
    expect(ctrl.nodes[0].checking).toBe(false);
  });

  test('init() sets checking:false after completion regardless of outcome', async () => {
    const { ctrl } = makeCtrl({
      rpc: jest.fn().mockRejectedValue(new Error('fail')),
    });
    await ctrl.init();
    expect(ctrl.nodes[0].checking).toBe(false);
  });

  test('nodes[0].open() navigates to node detail route', async () => {
    const { ctrl, router } = makeCtrl({
      rpc: jest.fn().mockResolvedValue({ result: BLOCKCHAININFO }),
    });
    await ctrl.init();
    ctrl.nodes[0].open();
    expect(router.navigate).toHaveBeenCalledWith('#/nodes/btc-regtest');
  });

  test('sidebar Dev Nodes item is marked active', () => {
    const { ctrl } = makeCtrl();
    const item = ctrl.sidebar.navItems.find(i => i.label === 'Dev Nodes');
    expect(item).toBeDefined();
    expect(item.showActive).toBe(true);
    expect(item.showInactive).toBe(false);
  });

  test('sidebar has separator before Dev Nodes', () => {
    const { ctrl } = makeCtrl();
    const items = ctrl.sidebar.navItems;
    const nodesIdx = items.findIndex(i => i.label === 'Dev Nodes');
    expect(items[nodesIdx - 1].separator).toBe(true);
  });

  test('topBar title is set correctly', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.topBar.title).toBe('Dev Nodes');
  });

  test('sidebar createTenant navigates to #/tenants/new', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.sidebar.createTenant();
    expect(router.navigate).toHaveBeenCalledWith('#/tenants/new');
  });
});
