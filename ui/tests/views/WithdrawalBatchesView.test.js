import { createController } from '../../src/views/WithdrawalBatchesView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const SAMPLE_BATCH = {
  id: 'wdb_abc123',
  status: 'broadcast',
  chain_id: 'bitcoin',
  outputs_count: 3,
  total_output_raw: '300000',
  fee_raw: '1200',
  tx_hash: 'aabbcc',
  created_at: '2026-05-01T12:00:00Z',
};

function makeCtrl(apiOverrides = {}, { noTenant = false } = {}) {
  if (!noTenant) sessionStorage.setItem('chain_api_tenant_key', 'test-key');
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ api, router });
  return { ctrl, api, router };
}

afterEach(() => sessionStorage.clear());

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('WithdrawalBatchesView — initial state', () => {
  test('loading is false initially', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.loading).toBe(false);
  });

  test('batches list starts empty', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.batches).toEqual([]);
    expect(ctrl.batchesEmpty).toBe(true);
  });

  test('error starts null', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.error).toBeNull();
  });

  test('noActiveTenant is false when tenant key is set', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.noActiveTenant).toBe(false);
  });

  test('noActiveTenant is true when no tenant key', () => {
    const { ctrl } = makeCtrl({}, { noTenant: true });
    expect(ctrl.noActiveTenant).toBe(true);
  });
});

// ─── load() ───────────────────────────────────────────────────────────────────

describe('WithdrawalBatchesView — load()', () => {
  test('calls getWithdrawalBatches with default limit 20', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.load();
    expect(api.getWithdrawalBatches).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 })
    );
  });

  test('populates batches from response', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatches: jest.fn().mockResolvedValue({
        data: [SAMPLE_BATCH],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.batches).toHaveLength(1);
    expect(ctrl.batchesEmpty).toBe(false);
  });

  test('normalizes batch id', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatches: jest.fn().mockResolvedValue({
        data: [SAMPLE_BATCH],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.batches[0].id).toBe('wdb_abc123');
  });

  test('normalizes statusLabel to uppercase', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatches: jest.fn().mockResolvedValue({
        data: [SAMPLE_BATCH],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.batches[0].statusLabel).toBe('BROADCAST');
  });

  test('sets error on API failure', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatches: jest.fn().mockRejectedValue(new Error('network error')),
    });
    await ctrl.load();
    expect(ctrl.error).toBe('network error');
    expect(ctrl.loading).toBe(false);
  });

  test('sets batchesEmpty=true when list is empty', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.batchesEmpty).toBe(true);
  });

  test('loading returns to false after successful load', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('loading returns to false after failed load', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatches: jest.fn().mockRejectedValue(new Error('fail')),
    });
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });
});

// ─── pagination ────────────────────────────────────────────────────────────────

describe('WithdrawalBatchesView — pagination', () => {
  test('pagination.hasPages is true when nextCursor is present', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatches: jest.fn().mockResolvedValue({
        data: Array(20).fill(SAMPLE_BATCH).map((b, i) => ({ ...b, id: `wdb_${i}` })),
        pagination: { nextCursor: 'cursor_next' },
      }),
    });
    await ctrl.load();
    expect(ctrl.pagination.hasPages).toBe(true);
  });

  test('pagination.hasPages is false when no nextCursor and single page', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatches: jest.fn().mockResolvedValue({
        data: [SAMPLE_BATCH],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.pagination.hasPages).toBe(false);
  });

  test('moving to next page calls load with nextCursor', async () => {
    const getWithdrawalBatches = jest.fn()
      .mockResolvedValueOnce({
        data: Array(20).fill(SAMPLE_BATCH).map((b, i) => ({ ...b, id: `wdb_p1_${i}` })),
        pagination: { nextCursor: 'cursor_p2' },
      })
      .mockResolvedValueOnce({
        data: [{ ...SAMPLE_BATCH, id: 'wdb_p2_0' }],
        pagination: { nextCursor: null },
      });

    const { ctrl } = makeCtrl({ getWithdrawalBatches });
    await ctrl.load();

    const page2btn = ctrl.pagination.pages.find(p => p.label === '2');
    page2btn.go();
    await new Promise(r => setTimeout(r, 0));

    expect(getWithdrawalBatches).toHaveBeenCalledTimes(2);
    expect(getWithdrawalBatches.mock.calls[1][0]).toMatchObject({ cursor: 'cursor_p2' });
  });

  test('moving to previous page calls load with previous cursor', async () => {
    const getWithdrawalBatches = jest.fn()
      .mockResolvedValueOnce({
        data: Array(20).fill(SAMPLE_BATCH).map((b, i) => ({ ...b, id: `wdb_p1_${i}` })),
        pagination: { nextCursor: 'cursor_p2' },
      })
      .mockResolvedValueOnce({
        data: Array(20).fill(SAMPLE_BATCH).map((b, i) => ({ ...b, id: `wdb_p2_${i}` })),
        pagination: { nextCursor: null },
      })
      .mockResolvedValueOnce({
        data: Array(20).fill(SAMPLE_BATCH).map((b, i) => ({ ...b, id: `wdb_p1b_${i}` })),
        pagination: { nextCursor: null },
      });

    const { ctrl } = makeCtrl({ getWithdrawalBatches });
    await ctrl.load();

    ctrl.pagination.pages.find(p => p.label === '2').go();
    await new Promise(r => setTimeout(r, 0));

    ctrl.pagination.prevPage();
    await new Promise(r => setTimeout(r, 0));

    expect(getWithdrawalBatches).toHaveBeenCalledTimes(3);
    const thirdCall = getWithdrawalBatches.mock.calls[2][0];
    expect(thirdCall.cursor).toBeUndefined();
  });
});

