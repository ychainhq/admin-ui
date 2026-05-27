import { createController } from '../../src/views/CustomerProfileView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const CUSTOMER = { customerId: 'cust_x', reference: 'ref-x', status: 'active', createdAt: '2026-01-01T00:00:00Z' };

const NATURAL_PROFILE = {
  person_type: 'individual',
  given_name: 'Jan', family_name: 'Kowalski',
  date_of_birth: '1985-03-15',
  nationalities: ['PL', 'DE'],
  country_of_residence: 'PL',
  occupation: 'Engineer',
};

const LEGAL_PROFILE = {
  entity_subtype: 'company',
  legal_name: 'Acme Sp. z o.o.',
  country_of_incorporation: 'PL',
  date_of_incorporation: '2010-01-01',
  regulated: false,
};

const IDENTIFIERS = { data: [
  { type: 'passport', value: 'AB1234567', issuing_country: 'PL', valid_until: '2030-12-31' },
] };

const CONTACT = {
  email: 'jan@example.com', phone: '+48600100200',
  email_verified: true, phone_verified: false,
  addresses: [{ type: 'residential', line1: 'ul. Marszałkowska 1', city: 'Warszawa', postal_code: '00-001', country: 'PL', is_primary: true }],
};

function setup({ profileData = null, idsData = { data: [] }, contactData = null, ...apiOverrides } = {}) {
  sessionStorage.setItem('chain_api_tenant_key', 'test-key');
  const api = makeMockApi({
    getCustomer:          jest.fn().mockResolvedValue(CUSTOMER),
    getCustomerProfile:   jest.fn().mockResolvedValue(profileData),
    getCustomerIdentifiers: jest.fn().mockResolvedValue(idsData),
    getCustomerContact:   jest.fn().mockResolvedValue(contactData),
    disableCustomer:      jest.fn().mockResolvedValue({ ...CUSTOMER, status: 'disabled' }),
    ...apiOverrides,
  });
  const router = makeRouter();
  const ctrl = createController({ api, router, id: 'cust_x' });
  return { ctrl, api, router };
}

afterEach(() => sessionStorage.clear());

