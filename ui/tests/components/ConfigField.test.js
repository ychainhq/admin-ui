import { createConfigFieldsController, collectConfigValues } from '../../src/components/ConfigField.js';

const rawConfig = {
  btcConfirmationsRequired: 1,
  btcFinalityConfirmations: 6,
  custodyMode: 'external_signer',
  withdrawalMode: 'manual_approval',
  dailyWithdrawalLimitSats: null,
  perTxLimitSats: null,
  btcXpub: 'xpub6CUGRUo...',
  btcSweepThresholdSats: 100000,
  customerSessionTtlSeconds: 3600,
  actorTokenSecret: null,
};

describe('createConfigFieldsController', () => {
  let onFieldChange;
  let fields;

  beforeEach(() => {
    onFieldChange = jest.fn();
    fields = createConfigFieldsController(rawConfig, onFieldChange);
  });

  test('returns one field object per defined config key', () => {
    expect(fields.length).toBe(10);
  });

  test('each field has required properties', () => {
    fields.forEach(f => {
      expect(f).toHaveProperty('key');
      expect(f).toHaveProperty('label');
      expect(f).toHaveProperty('description');
      expect(f).toHaveProperty('isSelect');
      expect(f).toHaveProperty('displayValue');
      expect(f).toHaveProperty('onInput');
      expect(f).toHaveProperty('onChange');
    });
  });

  test('numeric fields render correct displayValue', () => {
    const confirmations = fields.find(f => f.key === 'btcConfirmationsRequired');
    expect(confirmations.displayValue).toBe('1');
  });

  test('select field has isSelect = true', () => {
    const custody = fields.find(f => f.key === 'custodyMode');
    expect(custody.isSelect).toBe(true);
  });

  test('select field options include the right values', () => {
    const custody = fields.find(f => f.key === 'custodyMode');
    const optValues = custody.options.map(o => o.value);
    expect(optValues).toContain('external_signer');
    expect(optValues).toContain('platform_custody');
    expect(optValues).toContain('hybrid_custody');
  });

  test('current value option is selected', () => {
    const custody = fields.find(f => f.key === 'custodyMode');
    const selected = custody.options.find(o => o.selected === true);
    expect(selected?.value).toBe('external_signer');
  });

  test('null value renders as empty string', () => {
    const limit = fields.find(f => f.key === 'dailyWithdrawalLimitSats');
    expect(limit.displayValue).toBe('');
  });

  test('onInput calls onFieldChange with key and value', () => {
    const field = fields.find(f => f.key === 'btcSweepThresholdSats');
    field.onInput({ target: { value: '200000' } });
    expect(onFieldChange).toHaveBeenCalledWith('btcSweepThresholdSats', '200000');
  });

  test('onChange calls onFieldChange with key and value', () => {
    const field = fields.find(f => f.key === 'custodyMode');
    field.onChange({ target: { value: 'platform_custody' } });
    expect(onFieldChange).toHaveBeenCalledWith('custodyMode', 'platform_custody');
  });

  test('withdrawalMode options include all four values', () => {
    const withdrawal = fields.find(f => f.key === 'withdrawalMode');
    const optValues = withdrawal.options.map(o => o.value);
    expect(optValues).toContain('external_signer');
    expect(optValues).toContain('automatic');
    expect(optValues).toContain('manual_approval');
    expect(optValues).toContain('threshold_based');
  });
});

describe('collectConfigValues', () => {
  test('converts number fields back to numbers', () => {
    const onFieldChange = jest.fn();
    const fields = createConfigFieldsController(rawConfig, onFieldChange);
    const result = collectConfigValues(fields);
    expect(typeof result.btcConfirmationsRequired).toBe('number');
    expect(result.btcConfirmationsRequired).toBe(1);
  });

  test('converts nullable empty-string fields to null', () => {
    const onFieldChange = jest.fn();
    const fields = createConfigFieldsController(rawConfig, onFieldChange);
    const result = collectConfigValues(fields);
    expect(result.dailyWithdrawalLimitSats).toBeNull();
    expect(result.perTxLimitSats).toBeNull();
  });

  test('preserves string xpub value', () => {
    const onFieldChange = jest.fn();
    const fields = createConfigFieldsController(rawConfig, onFieldChange);
    const result = collectConfigValues(fields);
    expect(result.btcXpub).toBe('xpub6CUGRUo...');
  });

  test('collects all 9 config keys', () => {
    const onFieldChange = jest.fn();
    const fields = createConfigFieldsController(rawConfig, onFieldChange);
    const result = collectConfigValues(fields);
    expect(Object.keys(result).length).toBe(10);
  });
});