// ─── search form integration ──────────────────────────────────────────────────

describe('WithdrawalBatchesView — search form integration', () => {
  test('search with status filter calls API with that status', async () => {
    const getWithdrawalBatches = jest.fn().mockResolvedValue({
      data: [],
      pagination: { nextCursor: null },
    });
    const { ctrl } = makeCtrl({ getWithdrawalBatches });

    ctrl.withdrawalBatchSearchForm.onFormInput({
      target: { tagName: 'SELECT', name: 'status', value: 'Broadcast', selectedIndex: 4 },
    });
    ctrl.withdrawalBatchSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    expect(getWithdrawalBatches).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'broadcast' })
    );
  });

  test('search with chainId filter calls API with that chainId', async () => {
    const getWithdrawalBatches = jest.fn().mockResolvedValue({
      data: [],
      pagination: { nextCursor: null },
    });
    const { ctrl } = makeCtrl({ getWithdrawalBatches });

    ctrl.withdrawalBatchSearchForm.onFormInput({
      target: { name: 'chainId', value: 'bitcoin' },
    });
    ctrl.withdrawalBatchSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    expect(getWithdrawalBatches).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: 'bitcoin' })
    );
  });

  test('clear resets filters and triggers unfiltered load', async () => {
    const getWithdrawalBatches = jest.fn().mockResolvedValue({
      data: [],
      pagination: { nextCursor: null },
    });
    const { ctrl } = makeCtrl({ getWithdrawalBatches });

    ctrl.withdrawalBatchSearchForm.onFormInput({ target: { name: 'chainId', value: 'bitcoin' } });
    ctrl.withdrawalBatchSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    ctrl.withdrawalBatchSearchForm.onClear({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    const lastCall = getWithdrawalBatches.mock.calls.at(-1)[0];
    expect(lastCall.chainId).toBeUndefined();
    expect(lastCall.status).toBeUndefined();
  });

  test('search resets cursor to first page', async () => {
    const getWithdrawalBatches = jest.fn()
      .mockResolvedValueOnce({
        data: Array(20).fill(SAMPLE_BATCH).map((b, i) => ({ ...b, id: `wdb_p1_${i}` })),
        pagination: { nextCursor: 'cursor_p2' },
      })
      .mockResolvedValue({ data: [], pagination: { nextCursor: null } });

    const { ctrl } = makeCtrl({ getWithdrawalBatches });
    await ctrl.load();
    ctrl.pagination.pages.find(p => p.label === '2').go();
    await new Promise(r => setTimeout(r, 0));

    ctrl.withdrawalBatchSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    const lastCall = getWithdrawalBatches.mock.calls.at(-1)[0];
    expect(lastCall.cursor).toBeUndefined();
  });
});

// ─── navigation ───────────────────────────────────────────────────────────────

describe('WithdrawalBatchesView — navigation', () => {
  test('goToTenants navigates to #/tenants', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.goToTenants({ preventDefault: jest.fn() });
    expect(router.navigate).toHaveBeenCalledWith('#/tenants');
  });

  test('init() calls load when tenant is active', async () => {
    const { ctrl, api } = makeCtrl();
    ctrl.init();
    await new Promise(r => setTimeout(r, 0));
    expect(api.getWithdrawalBatches).toHaveBeenCalled();
  });

  test('init() does not call load when no active tenant', () => {
    const { ctrl, api } = makeCtrl({}, { noTenant: true });
    ctrl.init();
    expect(api.getWithdrawalBatches).not.toHaveBeenCalled();
  });
});