describe('CustomerProfileView — createController', () => {
  test('initial state: loading false, no error', () => {
    const { ctrl } = setup();
    expect(ctrl.loading).toBe(false);
    expect(ctrl.error).toBeNull();
  });

  test('noActiveTenant false when key is set', () => {
    const { ctrl } = setup();
    expect(ctrl.noActiveTenant).toBe(false);
  });

  test('noActiveTenant true when no key', () => {
    sessionStorage.clear();
    const api = makeMockApi();
    const ctrl = createController({ api, router: makeRouter(), id: 'cust_x' });
    expect(ctrl.noActiveTenant).toBe(true);
  });

  test('header starts loading', () => {
    const { ctrl } = setup();
    expect(ctrl.header.loading).toBe(true);
  });

  test('header activeTab is profile', () => {
    const { ctrl } = setup();
    const profileTab = ctrl.header.tabs.find(t => t.key === 'profile');
    expect(profileTab.tabClass).toContain('border-secondary');
  });

  test('init() skips load when noActiveTenant', async () => {
    sessionStorage.clear();
    const api = makeMockApi();
    const ctrl = createController({ api, router: makeRouter(), id: 'cust_x' });
    await ctrl.init();
    expect(api.getCustomer).not.toHaveBeenCalled();
  });

  test('init() calls load when tenant active', async () => {
    const { ctrl, api } = setup();
    await ctrl.init();
    expect(api.getCustomer).toHaveBeenCalledWith('cust_x');
  });

  test('load() sets header customer data', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.header.loading).toBe(false);
    expect(ctrl.header.statusLabel).toBe('ACTIVE');
  });

  test('profile.notSet=true when no profile data (null)', async () => {
    const { ctrl } = setup({ profileData: null });
    await ctrl.load();
    expect(ctrl.profile.notSet).toBe(true);
  });

  test('profile.notSet=true when API returns 404', async () => {
    const { ctrl } = setup({
      getCustomerProfile: jest.fn().mockRejectedValue(new Error('HTTP 404')),
    });
    await ctrl.load();
    expect(ctrl.profile.notSet).toBe(true);
  });

  test('natural person profile sets isNaturalPerson=true', async () => {
    const { ctrl } = setup({ profileData: NATURAL_PROFILE });
    await ctrl.load();
    expect(ctrl.profile.isNaturalPerson).toBe(true);
    expect(ctrl.profile.notSet).toBe(false);
  });

  test('natural person profile maps given_name', async () => {
    const { ctrl } = setup({ profileData: NATURAL_PROFILE });
    await ctrl.load();
    expect(ctrl.profile.givenName).toBe('Jan');
    expect(ctrl.profile.familyName).toBe('Kowalski');
  });

  test('natural person profile joins nationalities', async () => {
    const { ctrl } = setup({ profileData: NATURAL_PROFILE });
    await ctrl.load();
    expect(ctrl.profile.nationalities).toBe('PL, DE');
  });

  test('legal entity profile sets isNaturalPerson=false', async () => {
    const { ctrl } = setup({ profileData: LEGAL_PROFILE });
    await ctrl.load();
    expect(ctrl.profile.isNaturalPerson).toBe(false);
    expect(ctrl.profile.legalName).toBe('Acme Sp. z o.o.');
  });

  test('identifiers are mapped correctly', async () => {
    const { ctrl } = setup({ idsData: IDENTIFIERS });
    await ctrl.load();
    expect(ctrl.identifiers).toHaveLength(1);
    expect(ctrl.identifiers[0].type).toBe('passport');
    expect(ctrl.identifiers[0].value).toBe('AB1234567');
    expect(ctrl.identifiersEmpty).toBe(false);
  });

  test('identifiersEmpty=true when no identifiers', async () => {
    const { ctrl } = setup({ idsData: { data: [] } });
    await ctrl.load();
    expect(ctrl.identifiersEmpty).toBe(true);
  });

  test('contact maps email and phone', async () => {
    const { ctrl } = setup({ contactData: CONTACT });
    await ctrl.load();
    expect(ctrl.contact.notSet).toBe(false);
    expect(ctrl.contact.email).toBe('jan@example.com');
    expect(ctrl.contact.emailVerified).toBe(true);
    expect(ctrl.contact.phoneVerified).toBe(false);
  });

  test('contact maps addresses', async () => {
    const { ctrl } = setup({ contactData: CONTACT });
    await ctrl.load();
    expect(ctrl.contact.addresses).toHaveLength(1);
    expect(ctrl.contact.addresses[0].line1).toBe('ul. Marszałkowska 1');
    expect(ctrl.contact.addresses[0].isPrimary).toBe(true);
    expect(ctrl.contact.hasAddresses).toBe(true);
  });

  test('contact.notSet=true when null', async () => {
    const { ctrl } = setup({ contactData: null });
    await ctrl.load();
    expect(ctrl.contact.notSet).toBe(true);
  });

  test('load() sets error on API failure', async () => {
    const { ctrl } = setup({ getCustomer: jest.fn().mockRejectedValue(new Error('fail')) });
    await ctrl.load();
    expect(ctrl.error).toBe('fail');
    expect(ctrl.loading).toBe(false);
  });

  test('disableCustomer() updates header state', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    await ctrl.disableCustomer();
    expect(ctrl.header.canDisable).toBe(false);
    expect(ctrl.header.statusLabel).toBe('DISABLED');
  });

  test('disableCustomer() sets error on API failure', async () => {
    const { ctrl } = setup({ disableCustomer: jest.fn().mockRejectedValue(new Error('disable fail')) });
    await ctrl.load();
    await ctrl.disableCustomer();
    expect(ctrl.error).toBe('disable fail');
  });

  test('goToCustomers() navigates to /customers', () => {
    const { ctrl, router } = setup();
    const e = { preventDefault: jest.fn() };
    ctrl.goToCustomers(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('#/customers');
  });

  test('goToCustomer() navigates to customer profile', () => {
    const { ctrl, router } = setup();
    const e = { preventDefault: jest.fn() };
    ctrl.goToCustomer(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith('#/customers/cust_x/profile');
  });

});
