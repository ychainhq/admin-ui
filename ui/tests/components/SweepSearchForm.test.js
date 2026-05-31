import { createSweepSearchFormController } from '../../src/components/SweepSearchForm.js';

function setup(overrides = {}) {
  const onSearch = jest.fn();
  const onClear = jest.fn();
  const ctrl = createSweepSearchFormController({ onSearch, onClear, ...overrides });
  return { ctrl, onSearch, onClear };
}

describe('createSweepSearchFormController — initial state', () => {
  test('all form fields start empty', () => {
    const { ctrl } = setup();
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('has status field', () => {
    const { ctrl } = setup();
    expect('status' in ctrl._form).toBe(true);
  });

  test('has amount and date fields', () => {
    const { ctrl } = setup();
    expect('amountGt' in ctrl._form).toBe(true);
    expect('amountLt' in ctrl._form).toBe(true);
    expect('createdFrom' in ctrl._form).toBe(true);
    expect('createdTo' in ctrl._form).toBe(true);
  });

  test('status optionSet first option is All statuses', () => {
    const { ctrl } = setup();
    expect(ctrl.optionSets.status[0].value).toBe('');
    expect(ctrl.optionSets.status[0].label).toBe('All statuses');
  });

  test('status optionSet contains all 4 sweep statuses', () => {
    const { ctrl } = setup();
    const values = ctrl.optionSets.status.map(o => o.value).filter(Boolean);
    expect(values).toEqual(expect.arrayContaining([
      'pending_signature', 'broadcast', 'confirmed', 'failed',
    ]));
  });

  test('core section is expanded by default', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.core.expanded).toBe(true);
  });

  test('advanced section is collapsed by default', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.advanced.expanded).toBe(false);
  });
});

describe('createSweepSearchFormController — search', () => {
  test('onSearch passes status filter', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Broadcast', selectedIndex: 2 } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ status: 'broadcast' }));
  });

  test('onSearch passes undefined for unset fields', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onSearch({ preventDefault: jest.fn() });
    const filters = onSearch.mock.calls[0][0];
    expect(filters.status).toBeUndefined();
    expect(filters.amountGt).toBeUndefined();
  });
});

describe('createSweepSearchFormController — clear', () => {
  test('onClear resets fields and calls callback', () => {
    const { ctrl, onClear } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Confirmed', selectedIndex: 3 } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl._form.status).toBe('');
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('onClear resets activeCount on core section', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Failed', selectedIndex: 4 } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl.sections.core.activeCount).toBe(0);
  });
});
