import { createController } from '../../src/views/CustomerCreateView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

function setup(apiOverrides = {}) {
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ api, router });
  return { ctrl, api, router };
}

// ── Initial state ──────────────────────────────────────────────────────────────

describe('CustomerCreateView — initial state', () => {
  test('not submitting, no error, no success', () => {
    const { ctrl } = setup();
    expect(ctrl.submitting).toBe(false);
    expect(ctrl.error).toBeNull();
    expect(ctrl.success).toBeNull();
    expect(ctrl.subErrors).toEqual([]);
  });

  test('default party type is natural_person', () => {
    const { ctrl } = setup();
    expect(ctrl._form.party_type).toBe('natural_person');
    expect(ctrl.isNaturalPerson).toBe(true);
    expect(ctrl.isLegalEntity).toBe(false);
  });

  test('all sections collapsed by default', () => {
    const { ctrl } = setup();
    expect(ctrl.profileOpen).toBe(false);
    expect(ctrl.identifierOpen).toBe(false);
    expect(ctrl.documentOpen).toBe(false);
    expect(ctrl.addressOpen).toBe(false);
  });

  test('topBar title is correct', () => {
    const { ctrl } = setup();
    expect(ctrl.topBar.title).toBe('New Customer');
  });

  test('cancel() navigates to /customers', () => {
    const { ctrl, router } = setup();
    ctrl.cancel();
    expect(router.navigate).toHaveBeenCalledWith('#/customers');
  });
});

// ── Party type ─────────────────────────────────────────────────────────────────

describe('CustomerCreateView — party type toggle', () => {
  test('setLegalEntity switches party type', () => {
    const { ctrl } = setup();
    ctrl.setLegalEntity();
    expect(ctrl._form.party_type).toBe('legal_entity');
    expect(ctrl.isLegalEntity).toBe(true);
    expect(ctrl.isNaturalPerson).toBe(false);
  });

  test('setNaturalPerson switches back', () => {
    const { ctrl } = setup();
    ctrl.setLegalEntity();
    ctrl.setNaturalPerson();
    expect(ctrl._form.party_type).toBe('natural_person');
  });
});

// ── Section toggles ────────────────────────────────────────────────────────────

describe('CustomerCreateView — section toggles', () => {
  test('toggleProfile opens and closes profile section', () => {
    const { ctrl } = setup();
    ctrl.toggleProfile();
    expect(ctrl.profileOpen).toBe(true);
    ctrl.toggleProfile();
    expect(ctrl.profileOpen).toBe(false);
  });

  test('chevron label changes when section toggles', () => {
    const { ctrl } = setup();
    expect(ctrl.profileChevron).toBe('expand_more');
    ctrl.toggleProfile();
    expect(ctrl.profileChevron).toBe('expand_less');
    ctrl.toggleProfile();
    expect(ctrl.profileChevron).toBe('expand_more');
  });

  test('toggleIdentifier, toggleDocument, toggleAddress work independently', () => {
    const { ctrl } = setup();
    ctrl.toggleIdentifier();
    ctrl.toggleDocument();
    ctrl.toggleAddress();
    expect(ctrl.identifierOpen).toBe(true);
    expect(ctrl.documentOpen).toBe(true);
    expect(ctrl.addressOpen).toBe(true);
    expect(ctrl.profileOpen).toBe(false);
  });
});

// ── Input handlers ─────────────────────────────────────────────────────────────

describe('CustomerCreateView — input handlers', () => {
  test('onReferenceInput trims and stores value', () => {
    const { ctrl } = setup();
    ctrl.onReferenceInput({ target: { value: '  ref-1  ' } });
    expect(ctrl._form.reference).toBe('ref-1');
  });

  test('onMetadataInput clears metadataError', () => {
    const { ctrl } = setup();
    ctrl.metadataError = 'bad json';
    ctrl.onMetadataInput({ target: { value: '{}' } });
    expect(ctrl.metadataError).toBeNull();
  });

  test('onProfileInput stores field by data-field key', () => {
    const { ctrl } = setup();
    ctrl.onProfileInput({ target: { dataset: { field: 'given_name' }, value: 'Jan' } });
    expect(ctrl._form.given_name).toBe('Jan');
  });

  test('onProfileInput clears profileError', () => {
    const { ctrl } = setup();
    ctrl.profileError = 'required';
    ctrl.onProfileInput({ target: { dataset: { field: 'given_name' }, value: 'Jan' } });
    expect(ctrl.profileError).toBeNull();
  });

  test('onIdentifierTypeChange stores type', () => {
    const { ctrl } = setup();
    ctrl.onIdentifierTypeChange({ target: { value: 'passport' } });
    expect(ctrl._form.identifier_type).toBe('passport');
  });

  test('onDocumentTypeChange stores type', () => {
    const { ctrl } = setup();
    ctrl.onDocumentTypeChange({ target: { value: 'national_id' } });
    expect(ctrl._form.document_type).toBe('national_id');
  });

  test('onAddressTypeChange stores type', () => {
    const { ctrl } = setup();
    ctrl.onAddressTypeChange({ target: { value: 'correspondence' } });
    expect(ctrl._form.address_type).toBe('correspondence');
  });

  test('onAddressInput stores field by data-field key', () => {
    const { ctrl } = setup();
    ctrl.onAddressInput({ target: { dataset: { field: 'city' }, value: 'Warszawa' } });
    expect(ctrl._form.address_city).toBe('Warszawa');
  });
});

