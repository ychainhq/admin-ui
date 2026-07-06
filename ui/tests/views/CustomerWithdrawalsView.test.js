import { createController } from '../../src/views/CustomerWithdrawalsView.js';
import { makeMockApi, makeRouter } from '../mocks/api.js';

const CUSTOMER_ID = 'cust_test123';

const SAMPLE_WITHDRAWAL = {
  id: 'wd_abc123',
  status: 'broadcast',
  to_address: 'bcrt1qh5ga82nm64s0kqrl2hd4rrf55gueml48ycqqve',
  amount_raw: '1000',
  fee_raw: '282',
  tx_hash: '15691534f515338d1e7c54fcb2734ed415c4ddec1aff74c1be73c03ad847abaf',
  created_at: 1779883440,
  updated_at: 1779889837,
};

function makeCtrl(apiOverrides = {}) {
  const api = makeMockApi(apiOverrides);
  const router = makeRouter();
  const ctrl = createController({ api, router, id: CUSTOMER_ID });
  return { ctrl, api, router };
}

describe('CustomerWithdrawalsView — initial state', () => {
  test('loading is false initially', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.loading).toBe(false);
  });

  test('withdrawals list starts empty', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.withdrawals).toEqual([]);
    expect(ctrl.withdrawalsEmpty).toBe(true);
  });

  test('fee coverage defaults to tenant_pays', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl._feeCoverage).toBe('tenant_pays');
    expect(ctrl.feeCoverageIcon).toBe('shield');
  });

  test('fee estimate is hidden initially', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.feeEstimate.visible).toBe(false);
  });

  test('form fields start empty', () => {
    const { ctrl } = makeCtrl();
    expect(ctrl.form.address).toBe('');
    expect(ctrl.form.amount).toBe('');
    expect(ctrl.form.note).toBe('');
  });
});

describe('CustomerWithdrawalsView — load', () => {
  test('load() fetches customer data', async () => {
    const { ctrl, api } = makeCtrl();
    await ctrl.load();
    expect(api.getCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
  });

  test('load() populates withdrawals list', async () => {
    const { ctrl } = makeCtrl({
      getCustomerWithdrawals: jest.fn().mockResolvedValue({ data: [SAMPLE_WITHDRAWAL] }),
    });
    await ctrl.load();
    // loadWithdrawals is called async after load — wait a tick
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl.withdrawals).toHaveLength(1);
    expect(ctrl.withdrawalsEmpty).toBe(false);
  });

  test('loadWithdrawals() creates customer session before fetching withdrawals', async () => {
    const createSession = jest.fn().mockResolvedValue({ accessToken: 'tok_session' });
    const getWithdrawals = jest.fn().mockResolvedValue({ data: [] });
    const { ctrl } = makeCtrl({ createCustomerSession: createSession, getCustomerWithdrawals: getWithdrawals });
    await ctrl.loadWithdrawals();
    expect(createSession).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(getWithdrawals).toHaveBeenCalledWith('tok_session', expect.objectContaining({ limit: 20 }));
  });

  test('loadWithdrawals() uses customer session token, not customerId', async () => {
    const getWithdrawals = jest.fn().mockResolvedValue({ data: [] });
    const { ctrl } = makeCtrl({ getCustomerWithdrawals: getWithdrawals });
    await ctrl.loadWithdrawals();
    // First arg must be the session token, not the customer ID
    const firstArg = getWithdrawals.mock.calls[0]?.[0];
    expect(firstArg).not.toBe(CUSTOMER_ID);
    expect(typeof firstArg).toBe('string');
  });

  test('load() fetches confirmed BTC balance with customer session token', async () => {
    const getCustomerBalances = jest.fn().mockResolvedValue({
      balances: [{ asset_id: 'bitcoin:BTC', settled: '123456', pending: '999999' }],
    });
    const { ctrl } = makeCtrl({ getCustomerBalances });
    await ctrl.load();
    expect(getCustomerBalances).toHaveBeenCalledWith('tok_test');
    expect(getCustomerBalances.mock.calls[0][0]).not.toBe(CUSTOMER_ID);
  });

  test('load() shows settled balance as confirmed sats and ignores pending', async () => {
    const { ctrl } = makeCtrl({
      getCustomerBalances: jest.fn().mockResolvedValue({
        balances: [{ asset_id: 'bitcoin:BTC', settled: '123456', pending: '999999' }],
      }),
    });
    await ctrl.load();
    expect(ctrl.balance.confirmedSats).toBe('123456');
    expect(ctrl.balance.confirmedSatsLabel).toBe('123456 sats');
    expect(ctrl.balance.confirmedBtcLabel).toBe('0.00123456 BTC');
  });

  test('load() treats balance fetch failure as local balance error', async () => {
    const { ctrl } = makeCtrl({
      getCustomerBalances: jest.fn().mockRejectedValue(new Error('balance down')),
    });
    await ctrl.load();
    expect(ctrl.error).toBeNull();
    expect(ctrl.balance.error).toBe('Balance unavailable');
    expect(ctrl.balance.confirmedSatsLabel).toBe('Unavailable');
  });

  test('load() applies fee coverage from batch config', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatchConfig: jest.fn().mockResolvedValue({ withdrawal_fee_coverage: 'sender_pays' }),
    });
    await ctrl.load();
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl._feeCoverage).toBe('sender_pays');
    expect(ctrl.feeCoverageLabel).toBe('You pay fee');
  });

  test('load() applies fee rate from bitcoin fees', async () => {
    const { ctrl } = makeCtrl({
      getBitcoinFees: jest.fn().mockResolvedValue({ data: { feeRates: { normal: { feeRate: 7 } } } }),
    });
    await ctrl.load();
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl._feeRateNormal).toBe(7);
  });

  test('load() does not crash when fee config fails', async () => {
    const { ctrl } = makeCtrl({
      getWithdrawalBatchConfig: jest.fn().mockRejectedValue(new Error('network')),
      getBitcoinFees: jest.fn().mockRejectedValue(new Error('network')),
    });
    await expect(ctrl.load()).resolves.not.toThrow();
  });

  test('load() sets error on customer fetch failure', async () => {
    const { ctrl } = makeCtrl({
      getCustomer: jest.fn().mockRejectedValue(new Error('Not found')),
    });
    await ctrl.load();
    expect(ctrl.error).toBe('Not found');
  });
});

