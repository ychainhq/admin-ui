import { createDepositSearchFormController } from '../../src/components/DepositSearchForm.js';

function setup(overrides = {}) {
  const onSearch = jest.fn();
  const onClear = jest.fn();
  const ctrl = createDepositSearchFormController({ onSearch, onClear, ...overrides });
  return { ctrl, onSearch, onClear };
}

describe('createDepositSearchFormController', () => {

  // ─── initial state ──────────────────────────────────────────────────────────
  test('all form fields start empty', () => {
    const { ctrl } = setup();
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('has core fields: depositId, status, assetId', () => {
    const { ctrl } = setup();
    expect('depositId' in ctrl._form).toBe(true);
    expect('status' in ctrl._form).toBe(true);
    expect('assetId' in ctrl._form).toBe(true);
  });

  test('has chain fields: txHash, address, minConfirmations, maxConfirmations', () => {
    const { ctrl } = setup();
    expect('txHash' in ctrl._form).toBe(true);
    expect('address' in ctrl._form).toBe(true);
    expect('minConfirmations' in ctrl._form).toBe(true);
    expect('maxConfirmations' in ctrl._form).toBe(true);
  });

  test('statusFilters first option is All statuses', () => {
    const { ctrl } = setup();
    expect(ctrl.statusFilters[0].value).toBe('');
  });

  test('statusFilters contains all deposit statuses', () => {
    const { ctrl } = setup();
    const values = ctrl.statusFilters.map(o => o.value).filter(Boolean);
    expect(values).toEqual(expect.arrayContaining([
      'detected', 'pending_confirmation', 'confirmed', 'finalized',
    ]));
  });

  test('core section is expanded, chain section is collapsed', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.core.expanded).toBe(true);
    expect(ctrl.sections.chain.expanded).toBe(false);
  });

  // ─── search ─────────────────────────────────────────────────────────────────
  test('onSearch passes depositId', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'depositId', value: 'dep_abc' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ depositId: 'dep_abc' }));
  });

  test('onSearch passes status via select', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Confirmed', selectedIndex: 3 } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed' }));
  });

  test('onSearch normalizes minConfirmations to integer', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'minConfirmations', value: '6' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch.mock.calls[0][0].minConfirmations).toBe(6);
  });

  test('onSearch normalizes maxConfirmations to integer', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'maxConfirmations', value: '110' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch.mock.calls[0][0].maxConfirmations).toBe(110);
  });

  test('onSearch returns undefined for invalid minConfirmations', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'minConfirmations', value: 'abc' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch.mock.calls[0][0].minConfirmations).toBeUndefined();
  });

  test('onSearch passes txHash', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'txHash', value: '958a*' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch.mock.calls[0][0].txHash).toBe('958a*');
  });

  test('onSearch passes undefined for empty fields', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onSearch({ preventDefault: jest.fn() });
    const filters = onSearch.mock.calls[0][0];
    expect(filters.depositId).toBeUndefined();
    expect(filters.status).toBeUndefined();
    expect(filters.minConfirmations).toBeUndefined();
  });

  // ─── clear ──────────────────────────────────────────────────────────────────
  test('onClear resets all fields', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'depositId', value: 'dep_abc' } });
    ctrl.onFormInput({ target: { name: 'txHash', value: '958a*' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('onClear calls callback', () => {
    const { ctrl, onClear } = setup();
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('onClear resets activeCount in both sections', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'depositId', value: 'dep_abc' } });
    ctrl.onFormInput({ target: { name: 'txHash', value: '958a*' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl.sections.core.activeCount).toBe(0);
    expect(ctrl.sections.chain.activeCount).toBe(0);
  });
});