// ── Submit — basic ─────────────────────────────────────────────────────────────

describe('CustomerCreateView — submit basic', () => {
  test('submit() with only reference calls createCustomer with party_type and reference', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1', reference: 'ref-1' });
    const { ctrl } = setup({ createCustomer });
    ctrl.onReferenceInput({ target: { value: 'ref-1' } });
    await ctrl.submit();
    expect(createCustomer).toHaveBeenCalledWith({ party_type: 'natural_person', reference: 'ref-1' });
  });

  test('submit() always sends party_type', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const { ctrl } = setup({ createCustomer });
    ctrl.setLegalEntity();
    await ctrl.submit();
    expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ party_type: 'legal_entity' }));
  });

  test('submit() sets success state on create OK', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1', reference: 'ref-1' });
    const { ctrl } = setup({ createCustomer });
    await ctrl.submit();
    expect(ctrl.success).toEqual({ id: 'cust_1', reference: 'ref-1' });
  });

  test('submit() sets error when createCustomer rejects', async () => {
    const { ctrl } = setup({ createCustomer: jest.fn().mockRejectedValue(new Error('500')) });
    await ctrl.submit();
    expect(ctrl.error).toBe('500');
    expect(ctrl.success).toBeNull();
  });

  test('submit() with invalid metadata sets metadataError and does not call API', async () => {
    const createCustomer = jest.fn();
    const { ctrl } = setup({ createCustomer });
    ctrl.onMetadataInput({ target: { value: '{bad}' } });
    await ctrl.submit();
    expect(ctrl.metadataError).toContain('valid JSON');
    expect(createCustomer).not.toHaveBeenCalled();
  });

  test('submitting is false after success', async () => {
    const { ctrl } = setup();
    await ctrl.submit();
    expect(ctrl.submitting).toBe(false);
  });

  test('submitting is false after failure', async () => {
    const { ctrl } = setup({ createCustomer: jest.fn().mockRejectedValue(new Error('fail')) });
    await ctrl.submit();
    expect(ctrl.submitting).toBe(false);
  });
});

// ── Submit — profile (natural person) ─────────────────────────────────────────

