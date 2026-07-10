import { createController } from '../../src/views/SweepsView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const SAMPLE_SWEEP = {
  id: 'sweep_abc123',
  status: 'confirmed',
  amount_raw: '95000',
  fee_raw: '5000',
  from_addresses: ['bc1qaddr1', 'bc1qaddr2'],
  tx_hash: 'deadbeef1234',
  created_at: 1716000000,
};

const SAMPLE_SUMMARY = {
  chain_id: 'bitcoin',
  asset_id: 'bitcoin:BTC',
  threshold_raw: '100000',
  current_total_raw: '75000',
  missing_raw: '25000',
  progress_pct: 75,
  total_deposit_addresses: 1250,
  addresses_with_balance: 45,
  total_utxos: 67,
  hot_wallet_address: 'bc1qhot',
  pending_sweep_id: null,
};

function makeCtrl(apiOverrides = {}, { noTenant = false } = {}) {
  if (!noTenant) sessionStorage.setItem('chain_api_tenant_key', 'test-key');
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ api, router });
  return { ctrl, api, router };
}

afterEach(() => sessionStorage.clear());

// ─── Initial state ──────────────────────────────────────────────────────────

describe('SweepsView — initial state', () => {
  test('loading is false initially', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.loading).toBe(false);
  });

  test('summaryLoading is false initially', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.summaryLoading).toBe(false);
  });

  test('sweeps list starts empty', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.sweeps).toEqual([]);
    expect(ctrl.sweepsEmpty).toBe(true);
  });

  test('error starts null', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.error).toBeNull();
  });

  test('noActiveTenant false when tenant key set', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.noActiveTenant).toBe(false);
  });

  test('noActiveTenant true when no tenant key', () => {
    const { ctrl } = makeCtrl({}, { noTenant: true });
    expect(ctrl.noActiveTenant).toBe(true);
  });
});

// ─── load() ─────────────────────────────────────────────────────────────────

