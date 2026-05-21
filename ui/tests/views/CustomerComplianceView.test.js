import { createController } from '../../src/views/CustomerComplianceView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const CUSTOMER = { customerId: 'cust_x', reference: '', status: 'active', createdAt: '2026-01-01T00:00:00Z' };

const AML = {
  kyc_status: 'approved', kyc_verified_at: '2026-01-10T00:00:00Z',
  kyc_provider: 'Jumio', cdd_level: 'standard',
  aml_risk_level: 'low', pep_status: 'not_pep', sanctions_status: 'clear',
  source_of_funds: ['employment', 'business'],
  expected_monthly_volume: '50000000',
};

const RELATIONSHIPS = { data: [
  { relationship_type: 'ubo', external_party: { legal_name: 'Big Boss', identifier_type: 'passport', identifier_value: 'XX999', country: 'PL' }, ownership_percent: 51, is_controlling: true, notes: 'verified' },
] };

const DOCUMENTS = { data: [
  { document_type: 'passport', document_number: 'AB123', issuing_country: 'PL', expiry_date: '2030-12-31', uploaded_by: 'compliance', file_hash: 'sha256:abc1234567890abc' },
] };

function setup(overrides = {}) {
  sessionStorage.setItem('chain_api_tenant_key', 'test-key');
  const api = makeMockApi({
    getCustomer:              jest.fn().mockResolvedValue(CUSTOMER),
    getCustomerAmlKyc:        jest.fn().mockResolvedValue(null),
    getCustomerRelationships: jest.fn().mockResolvedValue({ data: [] }),
    getCustomerDocuments:     jest.fn().mockResolvedValue({ data: [] }),
    disableCustomer:          jest.fn().mockResolvedValue({ ...CUSTOMER, status: 'disabled' }),
    ...overrides,
  });
  const router = makeRouter();
  const ctrl = createController({ api, router, id: 'cust_x' });
  return { ctrl, api, router };
}

afterEach(() => sessionStorage.clear());

describe('CustomerComplianceView — createController', () => {
  test('initial state: no error, not loading', () => {
    const { ctrl } = setup();
    expect(ctrl.error).toBeNull();
    expect(ctrl.loading).toBe(false);
  });

  test('header activeTab is compliance', () => {
    const { ctrl } = setup();
    expect(ctrl.header.tabs.find(t => t.key === 'compliance').tabClass).toContain('border-secondary');
  });

  test('aml.notSet=true when API returns null', async () => {
    const { ctrl } = setup({ getCustomerAmlKyc: jest.fn().mockResolvedValue(null) });
    await ctrl.load();
    expect(ctrl.aml.notSet).toBe(true);
  });

  test('aml.notSet=true when 404', async () => {
    const { ctrl } = setup({ getCustomerAmlKyc: jest.fn().mockRejectedValue(new Error('HTTP 404')) });
    await ctrl.load();
    expect(ctrl.aml.notSet).toBe(true);
  });

  test('aml fields are mapped correctly', async () => {
    const { ctrl } = setup({ getCustomerAmlKyc: jest.fn().mockResolvedValue(AML) });
    await ctrl.load();
    expect(ctrl.aml.notSet).toBe(false);
    expect(ctrl.aml.kycStatus).toBe('APPROVED');
    expect(ctrl.aml.riskLevel).toBe('LOW');
    expect(ctrl.aml.pepStatus).toBe('NOT PEP');
    expect(ctrl.aml.sanctionsStatus).toBe('CLEAR');
    expect(ctrl.aml.sourceOfFunds).toBe('employment, business');
    expect(ctrl.aml.kycProvider).toBe('Jumio');
  });

  test('aml risk badge class uses tertiary for low', async () => {
    const { ctrl } = setup({ getCustomerAmlKyc: jest.fn().mockResolvedValue(AML) });
    await ctrl.load();
    expect(ctrl.aml.riskBadgeClass).toContain('tertiary');
  });

  test('aml risk badge class uses error for high', async () => {
    const { ctrl } = setup({ getCustomerAmlKyc: jest.fn().mockResolvedValue({ ...AML, aml_risk_level: 'high' }) });
    await ctrl.load();
    expect(ctrl.aml.riskBadgeClass).toContain('error');
  });

  test('relationshipsEmpty=true when empty list', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.relationshipsEmpty).toBe(true);
  });

  test('relationships are mapped correctly', async () => {
    const { ctrl } = setup({ getCustomerRelationships: jest.fn().mockResolvedValue(RELATIONSHIPS) });
    await ctrl.load();
    expect(ctrl.relationships).toHaveLength(1);
    expect(ctrl.relationships[0].legalName).toBe('Big Boss');
    expect(ctrl.relationships[0].typeLabel).toBe('UBO');
    expect(ctrl.relationships[0].ownershipPercent).toBe('51');
    expect(ctrl.relationships[0].isControlling).toBe(true);
    expect(ctrl.relationshipsEmpty).toBe(false);
  });

  test('documentsEmpty=true when empty list', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.documentsEmpty).toBe(true);
  });

  test('documents are mapped correctly', async () => {
    const { ctrl } = setup({ getCustomerDocuments: jest.fn().mockResolvedValue(DOCUMENTS) });
    await ctrl.load();
    expect(ctrl.documents).toHaveLength(1);
    expect(ctrl.documents[0].type).toBe('passport');
    expect(ctrl.documents[0].number).toBe('AB123');
    expect(ctrl.documents[0].hashShort).toContain('…');
    expect(ctrl.documentsEmpty).toBe(false);
  });

  test('load() sets header customer', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.header.loading).toBe(false);
  });

  test('load() sets error on API failure', async () => {
    const { ctrl } = setup({ getCustomer: jest.fn().mockRejectedValue(new Error('err')) });
    await ctrl.load();
    expect(ctrl.error).toBe('err');
  });

  test('disableCustomer() updates header', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    await ctrl.disableCustomer();
    expect(ctrl.header.canDisable).toBe(false);
  });
});