describe('CustomerWithdrawalsView — withdrawals list normalisation', () => {
  test('normalizes status label to uppercase', async () => {
    const { ctrl } = makeCtrl({
      getCustomerWithdrawals: jest.fn().mockResolvedValue({ data: [SAMPLE_WITHDRAWAL] }),
    });
    await ctrl.load();
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl.withdrawals[0].statusLabel).toBe('BROADCAST');
  });

  test('normalizes amount_raw field', async () => {
    const { ctrl } = makeCtrl({
      getCustomerWithdrawals: jest.fn().mockResolvedValue({ data: [SAMPLE_WITHDRAWAL] }),
    });
    await ctrl.load();
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl.withdrawals[0].amountRaw).toBe('1000');
  });

  test('shows — for missing fee_raw', async () => {
    const { ctrl } = makeCtrl({
      getCustomerWithdrawals: jest.fn().mockResolvedValue({
        data: [{ ...SAMPLE_WITHDRAWAL, fee_raw: null }],
      }),
    });
    await ctrl.load();
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl.withdrawals[0].feeRaw).toBe('—');
  });

  test('truncates long tx hash', async () => {
    const { ctrl } = makeCtrl({
      getCustomerWithdrawals: jest.fn().mockResolvedValue({ data: [SAMPLE_WITHDRAWAL] }),
    });
    await ctrl.load();
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl.withdrawals[0].txHashShort).toContain('…');
    expect(ctrl.withdrawals[0].txHashShort.length).toBeLessThan(20);
  });

  test('shows — for empty tx hash', async () => {
    const { ctrl } = makeCtrl({
      getCustomerWithdrawals: jest.fn().mockResolvedValue({
        data: [{ ...SAMPLE_WITHDRAWAL, tx_hash: null }],
      }),
    });
    await ctrl.load();
    await new Promise(r => setTimeout(r, 0));
    expect(ctrl.withdrawals[0].txHashShort).toBe('—');
  });
});