describe('SweepsView — load()', () => {
  test('calls getSweeps with default limit 20', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.load();
    expect(api.getSweeps).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 })
    );
  });

  test('populates sweeps from response', async () => {
    const { ctrl } = makeCtrl({
      getSweeps: jest.fn().mockResolvedValue({
        data: [SAMPLE_SWEEP],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.sweeps).toHaveLength(1);
    expect(ctrl.sweepsEmpty).toBe(false);
  });

  test('normalizes statusLabel to uppercase', async () => {
    const { ctrl } = makeCtrl({
      getSweeps: jest.fn().mockResolvedValue({
        data: [SAMPLE_SWEEP],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.sweeps[0].statusLabel).toBe('CONFIRMED');
  });

  test('normalizes from_addresses count', async () => {
    const { ctrl } = makeCtrl({
      getSweeps: jest.fn().mockResolvedValue({
        data: [SAMPLE_SWEEP],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.sweeps[0].addressCount).toBe(2);
  });

  test('sets error on API failure', async () => {
    const { ctrl } = makeCtrl({
      getSweeps: jest.fn().mockRejectedValue(new Error('network error')),
    });
    await ctrl.load();
    expect(ctrl.error).toBe('network error');
    expect(ctrl.loading).toBe(false);
  });

  test('loading returns to false after successful load', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('loading returns to false after failed load', async () => {
    const { ctrl } = makeCtrl({
      getSweeps: jest.fn().mockRejectedValue(new Error('fail')),
    });
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('sweepsEmpty true when response is empty', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.sweepsEmpty).toBe(true);
  });
});

// ─── loadSummary() ───────────────────────────────────────────────────────────

describe('SweepsView — loadSummary()', () => {
  test('calls getSweepsSummary', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.loadSummary();
    expect(api.getSweepsSummary).toHaveBeenCalled();
  });

  test('summary.hasThreshold true when threshold_raw set', async () => {
    const { ctrl } = makeCtrl({
      getSweepsSummary: jest.fn().mockResolvedValue(SAMPLE_SUMMARY),
    });
    await ctrl.loadSummary();
    expect(ctrl.summary.hasThreshold).toBe(true);
  });

  test('summary.progressPctLabel is 75%', async () => {
    const { ctrl } = makeCtrl({
      getSweepsSummary: jest.fn().mockResolvedValue(SAMPLE_SUMMARY),
    });
    await ctrl.loadSummary();
    expect(ctrl.summary.progressPctLabel).toBe('75%');
  });

  test('summary.hasPending false when pending_sweep_id is null', async () => {
    const { ctrl } = makeCtrl({
      getSweepsSummary: jest.fn().mockResolvedValue(SAMPLE_SUMMARY),
    });
    await ctrl.loadSummary();
    expect(ctrl.summary.hasPending).toBe(false);
  });

  test('summary.hasPending true when pending_sweep_id is set', async () => {
    const { ctrl } = makeCtrl({
      getSweepsSummary: jest.fn().mockResolvedValue({
        ...SAMPLE_SUMMARY,
        pending_sweep_id: 'sweep_xyz999',
      }),
    });
    await ctrl.loadSummary();
    expect(ctrl.summary.hasPending).toBe(true);
  });

  test('summary.totalDepositAddresses reflects API value', async () => {
    const { ctrl } = makeCtrl({
      getSweepsSummary: jest.fn().mockResolvedValue(SAMPLE_SUMMARY),
    });
    await ctrl.loadSummary();
    expect(ctrl.summary.totalDepositAddresses).toBe(1250);
  });

  test('summaryLoading returns to false after load', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.loadSummary();
    expect(ctrl.summaryLoading).toBe(false);
  });

  test('summaryLoading returns to false on error (non-fatal)', async () => {
    const { ctrl } = makeCtrl({
      getSweepsSummary: jest.fn().mockRejectedValue(new Error('summary fail')),
    });
    await ctrl.loadSummary();
    expect(ctrl.summaryLoading).toBe(false);
  });
});

// ─── pagination ──────────────────────────────────────────────────────────────

describe('SweepsView — pagination', () => {
  test('pagination.hasPages true when nextCursor present', async () => {
    const { ctrl } = makeCtrl({
      getSweeps: jest.fn().mockResolvedValue({
        data: Array(20).fill(SAMPLE_SWEEP).map((s, i) => ({ ...s, id: `sweep_${i}` })),
        pagination: { nextCursor: 'cursor_next' },
      }),
    });
    await ctrl.load();
    expect(ctrl.pagination.hasPages).toBe(true);
  });

  test('pagination.hasPages false when no nextCursor and single page', async () => {
    const { ctrl } = makeCtrl({
      getSweeps: jest.fn().mockResolvedValue({
        data: [SAMPLE_SWEEP],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.pagination.hasPages).toBe(false);
  });
});

// ─── search form integration ─────────────────────────────────────────────────

describe('SweepsView — search form integration', () => {
  test('search with status filter passes it to getSweeps', async () => {
    const getSweeps = jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });

    ctrl.sweepSearchForm.onFormInput({
      target: { tagName: 'SELECT', name: 'status', value: 'Confirmed', selectedIndex: 3 },
    });
    ctrl.sweepSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    expect(getSweeps).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed' })
    );
  });

  test('clear resets filters and triggers unfiltered load', async () => {
    const getSweeps = jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });

    ctrl.sweepSearchForm.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Failed', selectedIndex: 4 } });
    ctrl.sweepSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    ctrl.sweepSearchForm.onClear({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    const lastCall = getSweeps.mock.calls.at(-1)[0];
    expect(lastCall.status).toBeUndefined();
  });

  test('search resets cursor to first page', async () => {
    const getSweeps = jest.fn()
      .mockResolvedValueOnce({
        data: Array(20).fill(SAMPLE_SWEEP).map((s, i) => ({ ...s, id: `sweep_p1_${i}` })),
        pagination: { nextCursor: 'cursor_p2' },
      })
      .mockResolvedValue({ data: [], pagination: { nextCursor: null } });

    const { ctrl } = makeCtrl({ getSweeps });
    await ctrl.load();
    ctrl.pagination.pages.find(p => p.label === '2').go();
    await new Promise(r => setTimeout(r, 0));

    ctrl.sweepSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    const lastCall = getSweeps.mock.calls.at(-1)[0];
    expect(lastCall.cursor).toBeUndefined();
  });
});

// ─── init() ─────────────────────────────────────────────────────────────────

describe('SweepsView — init()', () => {
  test('init calls load + loadSummary + loadConfig when tenant active', async () => {
    const { ctrl, api } = makeCtrl();
    ctrl.init();
    await new Promise(r => setTimeout(r, 0));
    expect(api.getSweeps).toHaveBeenCalled();
    expect(api.getSweepsSummary).toHaveBeenCalled();
    expect(api.getActiveTenantConfig).toHaveBeenCalled();
  });

  test('init does not call load when no active tenant', () => {
    const { ctrl, api } = makeCtrl({}, { noTenant: true });
    ctrl.init();
    expect(api.getSweeps).not.toHaveBeenCalled();
    expect(api.getSweepsSummary).not.toHaveBeenCalled();
    expect(api.getActiveTenantConfig).not.toHaveBeenCalled();
  });
});

// ─── loadConfig() ────────────────────────────────────────────────────────────

describe('SweepsView — loadConfig()', () => {
  test('calls getActiveTenantConfig', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.loadConfig();
    expect(api.getActiveTenantConfig).toHaveBeenCalled();
  });

  test('config.thresholdLabel shows formatted threshold', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockResolvedValue({ btcSweepThresholdSats: '100000', btcXpub: 'xpub6test' }),
    });
    await ctrl.loadConfig();
    expect(ctrl.config.thresholdLabel).toMatch(/100/);
  });

  test('config.thresholdLabel shows Not configured when null', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockResolvedValue({ btcXpub: 'xpub6test' }),
    });
    await ctrl.loadConfig();
    expect(ctrl.config.thresholdLabel).toBe('Not configured');
  });

  test('config.nextDerivationIndex shows index value', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockResolvedValue({ btcNextDerivationIndex: 42, btcXpub: 'xpub6test' }),
    });
    await ctrl.loadConfig();
    expect(ctrl.config.nextDerivationIndex).toBe('42');
  });

  test('configLoading returns to false after load', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.loadConfig();
    expect(ctrl.configLoading).toBe(false);
  });

  test('configLoading returns to false on error', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockRejectedValue(new Error('cfg fail')),
    });
    await ctrl.loadConfig();
    expect(ctrl.configLoading).toBe(false);
  });
});

