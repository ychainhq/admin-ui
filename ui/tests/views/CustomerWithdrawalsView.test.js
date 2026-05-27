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
    expect(getWithdrawals).toHaveBeenCalledWith('tok_session');
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
