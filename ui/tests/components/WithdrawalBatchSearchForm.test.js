import { createWithdrawalBatchSearchFormController } from '../../src/components/WithdrawalBatchSearchForm.js';

function setup(overrides = {}) {
  const onSearch = jest.fn();
  const onClear = jest.fn();
  const ctrl = createWithdrawalBatchSearchFormController({ onSearch, onClear, ...overrides });
  return { ctrl, onSearch, onClear };
}

describe('createWithdrawalBatchSearchFormController', () => {

  // ─── initial state ──────────────────────────────────────────────────────────
  test('all form fields start empty', () => {
    const { ctrl } = setup();
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('has status and chainId fields', () => {
    const { ctrl } = setup();
    expect('status' in ctrl._form).toBe(true);
    expect('chainId' in ctrl._form).toBe(true);
  });

  test('status optionSet first option is All statuses', () => {
    const { ctrl } = setup();
    expect(ctrl.optionSets.status[0].value).toBe('');
    expect(ctrl.optionSets.status[0].label).toBe('All statuses');
  });

  test('status optionSet contains all 7 batch statuses', () => {
    const { ctrl } = setup();
    const values = ctrl.optionSets.status.map(o => o.value).filter(Boolean);
    expect(values).toEqual(expect.arrayContaining([
      'building', 'pending_approval', 'pending_signature',
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
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Building', selectedIndex: 1 } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ status: 'building' }));
  });

  test('onSearch passes chainId filter', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'chainId', value: 'bitcoin' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ chainId: 'bitcoin' }));
  });

  test('onSearch passes undefined for unset fields', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onSearch({ preventDefault: jest.fn() });
    const filters = onSearch.mock.calls[0][0];
    expect(filters.status).toBeUndefined();
    expect(filters.chainId).toBeUndefined();
  });

  // ─── clear ──────────────────────────────────────────────────────────────────
  test('onClear resets fields and calls callback', () => {
    const { ctrl, onClear } = setup();
    ctrl.onFormInput({ target: { name: 'chainId', value: 'bitcoin' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl._form.chainId).toBe('');
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('onClear resets activeCount', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'chainId', value: 'bitcoin' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl.sections.core.activeCount).toBe(0);
  });
});