describe('CustomerCreateView — submit natural person profile', () => {
  test('calls upsertCustomerProfile when given_name + family_name filled', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const upsertCustomerProfile = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ createCustomer, upsertCustomerProfile });
    ctrl.onProfileInput({ target: { dataset: { field: 'given_name' }, value: 'Jan' } });
    ctrl.onProfileInput({ target: { dataset: { field: 'family_name' }, value: 'Kowalski' } });
    await ctrl.submit();
    expect(upsertCustomerProfile).toHaveBeenCalledWith('cust_1', expect.objectContaining({
      partyType: 'natural_person', person_type: 'individual', given_name: 'Jan', family_name: 'Kowalski',
    }));
  });

  test('does NOT call upsertCustomerProfile when profile fields empty', async () => {
    const upsertCustomerProfile = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ upsertCustomerProfile });
    await ctrl.submit();
    expect(upsertCustomerProfile).not.toHaveBeenCalled();
  });

  test('sets profileError when given_name filled but family_name missing', async () => {
    const createCustomer = jest.fn();
    const { ctrl } = setup({ createCustomer });
    ctrl.onProfileInput({ target: { dataset: { field: 'given_name' }, value: 'Jan' } });
    await ctrl.submit();
    expect(ctrl.profileError).toContain('last name');
    expect(createCustomer).not.toHaveBeenCalled();
  });

  test('includes optional date_of_birth and nationalities when provided', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const upsertCustomerProfile = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ createCustomer, upsertCustomerProfile });
    ctrl.onProfileInput({ target: { dataset: { field: 'given_name' }, value: 'Jan' } });
    ctrl.onProfileInput({ target: { dataset: { field: 'family_name' }, value: 'Kowalski' } });
    ctrl.onProfileInput({ target: { dataset: { field: 'date_of_birth' }, value: '1990-01-01' } });
    ctrl.onProfileInput({ target: { dataset: { field: 'nationality' }, value: 'pl' } });
    await ctrl.submit();
    const payload = upsertCustomerProfile.mock.calls[0][1];
    expect(payload.date_of_birth).toBe('1990-01-01');
    expect(payload.nationalities).toEqual(['PL']);
  });

  test('profile sub-call failure adds to subErrors, not main error', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const upsertCustomerProfile = jest.fn().mockRejectedValue(new Error('422'));
    const { ctrl } = setup({ createCustomer, upsertCustomerProfile });
    ctrl.onProfileInput({ target: { dataset: { field: 'given_name' }, value: 'Jan' } });
    ctrl.onProfileInput({ target: { dataset: { field: 'family_name' }, value: 'Nowak' } });
    await ctrl.submit();
    expect(ctrl.success).not.toBeNull();
    expect(ctrl.subErrors).toEqual(expect.arrayContaining([expect.stringContaining('profile')]));
    expect(ctrl.error).toBeNull();
  });
});

// ── Submit — profile (legal entity) ───────────────────────────────────────────

describe('CustomerCreateView — submit legal entity profile', () => {
  function fillLegalEntity(ctrl) {
    ctrl.setLegalEntity();
    ctrl.onEntitySubtypeChange({ target: { value: 'company' } });
    ctrl.onProfileInput({ target: { dataset: { field: 'legal_name' }, value: 'ACME Sp. z o.o.' } });
    ctrl.onProfileInput({ target: { dataset: { field: 'country_of_incorporation' }, value: 'pl' } });
  }

  test('calls upsertCustomerProfile with legal_entity payload', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const upsertCustomerProfile = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ createCustomer, upsertCustomerProfile });
    fillLegalEntity(ctrl);
    await ctrl.submit();
    expect(upsertCustomerProfile).toHaveBeenCalledWith('cust_1', {
      partyType: 'legal_entity', entity_subtype: 'company',
      legal_name: 'ACME Sp. z o.o.', country_of_incorporation: 'PL',
    });
  });

  test('sets profileError when legal entity fields incomplete', async () => {
    const createCustomer = jest.fn();
    const { ctrl } = setup({ createCustomer });
    ctrl.setLegalEntity();
    ctrl.onProfileInput({ target: { dataset: { field: 'legal_name' }, value: 'ACME' } });
    // missing entity_subtype and country_of_incorporation
    await ctrl.submit();
    expect(ctrl.profileError).toBeTruthy();
    expect(createCustomer).not.toHaveBeenCalled();
  });
});

// ── Submit — identifier ────────────────────────────────────────────────────────

describe('CustomerCreateView — submit identifier', () => {
  test('calls addCustomerIdentifier when type and value filled', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const addCustomerIdentifier = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ createCustomer, addCustomerIdentifier });
    ctrl.onIdentifierTypeChange({ target: { value: 'passport' } });
    ctrl.onIdentifierValueInput({ target: { value: 'AB123' } });
    await ctrl.submit();
    expect(addCustomerIdentifier).toHaveBeenCalledWith('cust_1', { type: 'passport', value: 'AB123' });
  });

  test('does NOT call addCustomerIdentifier when value missing', async () => {
    const addCustomerIdentifier = jest.fn();
    const { ctrl } = setup({ addCustomerIdentifier });
    ctrl.onIdentifierTypeChange({ target: { value: 'passport' } });
    await ctrl.submit();
    expect(addCustomerIdentifier).not.toHaveBeenCalled();
  });
});

// ── Submit — document ──────────────────────────────────────────────────────────

