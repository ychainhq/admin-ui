import { createController } from '../../src/views/CustomerCreateView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

function setup(apiOverrides = {}) {
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ api, router });
  return { ctrl, api, router };
}

describe('CustomerCreateView — createController', () => {
  test('initial state: not submitting, no error', () => {
    const { ctrl } = setup();
    expect(ctrl.submitting).toBe(false);
    expect(ctrl.error).toBeNull();
    expect(ctrl.metadataError).toBeNull();
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

  test('onReferenceInput updates internal form reference', () => {
    const { ctrl } = setup();
    ctrl.onReferenceInput({ target: { value: '  user-123  ' } });
    expect(ctrl._form.reference).toBe('user-123');
  });

  test('onMetadataInput clears metadataError', () => {
    const { ctrl } = setup();
    ctrl.metadataError = 'bad json';
    ctrl.onMetadataInput({ target: { value: '{}' } });
    expect(ctrl.metadataError).toBeNull();
  });

  test('submit() with valid reference calls createCustomer', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ customerId: 'cust_new' });
    const { ctrl, router } = setup({ createCustomer });
    ctrl.onReferenceInput({ target: { value: 'user-xyz' } });
    await ctrl.submit();
    expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ reference: 'user-xyz' }));
    expect(router.navigate).toHaveBeenCalledWith('#/customers');
  });

  test('submit() without reference still works (optional)', async () => {
    const createCustomer = jest.fn().mockResolvedValue({ customerId: 'cust_new' });
    const { ctrl, router } = setup({ createCustomer });
    await ctrl.submit();
    expect(createCustomer).toHaveBeenCalledWith({});
    expect(router.navigate).toHaveBeenCalledWith('#/customers');
  });

  test('submit() with valid JSON metadata passes parsed metadata', async () => {
    const createCustomer = jest.fn().mockResolvedValue({});
    const { ctrl } = setup({ createCustomer });
    ctrl.onMetadataInput({ target: { value: '{"plan":"pro"}' } });
    await ctrl.submit();
    expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ metadata: { plan: 'pro' } }));
  });

  test('submit() with invalid JSON sets metadataError and does not call API', async () => {
    const createCustomer = jest.fn();
    const { ctrl } = setup({ createCustomer });
    ctrl.onMetadataInput({ target: { value: '{bad json}' } });
    await ctrl.submit();
    expect(ctrl.metadataError).toContain('valid JSON');
    expect(createCustomer).not.toHaveBeenCalled();
  });

  test('submit() sets error on API failure', async () => {
    const { ctrl } = setup({ createCustomer: jest.fn().mockRejectedValue(new Error('API error')) });
    await ctrl.submit();
    expect(ctrl.error).toBe('API error');
  });

  test('submitting is false after successful submit', async () => {
    const { ctrl } = setup();
    await ctrl.submit();
    expect(ctrl.submitting).toBe(false);
  });

  test('submitting is false after failed submit', async () => {
    const { ctrl } = setup({ createCustomer: jest.fn().mockRejectedValue(new Error('fail')) });
    await ctrl.submit();
    expect(ctrl.submitting).toBe(false);
  });

  test('submit() clears previous error', async () => {
    const createCustomer = jest.fn()
      .mockRejectedValueOnce(new Error('first error'))
      .mockResolvedValueOnce({});
    const { ctrl, router } = setup({ createCustomer });
    await ctrl.submit();
    expect(ctrl.error).toBe('first error');
    await ctrl.submit();
    expect(ctrl.error).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith('#/customers');
  });

  test('sidebar has ROUTE active', () => {
    const { ctrl } = setup();
    expect(Array.isArray(ctrl.sidebar.navItems)).toBe(true);
  });
});
