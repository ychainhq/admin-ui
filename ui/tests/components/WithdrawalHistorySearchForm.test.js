import { createWithdrawalHistorySearchFormController } from '../../src/components/WithdrawalHistorySearchForm.js';

function setup(overrides = {}) {
  const onSearch = jest.fn();
  const onClear = jest.fn();
  const ctrl = createWithdrawalHistorySearchFormController({ onSearch, onClear, ...overrides });
  return { ctrl, onSearch, onClear };
}

describe('createWithdrawalHistorySearchFormController', () => {

  // ─── initial state ──────────────────────────────────────────────────────────
  test('all form fields start empty', () => {
    const { ctrl } = setup();
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('has status and toAddress fields', () => {
    const { ctrl } = setup();
    expect('status' in ctrl._form).toBe(true);
    expect('toAddress' in ctrl._form).toBe(true);
  });

  test('status optionSet first option is All statuses', () => {
    const { ctrl } = setup();
    expect(ctrl.optionSets.status[0].value).toBe('');
    expect(ctrl.optionSets.status[0].label).toBe('All statuses');
  });

  test('status optionSet contains all 7 withdrawal statuses', () => {
    const { ctrl } = setup();
    const values = ctrl.optionSets.status.map(o => o.value).filter(Boolean);
    expect(values).toEqual(expect.arrayContaining([
      'queued', 'pending_approval', 'pending_signature',
      'broadcast', 'confirmed', 'failed', 'cancelled',
    ]));
  });

  test('core section is expanded by default', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.core.expanded).toBe(true);
  });

  // ─── search ─────────────────────────────────────────────────────────────────
  test('onSearch passes status filter', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Queued', selectedIndex: 1 } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ status: 'queued' }));
  });

  test('onSearch passes toAddress filter', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'toAddress', value: 'bcrt1qtest' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ toAddress: 'bcrt1qtest' }));
  });

  test('onSearch trims whitespace from toAddress', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'toAddress', value: '  bcrt1qtest  ' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch.mock.calls[0][0].toAddress).toBe('bcrt1qtest');
  });

  test('onSearch passes undefined for unset fields', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onSearch({ preventDefault: jest.fn() });
    const filters = onSearch.mock.calls[0][0];
    expect(filters.status).toBeUndefined();
    expect(filters.toAddress).toBeUndefined();
  });

  // ─── clear ──────────────────────────────────────────────────────────────────
  test('onClear resets fields and calls callback', () => {
    const { ctrl, onClear } = setup();
    ctrl.onFormInput({ target: { name: 'toAddress', value: 'bcrt1qtest' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl._form.toAddress).toBe('');
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('onClear resets activeCount', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'toAddress', value: 'bcrt1qtest' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl.sections.core.activeCount).toBe(0);
  });
});
