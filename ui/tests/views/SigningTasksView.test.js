import { createController } from '../../src/views/SigningTasksView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const SAMPLE_TASK = {
  id: 'sigtsk_abc123',
  status: 'pending',
  task_type: 'btc_withdrawal_batch',
  signer_name: 'Ledger Signer',
  created_at: '2026-05-01T12:00:00Z',
  expires_at: '2026-05-01T13:00:00Z',
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

describe('SigningTasksView — initial state', () => {
  test('loading is false initially', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.loading).toBe(false);
  });

  test('tasks list starts empty', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.tasks).toEqual([]);
    expect(ctrl.tasksEmpty).toBe(true);
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

describe('SigningTasksView — load()', () => {
  test('calls getSigningTasks with default limit 20', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.load();
    expect(api.getSigningTasks).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 })
    );
  });

  test('populates tasks from response', async () => {
    const { ctrl } = makeCtrl({
      getSigningTasks: jest.fn().mockResolvedValue({
        data: [SAMPLE_TASK],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.tasks).toHaveLength(1);
    expect(ctrl.tasksEmpty).toBe(false);
  });

  test('normalizes task id', async () => {
    const { ctrl } = makeCtrl({
      getSigningTasks: jest.fn().mockResolvedValue({
        data: [SAMPLE_TASK],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.tasks[0].id).toBe('sigtsk_abc123');
  });

  test('normalizes statusLabel to uppercase', async () => {
    const { ctrl } = makeCtrl({
      getSigningTasks: jest.fn().mockResolvedValue({
        data: [SAMPLE_TASK],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.tasks[0].statusLabel).toBe('PENDING');
  });

  test('normalizes type: underscores replaced with spaces, uppercased', async () => {
    const { ctrl } = makeCtrl({
      getSigningTasks: jest.fn().mockResolvedValue({
        data: [SAMPLE_TASK],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.tasks[0].type).toBe('BTC WITHDRAWAL BATCH');
  });

  test('signerName falls back to external_signer_id when signer_name absent', async () => {
    const { ctrl } = makeCtrl({
      getSigningTasks: jest.fn().mockResolvedValue({
        data: [{ ...SAMPLE_TASK, signer_name: undefined, external_signer_id: 'signer_xyz' }],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.tasks[0].signerName).toBe('signer_xyz');
  });

  test('sets error on API failure', async () => {
    const { ctrl } = makeCtrl({
      getSigningTasks: jest.fn().mockRejectedValue(new Error('network error')),
    });
    await ctrl.load();
    expect(ctrl.error).toBe('network error');
    expect(ctrl.loading).toBe(false);
  });

  test('sets tasksEmpty=true when list is empty', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.tasksEmpty).toBe(true);
  });

  test('loading returns to false after successful load', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('loading returns to false after failed load', async () => {
    const { ctrl } = makeCtrl({
      getSigningTasks: jest.fn().mockRejectedValue(new Error('fail')),
    });
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });
});

// ─── pagination ────────────────────────────────────────────────────────────────

describe('SigningTasksView — pagination', () => {
  test('pagination.hasPages is true when nextCursor is present', async () => {
    const { ctrl } = makeCtrl({
      getSigningTasks: jest.fn().mockResolvedValue({
        data: Array(20).fill(SAMPLE_TASK).map((t, i) => ({ ...t, id: `sigtsk_${i}` })),
        pagination: { nextCursor: 'cursor_next' },
      }),
    });
    await ctrl.load();
    expect(ctrl.pagination.hasPages).toBe(true);
  });

  test('pagination.hasPages is false on single page', async () => {
    const { ctrl } = makeCtrl({
      getSigningTasks: jest.fn().mockResolvedValue({
        data: [SAMPLE_TASK],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.pagination.hasPages).toBe(false);
  });

  test('moving to next page calls load with nextCursor', async () => {
    const getSigningTasks = jest.fn()
      .mockResolvedValueOnce({
        data: Array(20).fill(SAMPLE_TASK).map((t, i) => ({ ...t, id: `sigtsk_p1_${i}` })),
        pagination: { nextCursor: 'cursor_p2' },
      })
      .mockResolvedValueOnce({
        data: [{ ...SAMPLE_TASK, id: 'sigtsk_p2_0' }],
        pagination: { nextCursor: null },
      });

    const { ctrl } = makeCtrl({ getSigningTasks });
    await ctrl.load();

    ctrl.pagination.pages.find(p => p.label === '2').go();
    await new Promise(r => setTimeout(r, 0));

    expect(getSigningTasks).toHaveBeenCalledTimes(2);
    expect(getSigningTasks.mock.calls[1][0]).toMatchObject({ cursor: 'cursor_p2' });
  });
});

// ─── search form integration ──────────────────────────────────────────────────

describe('SigningTasksView — search form integration', () => {
  test('search with status filter calls API with that status', async () => {
    const getSigningTasks = jest.fn().mockResolvedValue({
      data: [],
      pagination: { nextCursor: null },
    });
    const { ctrl } = makeCtrl({ getSigningTasks });

    ctrl.signingTaskSearchForm.onFormInput({
      target: { tagName: 'SELECT', name: 'status', value: 'Signed', selectedIndex: 3 },
    });
    ctrl.signingTaskSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    expect(getSigningTasks).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'signed' })
    );
  });

  test('search with requestType filter calls API with that requestType', async () => {
    const getSigningTasks = jest.fn().mockResolvedValue({
      data: [],
      pagination: { nextCursor: null },
    });
    const { ctrl } = makeCtrl({ getSigningTasks });

    ctrl.signingTaskSearchForm.onFormInput({
      target: { tagName: 'SELECT', name: 'requestType', value: 'BTC Withdrawal Batch', selectedIndex: 1 },
    });
    ctrl.signingTaskSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    expect(getSigningTasks).toHaveBeenCalledWith(
      expect.objectContaining({ requestType: 'btc_withdrawal_batch' })
    );
  });

  test('search resets cursor to first page', async () => {
    const getSigningTasks = jest.fn()
      .mockResolvedValueOnce({
        data: Array(20).fill(SAMPLE_TASK).map((t, i) => ({ ...t, id: `sigtsk_p1_${i}` })),
        pagination: { nextCursor: 'cursor_p2' },
      })
      .mockResolvedValue({ data: [], pagination: { nextCursor: null } });

    const { ctrl } = makeCtrl({ getSigningTasks });
    await ctrl.load();
    ctrl.pagination.pages.find(p => p.label === '2').go();
    await new Promise(r => setTimeout(r, 0));

    ctrl.signingTaskSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    const lastCall = getSigningTasks.mock.calls.at(-1)[0];
    expect(lastCall.cursor).toBeUndefined();
  });

  test('clear resets filters and triggers unfiltered load', async () => {
    const getSigningTasks = jest.fn().mockResolvedValue({
      data: [],
      pagination: { nextCursor: null },
    });
    const { ctrl } = makeCtrl({ getSigningTasks });

    ctrl.signingTaskSearchForm.onFormInput({
      target: { tagName: 'SELECT', name: 'status', value: 'Signed', selectedIndex: 3 },
    });
    ctrl.signingTaskSearchForm.onSearch({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    ctrl.signingTaskSearchForm.onClear({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));

    const lastCall = getSigningTasks.mock.calls.at(-1)[0];
    expect(lastCall.status).toBeUndefined();
    expect(lastCall.requestType).toBeUndefined();
  });
});

// ─── navigation ───────────────────────────────────────────────────────────────

describe('SigningTasksView — navigation', () => {
  test('goToTenants navigates to #/tenants', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.goToTenants({ preventDefault: jest.fn() });
    expect(router.navigate).toHaveBeenCalledWith('#/tenants');
  });

  test('init() calls load when tenant is active', async () => {
    const { ctrl, api } = makeCtrl();
    ctrl.init();
    await new Promise(r => setTimeout(r, 0));
    expect(api.getSigningTasks).toHaveBeenCalled();
  });

  test('init() does not call load when no active tenant', () => {
    const { ctrl, api } = makeCtrl({}, { noTenant: true });
    ctrl.init();
    expect(api.getSigningTasks).not.toHaveBeenCalled();
  });
});