describe('CustomerWithdrawalsView — fee estimate (tenant_pays)', () => {
  test('fee estimate hidden when amount empty', () => {
    const { ctrl } = makeCtrl();
    ctrl.form.amount = '';
    ctrl._updateFeeEstimate();
    expect(ctrl.feeEstimate.visible).toBe(false);
  });

  test('fee estimate hidden when amount is zero', () => {
    const { ctrl } = makeCtrl();
    ctrl.form.amount = '0';
    ctrl._updateFeeEstimate();
    expect(ctrl.feeEstimate.visible).toBe(false);
  });

  test('fee estimate visible for valid positive amount', () => {
    const { ctrl } = makeCtrl();
    ctrl._feeRateNormal = 2;
    ctrl._feeCoverage = 'tenant_pays';
    ctrl.form.amount = '10000';
    ctrl._updateFeeEstimate();
    expect(ctrl.feeEstimate.visible).toBe(true);
    expect(ctrl.feeEstimate.feeSats).toContain('sats');
  });

  test('tenant_pays: no debit/recipient rows', () => {
    const { ctrl } = makeCtrl();
    ctrl._feeCoverage = 'tenant_pays';
    ctrl.form.amount = '10000';
    ctrl._updateFeeEstimate();
    expect(ctrl.feeEstimate.showDebit).toBe(false);
    expect(ctrl.feeEstimate.showRecipient).toBe(false);
  });
});

describe('CustomerWithdrawalsView — fee estimate (sender_pays)', () => {
  test('sender_pays: shows debit row', () => {
    const { ctrl } = makeCtrl();
    ctrl._feeCoverage = 'sender_pays';
    ctrl._feeRateNormal = 2;
    ctrl.form.amount = '10000';
    ctrl._updateFeeEstimate();
    expect(ctrl.feeEstimate.showDebit).toBe(true);
    expect(ctrl.feeEstimate.showRecipient).toBe(false);
  });

  test('sender_pays: debitAmount = amount + fee', () => {
    const { ctrl } = makeCtrl();
    ctrl._feeCoverage = 'sender_pays';
    ctrl._feeRateNormal = 2;
    ctrl.form.amount = '10000';
    ctrl._updateFeeEstimate();
    // fee = ceil(113 * 2) = 226 sats, debit = 10000 + 226 = 10226
    expect(ctrl.feeEstimate.debitAmount).toContain('10226');
  });
});

describe('CustomerWithdrawalsView — fee estimate (recipient_pays)', () => {
  test('recipient_pays: shows recipient row', () => {
    const { ctrl } = makeCtrl();
    ctrl._feeCoverage = 'recipient_pays';
    ctrl._feeRateNormal = 2;
    ctrl.form.amount = '10000';
    ctrl._updateFeeEstimate();
    expect(ctrl.feeEstimate.showDebit).toBe(false);
    expect(ctrl.feeEstimate.showRecipient).toBe(true);
  });

  test('recipient_pays: recipientAmount = amount - fee', () => {
    const { ctrl } = makeCtrl();
    ctrl._feeCoverage = 'recipient_pays';
    ctrl._feeRateNormal = 2;
    ctrl.form.amount = '10000';
    ctrl._updateFeeEstimate();
    // fee = 226, recipient = 10000 - 226 = 9774
    expect(ctrl.feeEstimate.recipientAmount).toContain('9774');
  });

  test('recipient_pays: recipientAmount floors at 0 when fee > amount', () => {
    const { ctrl } = makeCtrl();
    ctrl._feeCoverage = 'recipient_pays';
    ctrl._feeRateNormal = 100;
    ctrl.form.amount = '100'; // much less than fee
    ctrl._updateFeeEstimate();
    expect(ctrl.feeEstimate.recipientAmount).toContain('0');
  });
});