describe('CustomerCreateView — submit document', () => {
  test('calls addCustomerDocument with storage_system manual', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const addCustomerDocument = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ createCustomer, addCustomerDocument });
    ctrl.onDocumentTypeChange({ target: { value: 'passport' } });
    ctrl.onDocumentRefInput({ target: { value: 's3://bucket/doc.pdf' } });
    await ctrl.submit();
    expect(addCustomerDocument).toHaveBeenCalledWith('cust_1', {
      document_type: 'passport', storage_ref: 's3://bucket/doc.pdf', storage_system: 'manual',
    });
  });

  test('does NOT call addCustomerDocument when storage_ref missing', async () => {
    const addCustomerDocument = jest.fn();
    const { ctrl } = setup({ addCustomerDocument });
    ctrl.onDocumentTypeChange({ target: { value: 'passport' } });
    await ctrl.submit();
    expect(addCustomerDocument).not.toHaveBeenCalled();
  });
});

// ── Submit — address ───────────────────────────────────────────────────────────

describe('CustomerCreateView — submit address', () => {
  function fillAddress(ctrl) {
    ctrl.onAddressInput({ target: { dataset: { field: 'line1' }, value: 'ul. Testowa 1' } });
    ctrl.onAddressInput({ target: { dataset: { field: 'city' }, value: 'Warszawa' } });
    ctrl.onAddressInput({ target: { dataset: { field: 'country' }, value: 'pl' } });
  }

  test('calls upsertCustomerContact with address payload', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const upsertCustomerContact = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ createCustomer, upsertCustomerContact });
    fillAddress(ctrl);
    await ctrl.submit();
    expect(upsertCustomerContact).toHaveBeenCalledWith('cust_1', {
      addresses: [{ type: 'registered', line1: 'ul. Testowa 1', city: 'Warszawa', country: 'PL', is_primary: true }],
    });
  });

  test('country is uppercased in address payload', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const upsertCustomerContact = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ createCustomer, upsertCustomerContact });
    fillAddress(ctrl);
    await ctrl.submit();
    const addr = upsertCustomerContact.mock.calls[0][1].addresses[0];
    expect(addr.country).toBe('PL');
  });

  test('does NOT call upsertCustomerContact when address fields missing', async () => {
    const upsertCustomerContact = jest.fn();
    const { ctrl } = setup({ upsertCustomerContact });
    ctrl.onAddressInput({ target: { dataset: { field: 'line1' }, value: 'ul. Testowa 1' } });
    // city and country missing
    await ctrl.submit();
    expect(upsertCustomerContact).not.toHaveBeenCalled();
  });

  test('address type is included in payload', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const upsertCustomerContact = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ createCustomer, upsertCustomerContact });
    ctrl.onAddressTypeChange({ target: { value: 'correspondence' } });
    fillAddress(ctrl);
    await ctrl.submit();
    expect(upsertCustomerContact.mock.calls[0][1].addresses[0].type).toBe('correspondence');
  });
});

// ── Success screen ─────────────────────────────────────────────────────────────

describe('CustomerCreateView — success state', () => {
  test('viewCustomer navigates to customer profile', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_42', reference: 'ref-x' });
    const { ctrl, router } = setup({ createCustomer });
    await ctrl.submit();
    ctrl.viewCustomer();
    expect(router.navigate).toHaveBeenCalledWith('#/customers/cust_42/profile');
  });

  test('createAnother resets success and form', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const { ctrl } = setup({ createCustomer });
    ctrl.onReferenceInput({ target: { value: 'ref-1' } });
    await ctrl.submit();
    expect(ctrl.success).not.toBeNull();
    ctrl.createAnother();
    expect(ctrl.success).toBeNull();
    expect(ctrl._form.reference).toBe('');
    expect(ctrl._form.party_type).toBe('natural_person');
    expect(ctrl.profileOpen).toBe(false);
  });

  test('subErrors collected from failed sub-calls are shown in success state', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ id: 'cust_1' });
    const addCustomerIdentifier = jest.fn().mockRejectedValue(new Error('422'));
    const addCustomerDocument   = jest.fn().mockRejectedValue(new Error('400'));
    const { ctrl } = setup({ createCustomer, addCustomerIdentifier, addCustomerDocument });
    ctrl.onIdentifierTypeChange({ target: { value: 'passport' } });
    ctrl.onIdentifierValueInput({ target: { value: 'X1' } });
    ctrl.onDocumentTypeChange({ target: { value: 'passport' } });
    ctrl.onDocumentRefInput({ target: { value: 'ref' } });
    await ctrl.submit();
    expect(ctrl.success).not.toBeNull();
    expect(ctrl.subErrors).toHaveLength(2);
    expect(ctrl.subErrors[0]).toContain('identifier');
    expect(ctrl.subErrors[1]).toContain('document');
  });
});
