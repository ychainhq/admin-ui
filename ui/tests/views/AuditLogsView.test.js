import { normalizeTickler, createController } from '../../src/views/AuditLogsView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

// ---------------------------------------------------------------------------
// normalizeTickler — unit tests (pure function)
// ---------------------------------------------------------------------------

describe('normalizeTickler — fields', () => {
  test('includes all five field values in fields array', () => {
    const entry = normalizeTickler({
      field1: 'addr1', field2: 'amt2', field3: 'cust3', field4: 'wd4', field5: 'extra5',
    });
    const labels = entry.fields.map(f => f.label);
    expect(labels).toEqual(['field1', 'field2', 'field3', 'field4', 'field5']);
    const values = entry.fields.map(f => f.value);
    expect(values).toEqual(['addr1', 'amt2', 'cust3', 'wd4', 'extra5']);
  });

  test('omits null/undefined fields from fields array', () => {
    const entry = normalizeTickler({ field1: 'a', field3: 'c' });
    expect(entry.fields).toHaveLength(2);
    expect(entry.fields[0]).toEqual({ label: 'field1', value: 'a' });
    expect(entry.fields[1]).toEqual({ label: 'field3', value: 'c' });
  });

  test('details string joins all present fields with ·', () => {
    const entry = normalizeTickler({ field1: 'A', field2: 'B', field5: 'E' });
    expect(entry.details).toBe('A · B · E');
  });

  test('details is empty string when no fields', () => {
    const entry = normalizeTickler({});
    expect(entry.details).toBe('');
  });

  test('field5 is included in details string', () => {
    const entry = normalizeTickler({ field5: 'only-five' });
    expect(entry.details).toBe('only-five');
    expect(entry.fields[0]).toEqual({ label: 'field5', value: 'only-five' });
  });
});

describe('normalizeTickler — hasFields / hasExpandable', () => {
  test('hasFields is true when any field is present', () => {
    expect(normalizeTickler({ field1: 'x' }).hasFields).toBe(true);
    expect(normalizeTickler({ field5: 'x' }).hasFields).toBe(true);
  });

  test('hasFields is false when no fields present', () => {
    expect(normalizeTickler({}).hasFields).toBe(false);
  });

  test('hasExpandable is true when only fields present (no JSON diff)', () => {
    const entry = normalizeTickler({ field1: 'x' });
    expect(entry.hasExpandable).toBe(true);
    expect(entry.hasDiff).toBe(false);
  });

  test('hasExpandable is true when only JSON diff present (no fields)', () => {
    const entry = normalizeTickler({ new_value: JSON.stringify({ id: 1 }) });
    expect(entry.hasExpandable).toBe(true);
    expect(entry.hasFields).toBe(false);
  });

  test('hasExpandable is false when no fields and no diff', () => {
    expect(normalizeTickler({}).hasExpandable).toBe(false);
  });
});

describe('normalizeTickler — diff (prev/new JSON)', () => {
  test('hasPrev is true when prev_value is valid JSON', () => {
    const entry = normalizeTickler({ prev_value: JSON.stringify({ a: 1 }) });
    expect(entry.hasPrev).toBe(true);
    expect(entry.prevJson).toContain('"a"');
  });

  test('hasNew is true when new_value is valid JSON', () => {
    const entry = normalizeTickler({ new_value: JSON.stringify({ b: 2 }) });
    expect(entry.hasNew).toBe(true);
    expect(entry.newJson).toContain('"b"');
  });

  test('hasDiff is false when neither prev nor new present', () => {
    expect(normalizeTickler({}).hasDiff).toBe(false);
  });

  test('hasDiff is true when only new_value present', () => {
    expect(normalizeTickler({ new_value: '{}' }).hasDiff).toBe(true);
  });
});

describe('normalizeTickler — category / subcategory / entityId', () => {
  test('categoryLabel replaces underscores with spaces', () => {
    expect(normalizeTickler({ category: 'withdrawal_batch' }).categoryLabel).toBe('withdrawal batch');
  });

  test('subcategoryLabel replaces underscores with spaces', () => {
    expect(normalizeTickler({ subcategory: 'internal_transfer' }).subcategoryLabel).toBe('internal transfer');
  });

  test('entityIdShort truncates long ids', () => {
    // shortId truncates when length > 22
    const longId = 'dep_0123456789abcdef_xyz';
    const entry = normalizeTickler({ entity_id: longId });
    expect(entry.entityIdShort.length).toBeLessThan(longId.length);
    expect(entry.entityId).toBe(longId);
  });

  test('entityIdShort shows full id when short', () => {
    expect(normalizeTickler({ entity_id: 'short' }).entityIdShort).toBe('short');
  });
});

