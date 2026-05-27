import { createController } from '../../src/views/TenantConfigView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const RAW_BATCH_CONFIG = {
  withdrawal_fee_coverage: 'tenant_pays',
  btc_batching_enabled: 1,
  btc_min_outputs_per_batch: 1,
  btc_max_outputs_per_batch: 200,
  btc_max_batch_age_seconds: 30,
  btc_max_fee_rate_sat_vb: 50,
  btc_target_blocks: 6,
  btc_rbf_enabled: 1,
};

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
    getWithdrawalBatchConfig: jest.fn().mockResolvedValue(RAW_BATCH_CONFIG),
    tenantRequest: jest.fn().mockResolvedValue({}),
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
    expect(ctrl.config.fields).toHaveLength(10);
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
    const active = ctrl.sidebar.navItems.find(i => i.showActive === true);
    expect(active?.label).toBe('Tenant List');
  });

  test('saveConfig clears previous error before saving', async () => {
    const api = makeMockApi({
      getTenantConfig: jest.fn().mockResolvedValue(RAW_CONFIG),
      getWithdrawalBatchConfig: jest.fn().mockResolvedValue(RAW_BATCH_CONFIG),
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

describe('TenantConfigView — withdrawal batch config section', () => {
  test('load() also fetches withdrawal batch config', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.load();
    expect(api.getWithdrawalBatchConfig).toHaveBeenCalled();
  });

  test('batchConfig.fields is populated after load', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    expect(ctrl.batchConfig.fields.length).toBeGreaterThan(0);
  });

  test('withdrawalFeeCoverage field is present in batchConfig', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    const field = ctrl.batchConfig.fields.find(f => f.key === 'withdrawalFeeCoverage');
    expect(field).toBeDefined();
    expect(field.isSelect).toBe(true);
  });

  test('withdrawalFeeCoverage field shows options for all 3 policies', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    const field = ctrl.batchConfig.fields.find(f => f.key === 'withdrawalFeeCoverage');
    const values = field.options.map(o => o.value);
    expect(values).toContain('tenant_pays');
    expect(values).toContain('sender_pays');
    expect(values).toContain('recipient_pays');
  });

  test('withdrawalFeeCoverage displayValue reflects loaded config', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatchConfig: jest.fn().mockResolvedValue({ withdrawal_fee_coverage: 'sender_pays' }),
    });
    await ctrl.load();
    const field = ctrl.batchConfig.fields.find(f => f.key === 'withdrawalFeeCoverage');
    expect(field.displayValue).toBe('sender_pays');
  });

  test('load() survives batch config fetch failure', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatchConfig: jest.fn().mockRejectedValue(new Error('500')),
    });
    await ctrl.load();
    expect(ctrl.error).toBeNull(); // main config still loaded
    expect(ctrl.config.fields.length).toBeGreaterThan(0);
  });

  test('saveBatchConfig() calls tenantRequest with PATCH', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.load();
    ctrl._onBatchFieldChange('withdrawalFeeCoverage', 'recipient_pays');
    await ctrl.saveBatchConfig();
    expect(api.tenantRequest).toHaveBeenCalledWith(
      '/api/tenant/withdrawal-batch-config',
      expect.objectContaining({ method: 'PATCH' })
    );
  });

  test('saveBatchConfig() sets batchSaveSuccess on success', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    await ctrl.saveBatchConfig();
    expect(ctrl.batchSaveSuccess).toBe(true);
    expect(ctrl.batchSaving).toBe(false);
  });

  test('saveBatchConfig() sets batchError on failure', async () => {
    const { ctrl } = makeCtrl({
      tenantRequest: jest.fn().mockRejectedValue(new Error('Save failed')),
    });
    await ctrl.load();
    await ctrl.saveBatchConfig();
    expect(ctrl.batchError).toBe('Save failed');
    expect(ctrl.batchSaving).toBe(false);
  });

  test('_onBatchFieldChange updates field displayValue', async () => {
    const { ctrl } = makeCtrl();
    await ctrl.load();
    ctrl._onBatchFieldChange('withdrawalFeeCoverage', 'recipient_pays');
    const field = ctrl.batchConfig.fields.find(f => f.key === 'withdrawalFeeCoverage');
    expect(field.displayValue).toBe('recipient_pays');
  });

  test('btcRbfEnabled displayValue is "true" when backend returns INTEGER 1', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatchConfig: jest.fn().mockResolvedValue({ btc_rbf_enabled: 1 }),
    });
    await ctrl.load();
    const field = ctrl.batchConfig.fields.find(f => f.key === 'btcRbfEnabled');
    expect(field.displayValue).toBe('true');
  });

  test('btcRbfEnabled displayValue is "false" when backend returns INTEGER 0', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatchConfig: jest.fn().mockResolvedValue({ btc_rbf_enabled: 0 }),
    });
    await ctrl.load();
    const field = ctrl.batchConfig.fields.find(f => f.key === 'btcRbfEnabled');
    expect(field.displayValue).toBe('false');
  });

  test('btcBatchingEnabled displayValue is "true" when backend returns INTEGER 1', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatchConfig: jest.fn().mockResolvedValue({ btc_batching_enabled: 1 }),
    });
    await ctrl.load();
    const field = ctrl.batchConfig.fields.find(f => f.key === 'btcBatchingEnabled');
    expect(field.displayValue).toBe('true');
  });

  test('boolean select option has selected=true matching displayValue', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatchConfig: jest.fn().mockResolvedValue({ btc_rbf_enabled: 1 }),
    });
    await ctrl.load();
    const field = ctrl.batchConfig.fields.find(f => f.key === 'btcRbfEnabled');
    const trueOpt = field.options.find(o => o.value === 'true');
    const falseOpt = field.options.find(o => o.value === 'false');
    expect(trueOpt.selected).toBe(true);
    expect(falseOpt.selected).toBe(false);
  });

  test('withdrawalFeeCoverage option marked selected when matching backend value', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatchConfig: jest.fn().mockResolvedValue({ withdrawal_fee_coverage: 'sender_pays' }),
    });
    await ctrl.load();
    const field = ctrl.batchConfig.fields.find(f => f.key === 'withdrawalFeeCoverage');
    const senderOpt = field.options.find(o => o.value === 'sender_pays');
    const tenantOpt = field.options.find(o => o.value === 'tenant_pays');
    expect(senderOpt.selected).toBe(true);
    expect(tenantOpt.selected).toBe(false);
  });
});