describe('CustomerWithdrawalsView — form submit', () => {
  test('submit fails with empty address', async () => {
    const { ctrl } = makeCtrl();
    ctrl.form.address = '';
    ctrl.form.amount = '1000';
    await ctrl.form.submit();
    expect(ctrl.form.error).toBe('Destination address is required');
  });

  test('submit fails with empty amount', async () => {
    const { ctrl } = makeCtrl();
    ctrl.form.address = 'bcrt1qtest';
    ctrl.form.amount = '';
    await ctrl.form.submit();
    expect(ctrl.form.error).toBe('Amount is required');
  });

  test('submit fails with non-integer amount', async () => {
    const { ctrl } = makeCtrl();
    ctrl.form.address = 'bcrt1qtest';
    ctrl.form.amount = 'abc';
    await ctrl.form.submit();
    expect(ctrl.form.error).toContain('valid positive integer');
  });

  test('submit calls createCustomerSession then createWithdrawalAsCustomer', async () => {
    const createSession = jest.fn().mockResolvedValue({ accessToken: 'tok_abc' });
    const createWithdrawal = jest.fn().mockResolvedValue({ id: 'wd_new', status: 'queued' });
    const { ctrl } = makeCtrl({ createCustomerSession: createSession, createWithdrawalAsCustomer: createWithdrawal });
    ctrl.form.address = 'bcrt1qtest';
    ctrl.form.amount = '5000';
    await ctrl.form.submit();
    expect(createSession).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(createWithdrawal).toHaveBeenCalledWith('tok_abc', expect.objectContaining({ amountSats: '5000' }));
  });

  test('submit sets success message', async () => {
    const { ctrl } = makeCtrl();
    ctrl.form.address = 'bcrt1qtest';
    ctrl.form.amount = '5000';
    await ctrl.form.submit();
    expect(ctrl.form.success).toContain('wd_test');
  });

  test('submit clears form after success', async () => {
    const { ctrl } = makeCtrl();
    ctrl.form.address = 'bcrt1qtest';
    ctrl.form.amount = '5000';
    ctrl.form.note = 'test note';
    await ctrl.form.submit();
    expect(ctrl.form.address).toBe('');
    expect(ctrl.form.amount).toBe('');
    expect(ctrl.form.note).toBe('');
  });

  test('submit refreshes confirmed balance after success', async () => {
    const getCustomerBalances = jest.fn().mockResolvedValue({
      balances: [{ asset_id: 'bitcoin:BTC', settled: '7000', pending: '100' }],
    });
    const { ctrl } = makeCtrl({ getCustomerBalances });
    ctrl.form.address = 'bcrt1qtest';
    ctrl.form.amount = '5000';
    await ctrl.form.submit();
    expect(getCustomerBalances).toHaveBeenCalledWith('tok_test');
    expect(ctrl.balance.confirmedSatsLabel).toBe('7000 sats');
  });

  test('submit sets form.error on API failure', async () => {
    const { ctrl } = makeCtrl({
      createWithdrawalAsCustomer: jest.fn().mockRejectedValue(new Error('Insufficient balance')),
    });
    ctrl.form.address = 'bcrt1qtest';
    ctrl.form.amount = '5000';
    await ctrl.form.submit();
    expect(ctrl.form.error).toBe('Insufficient balance');
  });
});

