import { createController } from '../../src/views/TenantConfigView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const RAW_CONFIG = {
  btcConfirmationsRequired: 1,
  btcFinalityConfirmations: 6,
  custodyMode: 'external_signer',
  withdrawalMode: 'manual_approval',
  dailyWithdrawalLimitSats: null,
  perTxLimitSats: null,
  btcXpub: 'xpub6CUGRUo...',
  btcSweepThresholdSats: 100000,
  customerSessionTtlSeconds: 3600,
};

function makeCtrl(apiOverrides = {}, tenantId = 'tenant_default') {
  const api = makeMockApi({
    getTenantConfig: jest.fn().mockResolvedValue(RAW_CONFIG),
    saveTenantConfig: jest.fn().mockResolvedValue({}),
    ...apiOverrides,
  });
  const router = makeRouter();
  const ctrl = createController({ tenantId, api, router });
  return { ctrl, api, router };
}

describe('TenantConfigView — createController', () => {
  test('initial state: loading false, no error', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.loading).toBe(false);
    expect(ctrl.error).toBeNull();
    expect(ctrl.saving).toBe(false);
    expect(ctrl.saveSuccess).toBe(false);
  });

  test('tenantId is stored on the controller', () => {
    const { ctrl } = makeCtrl({}, 'tenant_alpha');
    expect(ctrl.tenantId).toBe('tenant_alpha');
  });

  test('init() calls load() which fetches tenant config', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.init();
    expect(api.getTenantConfig).toHaveBeenCalledWith('tenant_default');
  });

  test('load() populates config.fields from API response', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.config.fields).toHaveLength(9);
  });

  test('load() sets error on API failure', async () => {
    const { ctrl } = makeCtrl({
      getTenantConfig: jest.fn().mockRejectedValue(new Error('Not found')),
    });
    await ctrl.load();
    expect(ctrl.error).toBe('Not found');
    expect(ctrl.loading).toBe(false);
  });

  test('loading flag is false after successful load', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('loading flag is false after failed load', async () => {
    const { ctrl } = makeCtrl({
      getTenantConfig: jest.fn().mockRejectedValue(new Error('fail')),
    });
    await ctrl.load();
    expect(ctrl.loading).toBe(false);
  });

  test('saveConfig() calls saveTenantConfig with collected values', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.load();
    await ctrl.saveConfig();
    expect(api.saveTenantConfig).toHaveBeenCalledWith(
      'tenant_default',
      expect.objectContaining({ btcConfirmationsRequired: 1 })
    );
  });

  test('saveConfig() sets saveSuccess to true on success', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    await ctrl.saveConfig();
    expect(ctrl.saveSuccess).toBe(true);
  });

  test('saveConfig() sets error on API failure', async () => {
    const { ctrl } = makeCtrl({
      saveTenantConfig: jest.fn().mockRejectedValue(new Error('Save failed')),
    });
    await ctrl.load();
    await ctrl.saveConfig();
    expect(ctrl.error).toBe('Save failed');
    expect(ctrl.saving).toBe(false);
  });

  test('saving flag is false after successful save', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    await ctrl.saveConfig();
    expect(ctrl.saving).toBe(false);
  });

  test('cancelConfig() navigates back to tenant list', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.cancelConfig();
    expect(router.navigate).toHaveBeenCalledWith('#/tenants');
  });

  test('field change updates _rawConfig via _onFieldChange', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    ctrl._onFieldChange('btcSweepThresholdSats', '200000');
    expect(ctrl._rawConfig.btcSweepThresholdSats).toBe('200000');
  });

  test('field change syncs displayValue on matching field', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    ctrl._onFieldChange('btcXpub', 'newxpub123');
    const xpubField = ctrl.config.fields.find(f => f.key === 'btcXpub');
    expect(xpubField.displayValue).toBe('newxpub123');
  });

  test('topBar title references tenant config', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.topBar.title).toBe('Tenant Config');
  });

  test('topBar onBack navigates to tenant list', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.topBar.onBack();
    expect(router.navigate).toHaveBeenCalledWith('#/tenants');
  });

  test('sidebar is initialised with /tenants as active route', () => {
    const { ctrl } = makeCtrl();
    expect(Array.isArray(ctrl.sidebar.navItems)).toBe(true);
    const active = ctrl.sidebar.navItems.find(i => i.itemClass.includes('border-l-secondary'));
    expect(active?.label).toBe('Tenant List');
  });

  test('saveConfig clears previous error before saving', async () => {
    const api = makeMockApi({
      getTenantConfig: jest.fn().mockResolvedValue(RAW_CONFIG),
      saveTenantConfig: jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce({}),
    });
    const router = makeRouter();
    const ctrl = createController({ tenantId: 'tenant_default', api, router });
    await ctrl.load();
    await ctrl.saveConfig();
    expect(ctrl.error).toBe('First failure');
    await ctrl.saveConfig();
    expect(ctrl.error).toBeNull();
    expect(ctrl.saveSuccess).toBe(true);
  });
});
