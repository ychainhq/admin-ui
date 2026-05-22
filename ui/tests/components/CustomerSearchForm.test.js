import { createCustomerSearchFormController } from '../../src/components/CustomerSearchForm.js';

function setup(overrides = {}) {
  const onSearch = jest.fn();
  const onClear = jest.fn();
  const ctrl = createCustomerSearchFormController({ onSearch, onClear, ...overrides });
  return { ctrl, onSearch, onClear };
}

describe('createCustomerSearchFormController', () => {

  // --- initial state ---

  test('all _form fields start as empty strings', () => {
    const { ctrl } = setup();
    const fields = Object.values(ctrl._form);
    expect(fields.every(v => v === '')).toBe(true);
  });

  test('statusFilters first option is "All statuses"', () => {
    const { ctrl } = setup();
    expect(ctrl.statusFilters[0].value).toBe('');
    expect(ctrl.statusFilters[0].label).toBe('All statuses');
  });

  test('statusFilters has 9 entries (all + 8 statuses)', () => {
    const { ctrl } = setup();
    expect(ctrl.statusFilters).toHaveLength(9);
  });

  test('partyTypeFilters has 3 entries', () => {
    const { ctrl } = setup();
    expect(ctrl.partyTypeFilters).toHaveLength(3);
  });

  test('identifierTypes includes passport, tax_id, other', () => {
    const { ctrl } = setup();
    const values = ctrl.identifierTypes.map(t => t.value);
    expect(values).toContain('passport');
    expect(values).toContain('tax_id');
    expect(values).toContain('other');
  });

  // --- onFormInput ---

  test('onFormInput updates _form[name] with the input value', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'reference', value: 'REF-001' } });
    expect(ctrl._form.reference).toBe('REF-001');
  });

  test('onFormInput updates nested fields by name', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'profile_given_name', value: 'Jan' } });
    expect(ctrl._form.profile_given_name).toBe('Jan');
  });

  test('onFormInput is a no-op when target has no name', () => {
    const { ctrl } = setup();
    expect(() => ctrl.onFormInput({ target: { name: '', value: 'x' } })).not.toThrow();
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  // --- onSearch: filter derivation ---

  test('onSearch calls onSearch callback', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  test('onSearch passes set fields to callback', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'reference', value: 'REF-001' } });
    ctrl.onFormInput({ target: { name: 'status', value: 'active' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({
      reference: 'REF-001',
      status: 'active',
    }));
  });

  test('onSearch passes undefined for empty fields', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'reference', value: 'REF-001' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    const filters = onSearch.mock.calls[0][0];
    expect(filters.status).toBeUndefined();
    expect(filters.party_type).toBeUndefined();
  });

  test('onSearch trims whitespace', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'reference', value: '  REF-001  ' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ reference: 'REF-001' }));
  });

  test('onSearch uppercases country_of_origin', () => {
    const { ctrl, onSearch } = setup();
    ctrl.onFormInput({ target: { name: 'country_of_origin', value: 'pl' } });
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ country_of_origin: 'PL' }));
  });

  test('onSearch calls preventDefault on event', () => {
    const { ctrl } = setup();
    const e = { preventDefault: jest.fn() };
    ctrl.onSearch(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('onSearch works without event argument', () => {
    const { ctrl, onSearch } = setup();
    expect(() => ctrl.onSearch()).not.toThrow();
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  test('onSearch passes all 17 filter fields', () => {
    const { ctrl, onSearch } = setup();
    const fields = {
      id: 'cust_abc', reference: 'REF', display_name: 'Jan', status: 'active',
      party_type: 'natural_person', country_of_origin: 'PL',
      profile_given_name: 'Jan', profile_family_name: 'Kowalski',
      profile_middle_name: 'Adam', profile_business_name: 'Acme',
      contact_email: 'jan@x.com', contact_phone: '+48123',
      identifier_type: 'passport', identifier_value: 'AB1',
      rel_display_name: 'Hans', rel_identifier_type: 'passport', rel_identifier_value: 'DE1',
    };
    Object.entries(fields).forEach(([name, value]) =>
      ctrl.onFormInput({ target: { name, value } })
    );
    ctrl.onSearch({ preventDefault: jest.fn() });
    expect(onSearch).toHaveBeenCalledWith(expect.objectContaining(fields));
  });

  // --- onClear ---

  test('onClear calls onClear callback', () => {
    const { ctrl, onClear } = setup();
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  test('onClear resets all _form fields to empty string', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'reference', value: 'REF-001' } });
    ctrl.onFormInput({ target: { name: 'profile_given_name', value: 'Jan' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    expect(Object.values(ctrl._form).every(v => v === '')).toBe(true);
  });

  test('onClear calls preventDefault on event', () => {
    const { ctrl } = setup();
    const e = { preventDefault: jest.fn() };
    ctrl.onClear(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('onClear works without event argument', () => {
    const { ctrl, onClear } = setup();
    expect(() => ctrl.onClear()).not.toThrow();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  // --- sections: initial state ---

  test('sections object has all 5 keys', () => {
    const { ctrl } = setup();
    expect(Object.keys(ctrl.sections)).toEqual(['core', 'profile', 'contact', 'identifier', 'relationship']);
  });

  test('sections.core is expanded by default', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.core.expanded).toBe(true);
  });

  test('non-core sections are collapsed by default', () => {
    const { ctrl } = setup();
    expect(ctrl.sections.profile.expanded).toBe(false);
    expect(ctrl.sections.contact.expanded).toBe(false);
    expect(ctrl.sections.identifier.expanded).toBe(false);
    expect(ctrl.sections.relationship.expanded).toBe(false);
  });

  test('all sections start with activeCount 0', () => {
    const { ctrl } = setup();
    const counts = Object.values(ctrl.sections).map(s => s.activeCount);
    expect(counts.every(c => c === 0)).toBe(true);
  });

  // --- sections: toggle ---

  test('toggle() on core section collapses it', () => {
    const { ctrl } = setup();
    ctrl.sections.core.toggle();
    expect(ctrl.sections.core.expanded).toBe(false);
  });

  test('toggle() on collapsed section expands it', () => {
    const { ctrl } = setup();
    ctrl.sections.profile.toggle();
    expect(ctrl.sections.profile.expanded).toBe(true);
  });

  test('toggle() twice returns section to original state', () => {
    const { ctrl } = setup();
    ctrl.sections.profile.toggle();
    ctrl.sections.profile.toggle();
    expect(ctrl.sections.profile.expanded).toBe(false);
  });

  test('toggling one section does not affect others', () => {
    const { ctrl } = setup();
    ctrl.sections.profile.toggle();
    expect(ctrl.sections.contact.expanded).toBe(false);
    expect(ctrl.sections.core.expanded).toBe(true);
  });

  test('toggle() works without event argument', () => {
    const { ctrl } = setup();
    expect(() => ctrl.sections.core.toggle()).not.toThrow();
  });

  // --- sections: activeCount ---

  test('filling a core field increments sections.core.activeCount', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'reference', value: 'REF-001' } });
    expect(ctrl.sections.core.activeCount).toBe(1);
  });

  test('filling two core fields gives sections.core.activeCount of 2', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'reference', value: 'REF-001' } });
    ctrl.onFormInput({ target: { name: 'status', value: 'active' } });
    expect(ctrl.sections.core.activeCount).toBe(2);
  });

  test('filling a profile field increments sections.profile.activeCount, not core', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'profile_given_name', value: 'Jan' } });
    expect(ctrl.sections.profile.activeCount).toBe(1);
    expect(ctrl.sections.core.activeCount).toBe(0);
  });

  test('filling contact field increments sections.contact.activeCount', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'contact_email', value: 'jan@x.com' } });
    expect(ctrl.sections.contact.activeCount).toBe(1);
  });

  test('filling identifier fields increments sections.identifier.activeCount', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'identifier_type', value: 'passport' } });
    ctrl.onFormInput({ target: { name: 'identifier_value', value: 'AB1' } });
    expect(ctrl.sections.identifier.activeCount).toBe(2);
  });

  test('filling relationship field increments sections.relationship.activeCount', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'rel_display_name', value: 'Hans' } });
    expect(ctrl.sections.relationship.activeCount).toBe(1);
  });

  test('clearing a field decrements activeCount', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'reference', value: 'REF-001' } });
    ctrl.onFormInput({ target: { name: 'reference', value: '' } });
    expect(ctrl.sections.core.activeCount).toBe(0);
  });

  test('onClear resets all section activeCount to 0', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'reference', value: 'REF-001' } });
    ctrl.onFormInput({ target: { name: 'profile_given_name', value: 'Jan' } });
    ctrl.onFormInput({ target: { name: 'contact_email', value: 'jan@x.com' } });
    ctrl.onClear({ preventDefault: jest.fn() });
    const counts = Object.values(ctrl.sections).map(s => s.activeCount);
    expect(counts.every(c => c === 0)).toBe(true);
  });

  test('activeCount visible on collapsed section (toggle does not reset count)', () => {
    const { ctrl } = setup();
    ctrl.onFormInput({ target: { name: 'profile_given_name', value: 'Jan' } });
    ctrl.sections.profile.toggle(); // expand
    ctrl.sections.profile.toggle(); // collapse again
    expect(ctrl.sections.profile.activeCount).toBe(1);
  });
});