describe('normalizeTickler — toggleExpand', () => {
  test('expanded starts false', () => {
    expect(normalizeTickler({}).expanded).toBe(false);
  });

  test('toggleExpand flips expanded', () => {
    const entry = normalizeTickler({ field1: 'x' });
    entry.toggleExpand({ preventDefault: jest.fn() });
    expect(entry.expanded).toBe(true);
    entry.toggleExpand({ preventDefault: jest.fn() });
    expect(entry.expanded).toBe(false);
  });

  test('toggleExpand accepts missing event arg', () => {
    const entry = normalizeTickler({});
    expect(() => entry.toggleExpand()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createController — integration with API mock
// ---------------------------------------------------------------------------

function makeCtrl(apiOverrides = {}, { noTenant = false } = {}) {
  if (!noTenant) sessionStorage.setItem('chain_api_tenant_key', 'test-key');
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  return { ctrl: createController({ api, router }), api };
}

afterEach(() => sessionStorage.clear());

describe('AuditLogsView — createController initial state', () => {
  test('entries is empty initially', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.entries).toEqual([]);
    expect(ctrl.itemsEmpty).toBe(true);
  });

  test('noActiveTenant is false when tenant key present', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.noActiveTenant).toBe(false);
  });

  test('noActiveTenant is true when no tenant key', () => {
    const { ctrl } = makeCtrl({}, { noTenant: true });
    expect(ctrl.noActiveTenant).toBe(true);
  });
});

describe('AuditLogsView — load()', () => {
  const SAMPLE_TICKLER = {
    id: 'tck_001',
    category: 'deposit',
    subcategory: 'internal_transfer',
    entity_id: 'dep_abc123',
    actor_login: 'customer:cust_x',
    field1: 'bc1qaddr',
    field2: '80000',
    field3: 'cust_recipient',
    field4: 'wd_sender_id',
    field5: 'extra_info',
    occurred_at: '2026-05-30T10:00:00.000Z',
  };

  test('maps API response to normalized entries', async () => {
    const { ctrl } = makeCtrl({
      getTicklers: jest.fn().mockResolvedValue({
        data: [SAMPLE_TICKLER],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.entries).toHaveLength(1);
    expect(ctrl.itemsEmpty).toBe(false);
  });

  test('entry includes all 5 fields', async () => {
    const { ctrl } = makeCtrl({
      getTicklers: jest.fn().mockResolvedValue({
        data: [SAMPLE_TICKLER],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    const labels = ctrl.entries[0].fields.map(f => f.label);
    expect(labels).toContain('field5');
    expect(ctrl.entries[0].fields).toHaveLength(5);
  });

  test('entry details string includes field5 value', async () => {
    const { ctrl } = makeCtrl({
      getTicklers: jest.fn().mockResolvedValue({
        data: [SAMPLE_TICKLER],
        pagination: { nextCursor: null },
      }),
    });
    await ctrl.load();
    expect(ctrl.entries[0].details).toContain('extra_info');
  });

  test('sets error on API failure', async () => {
    const { ctrl } = makeCtrl({
      getTicklers: jest.fn().mockRejectedValue(new Error('timeout')),
    });
    await ctrl.load();
    expect(ctrl.error).toBe('timeout');
    expect(ctrl.loading).toBe(false);
  });

  test('sets itemsEmpty=true when list is empty', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.itemsEmpty).toBe(true);
  });
});

describe('AuditLogsView — search / clear', () => {
  test('onSearch resets cursor and triggers reload with filters', async () => {
    const getTicklers = jest.fn().mockResolvedValue({ data: [], pagination: {} });
    const { ctrl } = makeCtrl({ getTicklers });
    // Simulate FilterPanel emitting parsed filters to the view's onSearch callback
    ctrl._activeFilters = { category: 'deposit' };
    ctrl._cursor = undefined;
    await ctrl.load();
    expect(getTicklers).toHaveBeenCalledWith(expect.objectContaining({ category: 'deposit' }));
  });

  test('onClear resets active filters and reloads', async () => {
    const getTicklers = jest.fn().mockResolvedValue({ data: [], pagination: {} });
    const { ctrl } = makeCtrl({ getTicklers });
    ctrl._activeFilters = { category: 'deposit' };
    await ctrl.load();
    ctrl.auditLogSearchForm.onClear({ preventDefault: jest.fn() });
    await new Promise(r => setTimeout(r, 0));
    const lastCall = getTicklers.mock.calls[getTicklers.mock.calls.length - 1][0];
    expect(lastCall.category).toBeUndefined();
  });
});
