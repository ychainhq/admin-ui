import { createController } from '../../src/views/CustomerGovernanceView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const CUSTOMER = { customerId: 'cust_x', status: 'active', createdAt: '2026-01-01T00:00:00Z' };

const GOV = {
  data_classification: 'confidential',
  lawful_basis: 'legal_obligation',
  retention_policy: '5y_after_offboarding',
  masking_required: true,
  encryption_required: true,
};

function setup(overrides = {}) {
  sessionStorage.setItem('chain_api_tenant_key', 'test-key');
  const api = makeMockApi({
    getCustomer:             jest.fn().mockResolvedValue(CUSTOMER),
    getCustomerDataGovernance: jest.fn().mockResolvedValue(null),
    disableCustomer:         jest.fn().mockResolvedValue({ ...CUSTOMER, status: 'disabled' }),
    ...overrides,
  });
  const router = makeRouter();
  const ctrl = createController({ api, router, id: 'cust_x' });
  return { ctrl, api, router };
}

afterEach(() => sessionStorage.clear());

describe('CustomerGovernanceView — createController', () => {
  test('initial state: no error', () => {
    const { ctrl } = setup();
    expect(ctrl.error).toBeNull();
  });

  test('header activeTab is governance', () => {
    const { ctrl } = setup();
    expect(ctrl.header.tabs.find(t => t.key === 'governance').tabClass).toContain('border-secondary');
  });

  test('gov.notSet=true when API returns null', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.gov.notSet).toBe(true);
  });

  test('gov.notSet=true when API returns 404', async () => {
    const { ctrl } = setup({ getCustomerDataGovernance: jest.fn().mockRejectedValue(new Error('HTTP 404')) });
    await ctrl.load();
    expect(ctrl.gov.notSet).toBe(true);
  });

  test('gov fields are mapped correctly', async () => {
    const { ctrl } = setup({ getCustomerDataGovernance: jest.fn().mockResolvedValue(GOV) });
    await ctrl.load();
    expect(ctrl.gov.notSet).toBe(false);
    expect(ctrl.gov.dataClassification).toBe('CONFIDENTIAL');
    expect(ctrl.gov.lawfulBasisLabel).toBe('Legal obligation');
    expect(ctrl.gov.retentionPolicy).toBe('5y_after_offboarding');
    expect(ctrl.gov.maskingLabel).toBe('REQUIRED');
    expect(ctrl.gov.encryptionLabel).toBe('REQUIRED');
  });

  test('masking badge uses tertiary when required', async () => {
    const { ctrl } = setup({ getCustomerDataGovernance: jest.fn().mockResolvedValue(GOV) });
    await ctrl.load();
    expect(ctrl.gov.maskingBadgeClass).toContain('tertiary');
  });

  test('masking badge uses outline when not required', async () => {
    const { ctrl } = setup({ getCustomerDataGovernance: jest.fn().mockResolvedValue({ ...GOV, masking_required: false }) });
    await ctrl.load();
    expect(ctrl.gov.maskingBadgeClass).toContain('outline');
  });

  test('classification badge uses error class for confidential', async () => {
    const { ctrl } = setup({ getCustomerDataGovernance: jest.fn().mockResolvedValue(GOV) });
    await ctrl.load();
    expect(ctrl.gov.classificationBadgeClass).toContain('error');
  });

  test('classification badge uses tertiary for public', async () => {
    const { ctrl } = setup({ getCustomerDataGovernance: jest.fn().mockResolvedValue({ ...GOV, data_classification: 'public' }) });
    await ctrl.load();
    expect(ctrl.gov.classificationBadgeClass).toContain('tertiary');
  });

  test('load() sets header', async () => {
    const { ctrl } = setup();
    await ctrl.load();
    expect(ctrl.header.loading).toBe(false);
  });

  test('load() sets error on failure', async () => {
    const { ctrl } = setup({ getCustomer: jest.fn().mockRejectedValue(new Error('err')) });
    await ctrl.load();
    expect(ctrl.error).toBe('err');
  });

  test('unknown lawful_basis displays raw value', async () => {
    const { ctrl } = setup({ getCustomerDataGovernance: jest.fn().mockResolvedValue({ ...GOV, lawful_basis: 'custom_basis' }) });
    await ctrl.load();
    expect(ctrl.gov.lawfulBasisLabel).toBe('custom_basis');
  });
});
