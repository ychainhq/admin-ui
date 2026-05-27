import { createFilterPanelController } from '../../src/components/FilterPanel.js';

const SIMPLE_CONFIG = {
  bindName: 'testForm',
  title: 'Test Filter',
  sections: [
    {
      key: 'core',
      label: 'Core',
      expanded: true,
      fields: [
        { name: 'status', label: 'Status', type: 'select', options: [
          { value: '', label: 'All' },
          { value: 'active', label: 'Active' },
          { value: 'disabled', label: 'Disabled' },
        ]},
        { name: 'name', label: 'Name', placeholder: 'Search...' },
      ],
    },
    {
      key: 'extra',
      label: 'Extra',
      expanded: false,
      fields: [
        { name: 'ref', label: 'Reference', placeholder: 'ref_...' },
      ],
    },
  ],
};

function setup(configOverride, callbackOverrides = {}) {
  const onSearch = jest.fn();
  const onClear = jest.fn();
  const ctrl = createFilterPanelController(configOverride || SIMPLE_CONFIG, {
    onSearch,
    onClear,
    ...callbackOverrides,
  });
  return { ctrl, onSearch, onClear };
}

// ─── Initial state ─────────────────────────────────────────────────────────────

describe('createFilterPanelController — initial state', () => {
  test('all _form fields start as empty strings', () => {
    const { ctrl } = setup();
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('_form has one key per field across all sections', () => {
    const { ctrl } = setup();
    expect(Object.keys(ctrl._form)).toEqual(['status', 'name', 'ref']);
  });

  test('optionSets contains select field options', () => {
    const { ctrl } = setup();
    expect(ctrl.optionSets.status).toHaveLength(3);
    expect(ctrl.optionSets.status[0].value).toBe('');
    expect(ctrl.optionSets.status[1].value).toBe('active');
  });

  test('optionSets has no entry for text fields', () => {
    const { ctrl } = setup();
    expect(ctrl.optionSets.name).toBeUndefined();
  });

  test('core section is expanded', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.core.expanded).toBe(true);
  });

  test('extra section is collapsed', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.extra.expanded).toBe(false);
  });

  test('all sections start with activeCount 0', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.core.activeCount).toBe(0);
    expect(ctrl.sections.extra.activeCount).toBe(0);
  });
});

// ─── onFormInput ───────────────────────────────────────────────────────────────

describe('createFilterPanelController — onFormInput', () => {
  test('updates _form[name] for text input', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'name', value: 'Acme' } });
    expect(ctrl._form.name).toBe('Acme');
  });

  test('resolves SELECT by selectedIndex into optionSets', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Active', selectedIndex: 1 } });
    expect(ctrl._form.status).toBe('active');
  });

  test('SELECT at index 0 stores empty string', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'All', selectedIndex: 0 } });
    expect(ctrl._form.status).toBe('');
  });

  test('is a no-op when target has no name', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: '', value: 'x' } });
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('increments section activeCount when field becomes non-empty', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'name', value: 'Acme' } });
    expect(ctrl.sections.core.activeCount).toBe(1);
  });

  test('increments activeCount for extra section field', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'ref', value: 'REF-001' } });
    expect(ctrl.sections.extra.activeCount).toBe(1);
    expect(ctrl.sections.core.activeCount).toBe(0);
  });

  test('filling two fields in core gives activeCount 2', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'name', value: 'Acme' } });
    ctrl.onFormInput({ target: { tagName: 'SELECT', name: 'status', value: 'Active', selectedIndex: 1 } });
    expect(ctrl.sections.core.activeCount).toBe(2);
  });

  test('clearing a field decrements activeCount', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'name', value: 'Acme' } });
    ctrl.onFormInput({ target: { name: 'name', value: '' } });
    expect(ctrl.sections.core.activeCount).toBe(0);
  });
});

// ─── onSearch ─────────────────────────────────────────────────────────────────

describe('createFilterPanelController — onSearch', () => {
  test('calls onSearch callback once', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  test('passes set fields, undefined for empty ones', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'name', value: 'Acme' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    const filters = onSearch.mock.calls[0][0];
    expect(filters.name).toBe('Acme');
    expect(filters.status).toBeUndefined();
    expect(filters.ref).toBeUndefined();
  });

  test('trims whitespace from text fields', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'name', value: '  Acme  ' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch.mock.calls[0][0].name).toBe('Acme');
  });

  test('calls preventDefault on event', () => {
    const { ctrl } = setup();
    const e = { preventDefault: jest.fn() };
    ctrl.onSearch(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('works without event argument', () => {
    const { ctrl, onSearch } = setup();
    expect(() => ctrl.onSearch()).not.toThrow();
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  test('respects custom normalize function on field', () => {
    const customConfig = {
      bindName: 'f',
      title: 'T',
      sections: [{
        key: 'core', label: 'Core', expanded: true,
        fields: [
          { name: 'minVal', label: 'Min', normalize: (v) => (v ? Number(v) : undefined) },
        ],
      }],
    };
    const onSearch = jest.fn();
    const ctrl = createFilterPanelController(customConfig, { onSearch, onClear: jest.fn() });
    ctrl.onFormInput({ target: { name: 'minVal', value: '42' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch.mock.calls[0][0].minVal).toBe(42);
  });
});

// ─── onClear ──────────────────────────────────────────────────────────────────

describe('createFilterPanelController — onClear', () => {
  test('calls onClear callback once', () => {
    const { ctrl, onClear } = setup();
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('resets all _form fields to empty string', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'name', value: 'Acme' } });
    ctrl.onFormInput({ target: { name: 'ref', value: 'REF' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('resets all section activeCount to 0', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'name', value: 'Acme' } });
    ctrl.onFormInput({ target: { name: 'ref', value: 'REF' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(ctrl.sections.core.activeCount).toBe(0);
    expect(ctrl.sections.extra.activeCount).toBe(0);
  });

  test('calls preventDefault on event', () => {
    const { ctrl } = setup();
    const e = { preventDefault: jest.fn() };
    ctrl.onClear(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('works without event argument', () => {
    const { ctrl, onClear } = setup();
    expect(() => ctrl.onClear()).not.toThrow();
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

// ─── sections toggle ──────────────────────────────────────────────────────────

describe('createFilterPanelController — sections.toggle', () => {
  test('toggle() collapses an expanded section', () => {
    const { ctrl } = setup();
    ctrl.sections.core.toggle();
    expect(ctrl.sections.core.expanded).toBe(false);
  });

  test('toggle() expands a collapsed section', () => {
    const { ctrl } = setup();
    ctrl.sections.extra.toggle();
    expect(ctrl.sections.extra.expanded).toBe(true);
  });

  test('toggle() twice returns to original state', () => {
    const { ctrl } = setup();
    ctrl.sections.extra.toggle();
    ctrl.sections.extra.toggle();
    expect(ctrl.sections.extra.expanded).toBe(false);
  });

  test('toggling one section does not affect others', () => {
    const { ctrl } = setup();
    ctrl.sections.extra.toggle();
    expect(ctrl.sections.core.expanded).toBe(true);
  });

  test('toggle() works without event argument', () => {
    const { ctrl } = setup();
    expect(() => ctrl.sections.core.toggle()).not.toThrow();
  });

  test('activeCount survives toggle (not reset by collapse/expand)', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'ref', value: 'REF' } });
    ctrl.sections.extra.toggle();
    ctrl.sections.extra.toggle();
    expect(ctrl.sections.extra.activeCount).toBe(1);
  });
});
