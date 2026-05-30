import { createSigningTaskSearchFormController } from '../../src/components/SigningTaskSearchForm.js';

function setup(overrides = {}) {
  const onSearch = jest.fn();
  const onClear = jest.fn();
  const ctrl = createSigningTaskSearchFormController({ onSearch, onClear, ...overrides });
  return { ctrl, onSearch, onClear };
}

describe('createSigningTaskSearchFormController', () => {

  // ─── initial state ──────────────────────────────────────────────────────────
  test('all form fields start empty', () => {
    const { ctrl } = setup();
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('has status and requestType fields', () => {
    const { ctrl } = setup();
    expect('status' in ctrl._form).toBe(true);
    expect('requestType' in ctrl._form).toBe(true);
  });

  test('status optionSet first option is All statuses', () => {
    const { ctrl } = setup();
    expect(ctrl.optionSets.status[0].value).toBe('');
    expect(ctrl.optionSets.status[0].label).toBe('All statuses');
  });

  test('status optionSet contains all task statuses', () => {
    const { ctrl } = setup();
    const values = ctrl.optionSets.status.map(o => o.value).filter(Boolean);
    expect(values).toEqual(expect.arrayContaining([
      'pending_approval', 'claimed', 'signed', 'rejected', 'expired',
    ]));
  });

  test('requestType optionSet first option is All types', () => {
    const { ctrl } = setup();
    expect(ctrl.optionSets.requestType[0].value).toBe('');
    expect(ctrl.optionSets.requestType[0].label).toBe('All types');
  });

  test('requestType optionSet contains btc_withdrawal_batch', () => {
    const { ctrl } = setup();
    const values = ctrl.optionSets.requestType.map(o => o.value).filter(Boolean);
    expect(values).toContain('btc_withdrawal_batch');
  });

  test('core section is expanded by default', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.core.expanded).toBe(true);
  });

  // ─── search ─────────────────────────────────────────────────────────────────
  test('onSearch passes status filter', () => {
    const { ctrl, onSearch } = setup();
    // selectedIndex 2 = 'pending_approval' (0=All, 1=created, 2=pending_approval)
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Pending approval', selectedIndex: 2 } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending_approval' }));
  });

  test('onSearch passes requestType filter', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'requestType', value: 'BTC Withdrawal Batch', selectedIndex: 1 } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ requestType: 'btc_withdrawal_batch' }));
  });

  test('onSearch passes undefined for unset fields', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onSearch({ preventDefault: jest.fn() });
    const filters = onSearch.mock.calls[0][0];
    expect(filters.status).toBeUndefined();
    expect(filters.requestType).toBeUndefined();
  });

  // ─── clear ──────────────────────────────────────────────────────────────────
  test('onClear resets fields and calls callback', () => {
    const { ctrl, onClear } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Signed', selectedIndex: 3 } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl._form.status).toBe('');
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('onClear resets activeCount', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'requestType', value: 'BTC Withdrawal Batch', selectedIndex: 1 } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl.sections.core.activeCount).toBe(0);
  });
});