describe('CustomerWithdrawalsView — address resolution and mode switching', () => {
  test('_updateModeUI default state: submitLabel=Submit Withdrawal, submitIcon=send', () => {
    const { ctrl } = makeCtrl();
    ctrl.form._updateModeUI();
    expect(ctrl.form.submitLabel).toBe('Submit Withdrawal');
    expect(ctrl.form.submitIcon).toBe('send');
  });

  test('_updateModeUI isInternal=true preferExternal=false → bolt + Send Internal Transfer, internal btn active', () => {
    const { ctrl } = makeCtrl();
    ctrl.form.isInternalAddress = true;
    ctrl.form.preferExternal = false;
    ctrl.form._updateModeUI();
    expect(ctrl.form.submitLabel).toBe('Send Internal Transfer');
    expect(ctrl.form.submitIcon).toBe('bolt');
    expect(ctrl.form.internalBtnClass).toContain('bg-secondary');
    expect(ctrl.form.externalBtnClass).not.toContain('bg-secondary');
  });

  test('_updateModeUI isInternal=true preferExternal=true → send + Submit On-chain Withdrawal, external btn active', () => {
    const { ctrl } = makeCtrl();
    ctrl.form.isInternalAddress = true;
    ctrl.form.preferExternal = true;
    ctrl.form._updateModeUI();
    expect(ctrl.form.submitLabel).toBe('Submit On-chain Withdrawal');
    expect(ctrl.form.submitIcon).toBe('send');
    expect(ctrl.form.externalBtnClass).toContain('bg-secondary');
    expect(ctrl.form.internalBtnClass).not.toContain('bg-secondary');
  });

  test('setPreferExternalTrue() sets preferExternal=true and updates labels', () => {
    const { ctrl } = makeCtrl();
    ctrl.form.isInternalAddress = true;
    ctrl.form.setPreferExternalTrue({ preventDefault: jest.fn() });
    expect(ctrl.form.preferExternal).toBe(true);
    expect(ctrl.form.submitLabel).toBe('Submit On-chain Withdrawal');
  });

  test('setPreferExternalFalse() sets preferExternal=false and updates labels', () => {
    const { ctrl } = makeCtrl();
    ctrl.form.isInternalAddress = true;
    ctrl.form.preferExternal = true;
    ctrl.form.setPreferExternalFalse({ preventDefault: jest.fn() });
    expect(ctrl.form.preferExternal).toBe(false);
    expect(ctrl.form.submitLabel).toBe('Send Internal Transfer');
  });

  test('onAddressInput with non-empty address: immediately resets isInternalAddress and sets resolving=true', () => {
    jest.useFakeTimers();
    const { ctrl } = makeCtrl();
    ctrl.form.isInternalAddress = true; // previous state
    ctrl.form.onAddressInput({ target: { value: 'bcrt1qtest' } });
    expect(ctrl.form.isInternalAddress).toBe(false); // reset before debounce fires
    expect(ctrl.form.resolving).toBe(true);
    jest.useRealTimers();
  });

  test('onAddressInput calls createCustomerSession + resolveAddressAsCustomer after 600ms debounce and sets isInternalAddress=true', async () => {
    jest.useFakeTimers();
    const resolveAddressAsCustomer = jest.fn().mockResolvedValue({ isInternal: true, customerId: 'cust_x' });
    const { ctrl } = makeCtrl({ resolveAddressAsCustomer });
    ctrl.form.onAddressInput({ target: { value: 'bcrt1qinternal' } });
    expect(resolveAddressAsCustomer).not.toHaveBeenCalled();
    jest.advanceTimersByTime(600);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(resolveAddressAsCustomer).toHaveBeenCalledWith('tok_test', 'bcrt1qinternal');
    expect(ctrl.form.isInternalAddress).toBe(true);
    expect(ctrl.form.resolving).toBe(false);
    jest.useRealTimers();
  });

  test('onAddressInput with empty string: sets resolving=false immediately, never calls resolveAddressAsCustomer', () => {
    jest.useFakeTimers();
    const resolveAddressAsCustomer = jest.fn();
    const { ctrl } = makeCtrl({ resolveAddressAsCustomer });
    ctrl.form.onAddressInput({ target: { value: '' } });
    expect(ctrl.form.resolving).toBe(false);
    jest.advanceTimersByTime(600);
    expect(resolveAddressAsCustomer).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('onAddressInput: failed resolveAddressAsCustomer leaves isInternalAddress=false and resolving=false', async () => {
    jest.useFakeTimers();
    const resolveAddressAsCustomer = jest.fn().mockRejectedValue(new Error('network'));
    const { ctrl } = makeCtrl({ resolveAddressAsCustomer });
    ctrl.form.onAddressInput({ target: { value: 'bcrt1qtest' } });
    jest.advanceTimersByTime(600);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(ctrl.form.isInternalAddress).toBe(false);
    expect(ctrl.form.resolving).toBe(false);
    jest.useRealTimers();
  });
});

describe('CustomerWithdrawalsView — fee estimate for internal transfer mode', () => {
  test('fee estimate hidden when isInternalAddress=true and preferExternal=false', () => {
    const { ctrl } = makeCtrl();
    ctrl._feeRateNormal = 2;
    ctrl.form.amount = '10000';
    ctrl.form.isInternalAddress = true;
    ctrl.form.preferExternal = false;
    ctrl._updateFeeEstimate();
    expect(ctrl.feeEstimate.visible).toBe(false);
  });

  test('fee estimate visible when isInternalAddress=true but preferExternal=true (on-chain override)', () => {
    const { ctrl } = makeCtrl();
    ctrl._feeRateNormal = 2;
    ctrl.form.amount = '10000';
    ctrl.form.isInternalAddress = true;
    ctrl.form.preferExternal = true;
    ctrl._updateFeeEstimate();
    expect(ctrl.feeEstimate.visible).toBe(true);
  });
});

describe('CustomerWithdrawalsView — submit with internal transfer mode', () => {
  test('submit passes forceExternal=true when isInternal=true and preferExternal=true', async () => {
    const createWithdrawal = jest.fn().mockResolvedValue({ id: 'wd_ext', status: 'queued', withdrawal_type: 'external' });
    const { ctrl } = makeCtrl({ createWithdrawalAsCustomer: createWithdrawal });
    ctrl.form.address = 'bcrt1qinternal';
    ctrl.form.amount = '5000';
    ctrl.form.isInternalAddress = true;
    ctrl.form.preferExternal = true;
    await ctrl.form.submit();
    expect(createWithdrawal).toHaveBeenCalledWith('tok_test', expect.objectContaining({ forceExternal: true }));
  });

  test('submit does not pass forceExternal when isInternal=true and preferExternal=false', async () => {
    const createWithdrawal = jest.fn().mockResolvedValue({ id: 'wd_int', status: 'confirmed', withdrawal_type: 'internal' });
    const { ctrl } = makeCtrl({ createWithdrawalAsCustomer: createWithdrawal });
    ctrl.form.address = 'bcrt1qinternal';
    ctrl.form.amount = '5000';
    ctrl.form.isInternalAddress = true;
    ctrl.form.preferExternal = false;
    await ctrl.form.submit();
    const payload = createWithdrawal.mock.calls[0][1];
    expect(payload.forceExternal).toBeFalsy();
  });

  test('submit success message contains "Internal transfer" for internal result', async () => {
    const createWithdrawal = jest.fn().mockResolvedValue({ id: 'wd_int', status: 'confirmed', withdrawal_type: 'internal' });
    const { ctrl } = makeCtrl({ createWithdrawalAsCustomer: createWithdrawal });
    ctrl.form.address = 'bcrt1qinternal';
    ctrl.form.amount = '5000';
    await ctrl.form.submit();
    expect(ctrl.form.success).toContain('Internal transfer');
    expect(ctrl.lastWithdrawalWasInternal).toBe(true);
  });

  test('submit clears isInternalAddress and preferExternal after success', async () => {
    const { ctrl } = makeCtrl();
    ctrl.form.address = 'bcrt1qtest';
    ctrl.form.amount = '5000';
    ctrl.form.isInternalAddress = true;
    ctrl.form.preferExternal = true;
    await ctrl.form.submit();
    expect(ctrl.form.isInternalAddress).toBe(false);
    expect(ctrl.form.preferExternal).toBe(false);
  });
});

describe('CustomerWithdrawalsView — navigation', () => {
  test('goToBatches() navigates to withdrawal-batches', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.goToBatches({ preventDefault: jest.fn() });
    expect(router.navigate).toHaveBeenCalledWith('#/withdrawal-batches');
  });

  test('goToCustomers() navigates to customers list', () => {
    const { ctrl, router } = makeCtrl();
    ctrl.goToCustomers({ preventDefault: jest.fn() });
    expect(router.navigate).toHaveBeenCalledWith('#/customers');
  });
});

describe('CustomerWithdrawalsView — asset selector integration', () => {
  test('load() calls getMyTenantConfig with customer session token', async () => {
    const getMyTenantConfig = jest.fn().mockResolvedValue({
      availableChains: ['bitcoin'],
      availableAssets: [{ chainId: 'bitcoin', assetId: 'bitcoin:BTC', symbol: 'BTC', label: 'Bitcoin (BTC)' }],
    });
    const { ctrl } = makeCtrl({ getMyTenantConfig });
    await ctrl.load();
    expect(getMyTenantConfig).toHaveBeenCalledWith('tok_test');
    expect(getMyTenantConfig.mock.calls[0][0]).not.toBe(CUSTOMER_ID);
  });

  test('load() sets _chainId and _assetId from first available asset (TRON)', async () => {
    const { ctrl } = makeCtrl({
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [
          { chainId: 'tron', assetId: 'tron:TRX',  symbol: 'TRX',  label: 'TRON (TRX)' },
          { chainId: 'tron', assetId: 'tron:USDT', symbol: 'USDT', label: 'USDT (TRC-20)' },
        ],
      }),
    });
    await ctrl.load();
    expect(ctrl._chainId).toBe('tron');
    expect(ctrl._assetId).toBe('tron:TRX');
  });

  test('load() sets _chainId and _assetId from first available asset (BTC)', async () => {
    const { ctrl } = makeCtrl({
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['bitcoin'],
        availableAssets: [{ chainId: 'bitcoin', assetId: 'bitcoin:BTC', symbol: 'BTC', label: 'Bitcoin (BTC)' }],
      }),
    });
    await ctrl.load();
    expect(ctrl._chainId).toBe('bitcoin');
    expect(ctrl._assetId).toBe('bitcoin:BTC');
  });

  test('load() does not crash when getMyTenantConfig fails', async () => {
    const { ctrl } = makeCtrl({
      getMyTenantConfig: jest.fn().mockRejectedValue(new Error('network')),
    });
    await expect(ctrl.load()).resolves.not.toThrow();
    expect(ctrl._chainId).toBe('bitcoin');
  });

  test('load() updates amountLabel to match first asset', async () => {
    const { ctrl } = makeCtrl({
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [
          { chainId: 'tron', assetId: 'tron:TRX',  symbol: 'TRX',  label: 'TRON (TRX)' },
          { chainId: 'tron', assetId: 'tron:USDT', symbol: 'USDT', label: 'USDT (TRC-20)' },
        ],
      }),
    });
    await ctrl.load();
    expect(ctrl.form.amountLabel).toContain('TRX');
  });

  test('withdrawableAssets has one item per available asset', async () => {
    const { ctrl } = makeCtrl({
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [
          { chainId: 'tron', assetId: 'tron:TRX',  symbol: 'TRX',  label: 'TRON (TRX)' },
          { chainId: 'tron', assetId: 'tron:USDT', symbol: 'USDT', label: 'USDT (TRC-20)' },
        ],
      }),
    });
    await ctrl.load();
    expect(ctrl.withdrawableAssets).toHaveLength(2);
    const ids = ctrl.withdrawableAssets.map(a => a.assetId);
    expect(ids).toContain('tron:TRX');
    expect(ids).toContain('tron:USDT');
  });

  test('showAssetSelector is true when > 1 asset available', async () => {
    const { ctrl } = makeCtrl({
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [
          { chainId: 'tron', assetId: 'tron:TRX',  symbol: 'TRX',  label: 'TRON (TRX)' },
          { chainId: 'tron', assetId: 'tron:USDT', symbol: 'USDT', label: 'USDT (TRC-20)' },
        ],
      }),
    });
    await ctrl.load();
    expect(ctrl.showAssetSelector).toBe(true);
  });

  test('showAssetSelector is false when only 1 asset available', async () => {
    const { ctrl } = makeCtrl(); // default mock: only BTC
    await ctrl.load();
    expect(ctrl.showAssetSelector).toBe(false);
  });

  test('_onAssetSelected updates _chainId, _assetId, amountLabel and rebuilds withdrawableAssets', async () => {
    const { ctrl } = makeCtrl({
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [
          { chainId: 'tron', assetId: 'tron:TRX',  symbol: 'TRX',  label: 'TRON (TRX)' },
          { chainId: 'tron', assetId: 'tron:USDT', symbol: 'USDT', label: 'USDT (TRC-20)' },
        ],
      }),
    });
    await ctrl.load();
    ctrl._onAssetSelected({ chainId: 'tron', assetId: 'tron:USDT', asset: { amountLabel: 'Amount (USDT)', placeholder: 'np. 50.00' } });
    expect(ctrl._assetId).toBe('tron:USDT');
    expect(ctrl.form.amountLabel).toBe('Amount (USDT)');
    const usdt = ctrl.withdrawableAssets.find(a => a.assetId === 'tron:USDT');
    const trx  = ctrl.withdrawableAssets.find(a => a.assetId === 'tron:TRX');
    expect(usdt.isActive).toBe(true);
    expect(trx.isActive).toBe(false);
  });

  test('_onAssetSelected clears amount and hides fee estimate', async () => {
    const { ctrl } = makeCtrl({
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [
          { chainId: 'tron', assetId: 'tron:TRX',  symbol: 'TRX',  label: 'TRON (TRX)' },
          { chainId: 'tron', assetId: 'tron:USDT', symbol: 'USDT', label: 'USDT (TRC-20)' },
        ],
      }),
    });
    await ctrl.load();
    ctrl.form.amount = '50000';
    ctrl.feeEstimate.visible = true;
    ctrl._onAssetSelected({ chainId: 'tron', assetId: 'tron:USDT', asset: { amountLabel: 'Amount (USDT)', placeholder: '0' } });
    expect(ctrl.form.amount).toBe('');
    expect(ctrl.feeEstimate.visible).toBe(false);
  });

  test('submit passes _chainId and _assetId to createWithdrawalAsCustomer (TRON TRX)', async () => {
    const createWithdrawal = jest.fn().mockResolvedValue({ id: 'wd_tron', status: 'queued' });
    const { ctrl } = makeCtrl({
      createWithdrawalAsCustomer: createWithdrawal,
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [{ chainId: 'tron', assetId: 'tron:TRX', symbol: 'TRX', label: 'TRON (TRX)' }],
      }),
    });
    await ctrl.load();
    ctrl.form.address = 'TXtest1234';
    ctrl.form.amount = '10.5'; // TRX float input
    await ctrl.form.submit();
    expect(createWithdrawal).toHaveBeenCalledWith('tok_test', expect.objectContaining({
      chainId: 'tron',
      assetId: 'tron:TRX',
    }));
  });

  test('submit converts TRX float to sun units before sending', async () => {
    const createWithdrawal = jest.fn().mockResolvedValue({ id: 'wd_tron', status: 'queued' });
    const { ctrl } = makeCtrl({
      createWithdrawalAsCustomer: createWithdrawal,
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [{ chainId: 'tron', assetId: 'tron:TRX', symbol: 'TRX', label: 'TRON (TRX)' }],
      }),
    });
    await ctrl.load();
    ctrl.form.address = 'TXtest1234';
    ctrl.form.amount = '10.5'; // 10.5 TRX = 10_500_000 sun
    await ctrl.form.submit();
    const payload = createWithdrawal.mock.calls[0][1];
    expect(payload.amountSats).toBe('10500000');
  });

  test('submit passes bitcoin:BTC by default (no getMyTenantConfig override)', async () => {
    const createWithdrawal = jest.fn().mockResolvedValue({ id: 'wd_btc', status: 'queued' });
    const createSession = jest.fn().mockResolvedValue({ accessToken: 'tok_abc' });
    const { ctrl } = makeCtrl({ createWithdrawalAsCustomer: createWithdrawal, createCustomerSession: createSession });
    ctrl.form.address = 'bcrt1qtest';
    ctrl.form.amount = '5000';
    await ctrl.form.submit();
    expect(createWithdrawal).toHaveBeenCalledWith('tok_abc', expect.objectContaining({
      chainId: 'bitcoin',
      assetId: 'bitcoin:BTC',
    }));
  });
});