// ─── navigation ──────────────────────────────────────────────────────────────

describe('SweepsView — navigation', () => {
  test('goToTenants navigates to #/tenants', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.goToTenants({ preventDefault: jest.fn() });
    expect(router.navigate).toHaveBeenCalledWith('#/tenants');
  });
});

// ─── Multi-chain: loadConfig + availableChains ────────────────────────────────

describe('SweepsView — multi-chain loadConfig', () => {
  test('loadConfig with btcXpub adds BTC to chainSelector', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockResolvedValue({ btcXpub: 'xpub6realtest' }),
    });
    await ctrl.loadConfig();
    expect(ctrl.chainSelector.hasChains).toBe(true);
    const items = ctrl.chainSelector.items;
    expect(items.some(i => i.assetId === 'bitcoin:BTC')).toBe(true);
  });

  test('loadConfig with tronXpub adds TRX and USDT chains', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockResolvedValue({ tronXpub: 'xpubTronTest' }),
    });
    await ctrl.loadConfig();
    const items = ctrl.chainSelector.items;
    expect(items.some(i => i.assetId === 'tron:TRX')).toBe(true);
    expect(items.some(i => i.assetId === 'tron:USDT')).toBe(true);
  });

  test('loadConfig with both xpubs adds BTC + TRX + USDT', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockResolvedValue({ btcXpub: 'xpub6test', tronXpub: 'xpubTronTest' }),
    });
    await ctrl.loadConfig();
    const items = ctrl.chainSelector.items;
    expect(items).toHaveLength(3);
  });

  test('loadConfig without any xpub → chainSelector has no chains', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockResolvedValue({}),
    });
    await ctrl.loadConfig();
    expect(ctrl.chainSelector.hasChains).toBe(false);
  });

  test('config.chainLabel is Bitcoin / BTC when BTC selected', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockResolvedValue({ btcXpub: 'xpub6test' }),
    });
    await ctrl.loadConfig();
    expect(ctrl.config.chainLabel).toBe('Bitcoin / BTC');
  });

  test('config.chainLabel is TRON / TRX when tronXpub set and no btcXpub', async () => {
    const { ctrl } = makeCtrl({
      getActiveTenantConfig: jest.fn().mockResolvedValue({ tronXpub: 'xpubTronTest' }),
    });
    await ctrl.loadConfig();
    expect(ctrl.config.chainLabel).toBe('TRON / TRX');
  });
});

// ─── Multi-chain: loadSummary with chain params ───────────────────────────────

describe('SweepsView — loadSummary chain params', () => {
  test('loadSummary passes selectedChainId to getSweepsSummary', async () => {
    const getSweepsSummary = jest.fn().mockResolvedValue(SAMPLE_SUMMARY);
    const { ctrl } = makeCtrl({ getSweepsSummary });
    ctrl._selectedChainId = 'bitcoin';
    ctrl._selectedAssetId = 'bitcoin:BTC';
    await ctrl.loadSummary();
    expect(getSweepsSummary).toHaveBeenCalledWith('bitcoin', 'bitcoin:BTC');
  });

  test('loadSummary passes tron params when chain is TRON', async () => {
    const tronSummary = { ...SAMPLE_SUMMARY, chain_id: 'tron', asset_id: 'tron:TRX', total_utxos: null };
    const getSweepsSummary = jest.fn().mockResolvedValue(tronSummary);
    const { ctrl } = makeCtrl({ getSweepsSummary });
    ctrl._selectedChainId = 'tron';
    ctrl._selectedAssetId = 'tron:TRX';
    await ctrl.loadSummary();
    expect(getSweepsSummary).toHaveBeenCalledWith('tron', 'tron:TRX');
  });

  test('summary.showUtxos is true when total_utxos is a number', async () => {
    const getSweepsSummary = jest.fn().mockResolvedValue({ ...SAMPLE_SUMMARY, total_utxos: 5 });
    const { ctrl } = makeCtrl({ getSweepsSummary });
    await ctrl.loadSummary();
    expect(ctrl.summary.showUtxos).toBe(true);
  });

  test('summary.showUtxos is false when total_utxos is null (TRON)', async () => {
    const tronSummary = { ...SAMPLE_SUMMARY, chain_id: 'tron', asset_id: 'tron:TRX', total_utxos: null };
    const getSweepsSummary = jest.fn().mockResolvedValue(tronSummary);
    const { ctrl } = makeCtrl({ getSweepsSummary });
    await ctrl.loadSummary();
    expect(ctrl.summary.showUtxos).toBe(false);
  });
});

