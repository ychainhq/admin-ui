import { createSweepChainSelectorController } from '../../src/components/SweepChainSelector.js';

const BTC  = { chainId: 'bitcoin', assetId: 'bitcoin:BTC', symbol: 'BTC',  label: 'BTC' };
const TRX  = { chainId: 'tron',    assetId: 'tron:TRX',    symbol: 'TRX',  label: 'TRX' };
const USDT = { chainId: 'tron',    assetId: 'tron:USDT',   symbol: 'USDT', label: 'USDT' };

function makeCtrl(chains = [], onSelect = jest.fn()) {
  return createSweepChainSelectorController({ chains, onSelect });
}

// ─── Empty state ─────────────────────────────────────────────────────────────

describe('SweepChainSelector — empty chains', () => {
  test('hasChains is false when chains is empty', () => {
    const ctrl = makeCtrl([]);
    expect(ctrl.hasChains).toBe(false);
  });

  test('items is empty array when chains is empty', () => {
    const ctrl = makeCtrl([]);
    expect(ctrl.items).toHaveLength(0);
  });

  test('selectedChainId is null before init', () => {
    const ctrl = makeCtrl([]);
    expect(ctrl.selectedChainId).toBeNull();
  });

  test('onSelect not called on empty select call', () => {
    const onSelect = jest.fn();
    const ctrl = makeCtrl([], onSelect);
    ctrl.select('bitcoin', 'bitcoin:BTC');
    expect(onSelect).toHaveBeenCalledWith('bitcoin', 'bitcoin:BTC');
  });
});

// ─── Single chain ─────────────────────────────────────────────────────────────

describe('SweepChainSelector — single BTC chain', () => {
  test('hasChains is true', () => {
    const ctrl = makeCtrl([BTC]);
    expect(ctrl.hasChains).toBe(true);
  });

  test('items has one entry with BTC label', () => {
    const ctrl = makeCtrl([BTC]);
    expect(ctrl.items).toHaveLength(1);
    expect(ctrl.items[0].label).toBe('BTC');
  });

  test('item is not active before init', () => {
    const ctrl = makeCtrl([BTC]);
    expect(ctrl.items[0].isActive).toBe(false);
  });

  test('init(bitcoin, bitcoin:BTC) marks BTC item as active', () => {
    const ctrl = makeCtrl([BTC]);
    ctrl.init('bitcoin', 'bitcoin:BTC');
    expect(ctrl.items[0].isActive).toBe(true);
  });

  test('init sets selectedChainId', () => {
    const ctrl = makeCtrl([BTC]);
    ctrl.init('bitcoin', 'bitcoin:BTC');
    expect(ctrl.selectedChainId).toBe('bitcoin');
    expect(ctrl.selectedAssetId).toBe('bitcoin:BTC');
  });

  test('item.btnClass uses active class after init', () => {
    const ctrl = makeCtrl([BTC]);
    ctrl.init('bitcoin', 'bitcoin:BTC');
    expect(ctrl.items[0].btnClass).toContain('bg-secondary/20');
  });
});

// ─── Multiple chains ──────────────────────────────────────────────────────────

describe('SweepChainSelector — multiple chains', () => {
  test('items has 3 entries for BTC + TRX + USDT', () => {
    const ctrl = makeCtrl([BTC, TRX, USDT]);
    expect(ctrl.items).toHaveLength(3);
  });

  test('only the initialised chain is active', () => {
    const ctrl = makeCtrl([BTC, TRX, USDT]);
    ctrl.init('tron', 'tron:TRX');
    const actives = ctrl.items.filter(i => i.isActive);
    expect(actives).toHaveLength(1);
    expect(actives[0].assetId).toBe('tron:TRX');
  });

  test('selecting USDT marks it as active and deactivates others', () => {
    const ctrl = makeCtrl([BTC, TRX, USDT]);
    ctrl.init('bitcoin', 'bitcoin:BTC');
    ctrl.select('tron', 'tron:USDT');
    const actives = ctrl.items.filter(i => i.isActive);
    expect(actives).toHaveLength(1);
    expect(actives[0].assetId).toBe('tron:USDT');
  });
});

// ─── select() and onSelect callback ──────────────────────────────────────────

describe('SweepChainSelector — select()', () => {
  test('select(chainId, assetId) calls onSelect with correct args', () => {
    const onSelect = jest.fn();
    const ctrl = makeCtrl([BTC, TRX], onSelect);
    ctrl.select('tron', 'tron:TRX');
    expect(onSelect).toHaveBeenCalledWith('tron', 'tron:TRX');
  });

  test('select updates selectedChainId and selectedAssetId', () => {
    const ctrl = makeCtrl([BTC, TRX]);
    ctrl.select('tron', 'tron:TRX');
    expect(ctrl.selectedChainId).toBe('tron');
    expect(ctrl.selectedAssetId).toBe('tron:TRX');
  });

  test('item.onClick calls onSelect with correct chain', () => {
    const onSelect = jest.fn();
    const ctrl = makeCtrl([BTC, TRX], onSelect);
    const trxItem = ctrl.items.find(i => i.assetId === 'tron:TRX');
    trxItem.onClick({ preventDefault: jest.fn() });
    expect(onSelect).toHaveBeenCalledWith('tron', 'tron:TRX');
  });

  test('item.onClick calls e.preventDefault()', () => {
    const ctrl = makeCtrl([BTC]);
    const e = { preventDefault: jest.fn() };
    ctrl.items[0].onClick(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('select with same chain again does not throw', () => {
    const ctrl = makeCtrl([BTC]);
    ctrl.init('bitcoin', 'bitcoin:BTC');
    expect(() => ctrl.select('bitcoin', 'bitcoin:BTC')).not.toThrow();
  });
});

// ─── init with unknown chain ──────────────────────────────────────────────────

describe('SweepChainSelector — init with unknown chain', () => {
  test('init with unknown chainId sets selectedChainId but no item is active', () => {
    const ctrl = makeCtrl([BTC]);
    ctrl.init('ethereum', 'ethereum:ETH');
    expect(ctrl.selectedChainId).toBe('ethereum');
    expect(ctrl.items.every(i => !i.isActive)).toBe(true);
  });
});