describe('CustomerWithdrawalsView — asset-aware balance display', () => {
  test('_applyBalanceData shows BTC sats label when _assetId is bitcoin:BTC', async () => {
    const { ctrl } = makeCtrl({
      getCustomerBalances: jest.fn().mockResolvedValue({
        balances: [{ asset_id: 'bitcoin:BTC', settled: '123456' }],
      }),
    });
    await ctrl.load();
    expect(ctrl.balance.confirmedSatsLabel).toBe('123456 sats');
    expect(ctrl.balance.confirmedBtcLabel).toBe('0.00123456 BTC');
  });

  test('_applyBalanceData shows TRX label when _assetId is tron:TRX', async () => {
    const { ctrl } = makeCtrl({
      getCustomerBalances: jest.fn().mockResolvedValue({
        balances: [{ asset_id: 'tron:TRX', settled: '10500000' }],
      }),
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [{ chainId: 'tron', assetId: 'tron:TRX', symbol: 'TRX', label: 'TRON (TRX)' }],
      }),
    });
    await ctrl.load();
    expect(ctrl.balance.confirmedSatsLabel).toContain('TRX');
    expect(ctrl.balance.confirmedSatsLabel).not.toContain('sats');
    expect(ctrl.balance.confirmedBtcLabel).toBe('');
  });

  test('_applyBalanceData shows USDT label when _assetId is tron:USDT', async () => {
    const { ctrl } = makeCtrl({
      getCustomerBalances: jest.fn().mockResolvedValue({
        balances: [{ asset_id: 'tron:USDT', settled: '50000000' }],
      }),
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [{ chainId: 'tron', assetId: 'tron:USDT', symbol: 'USDT', label: 'USDT (TRC-20)' }],
      }),
    });
    await ctrl.load();
    // Force assetId (getMyTenantConfig returns only USDT so first asset sets it)
    expect(ctrl.balance.confirmedSatsLabel).toContain('USDT');
    expect(ctrl.balance.confirmedBtcLabel).toBe('');
  });

  test('_applyBalanceData shows Unavailable when TRON balance not in response', async () => {
    const { ctrl } = makeCtrl({
      getCustomerBalances: jest.fn().mockResolvedValue({ balances: [] }),
      getMyTenantConfig: jest.fn().mockResolvedValue({
        availableChains: ['tron'],
        availableAssets: [{ chainId: 'tron', assetId: 'tron:TRX', symbol: 'TRX', label: 'TRON (TRX)' }],
      }),
    });
    await ctrl.load();
    expect(ctrl.balance.confirmedSatsLabel).toBe('Unavailable');
  });
});