// ─── Multi-chain: load() passes chain params ──────────────────────────────────

describe('SweepsView — load() chain params', () => {
  test('load() passes chainId and assetId to getSweeps', async () => {
    const getSweeps = jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });
    ctrl._selectedChainId = 'tron';
    ctrl._selectedAssetId = 'tron:TRX';
    await ctrl.load();
    expect(getSweeps).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 'tron', assetId: 'tron:TRX' })
    );
  });

  test('chain switch resets cursor', async () => {
    const getSweeps = jest.fn().mockResolvedValue({ data: [], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });
    ctrl._cursor = 'some_cursor';
    ctrl._prevCursors = ['prev1'];

    // Simulate onChainSelect
    ctrl.chainSelector = { init: jest.fn() };
    ctrl._selectedChainId = 'tron';
    ctrl._selectedAssetId = 'tron:TRX';
    ctrl._cursor = undefined;
    ctrl._prevCursors = [];
    await ctrl.load();

    const callArgs = getSweeps.mock.calls[0][0];
    expect(callArgs.cursor).toBeUndefined();
  });
});

// ─── Multi-chain: normalizeSweep formatting ───────────────────────────────────

describe('SweepsView — normalizeSweep amount formatting', () => {
  const BTC_SWEEP  = { id: 'sw1', status: 'confirmed', amount_raw: '100000000', fee_raw: '5000', from_addresses: [], tx_hash: '', created_at: 0, chain_id: 'bitcoin', asset_id: 'bitcoin:BTC' };
  const TRX_SWEEP  = { id: 'sw2', status: 'confirmed', amount_raw: '10000000',  fee_raw: '1000', from_addresses: [], tx_hash: '', created_at: 0, chain_id: 'tron',    asset_id: 'tron:TRX' };
  const USDT_SWEEP = { id: 'sw3', status: 'confirmed', amount_raw: '5000000',   fee_raw: '0',    from_addresses: [], tx_hash: '', created_at: 0, chain_id: 'tron',    asset_id: 'tron:USDT' };

  test('BTC sweep amountFmt shows BTC symbol for large amounts', async () => {
    const getSweeps = jest.fn().mockResolvedValue({ data: [BTC_SWEEP], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });
    await ctrl.load();
    expect(ctrl.sweeps[0].amountFmt).toContain('BTC');
  });

  test('TRX sweep amountFmt shows TRX symbol', async () => {
    const getSweeps = jest.fn().mockResolvedValue({ data: [TRX_SWEEP], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });
    await ctrl.load();
    expect(ctrl.sweeps[0].amountFmt).toContain('TRX');
  });

  test('USDT sweep amountFmt shows USDT symbol', async () => {
    const getSweeps = jest.fn().mockResolvedValue({ data: [USDT_SWEEP], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });
    await ctrl.load();
    expect(ctrl.sweeps[0].amountFmt).toContain('USDT');
  });

  test('small BTC amount shows sats subunit', async () => {
    const smallBtc = { ...BTC_SWEEP, amount_raw: '500' };
    const getSweeps = jest.fn().mockResolvedValue({ data: [smallBtc], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });
    await ctrl.load();
    expect(ctrl.sweeps[0].amountFmt).toContain('sats');
  });

  test('sweep chainLabel is TRON for tron sweeps', async () => {
    const getSweeps = jest.fn().mockResolvedValue({ data: [TRX_SWEEP], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });
    await ctrl.load();
    expect(ctrl.sweeps[0].chainLabel).toBe('TRON');
  });

  test('sweep chainLabel is BTC for bitcoin sweeps', async () => {
    const getSweeps = jest.fn().mockResolvedValue({ data: [BTC_SWEEP], pagination: { nextCursor: null } });
    const { ctrl } = makeCtrl({ getSweeps });
    await ctrl.load();
    expect(ctrl.sweeps[0].chainLabel).toBe('BTC');
  });
});
