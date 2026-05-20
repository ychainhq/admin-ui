import { createConfigFieldsController, collectConfigValues } from '../../src/components/ConfigField.js';

const rawConfig = {
  btc_confirmations_required: 1,
  btc_finality_confirmations: 6,
  custody_mode: 'external_signer',
  withdrawal_mode: 'manual',
  daily_withdrawal_limit_sats: null,
  per_tx_limit_sats: null,
  btc_xpub: 'xpub6CUGRUo...',
  btc_sweep_threshold_sats: 100000,
  customer_session_ttl_seconds: 3600,
};

describe('createConfigFieldsController', () => {
  let onFieldChange;
  let fields;

  beforeEach(() => {
    onFieldChange = jest.fn();
    fields = createConfigFieldsController(rawConfig, onFieldChange);
  });

  test('returns one field object per defined config key', () => {
    expect(fields.length).toBe(9);
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
    const confirmations = fields.find(f => f.key === 'btc_confirmations_required');
    expect(confirmations.displayValue).toBe('1');
  });

  test('select field has isSelect = true', () => {
    const custody = fields.find(f => f.key === 'custody_mode');
    expect(custody.isSelect).toBe(true);
  });

  test('select field options include the right values', () => {
    const custody = fields.find(f => f.key === 'custody_mode');
    const optValues = custody.options.map(o => o.value);
    expect(optValues).toContain('external_signer');
    expect(optValues).toContain('internal_hsm');
  });

  test('current value option is selected', () => {
    const custody = fields.find(f => f.key === 'custody_mode');
    const selected = custody.options.find(o => o.selected === true);
    expect(selected?.value).toBe('external_signer');
  });

  test('null value renders as empty string', () => {
    const limit = fields.find(f => f.key === 'daily_withdrawal_limit_sats');
    expect(limit.displayValue).toBe('');
  });

  test('onInput calls onFieldChange with key and value', () => {
    const field = fields.find(f => f.key === 'btc_sweep_threshold_sats');
    field.onInput({ target: { value: '200000' } });
    expect(onFieldChange).toHaveBeenCalledWith('btc_sweep_threshold_sats', '200000');
  });

  test('onChange calls onFieldChange with key and value', () => {
    const field = fields.find(f => f.key === 'custody_mode');
    field.onChange({ target: { value: 'internal_hsm' } });
    expect(onFieldChange).toHaveBeenCalledWith('custody_mode', 'internal_hsm');
  });
});

describe('collectConfigValues', () => {
  test('converts number fields back to numbers', () => {
    const onFieldChange = jest.fn();
    const fields = createConfigFieldsController(rawConfig, onFieldChange);
    const result = collectConfigValues(fields);
    expect(typeof result.btc_confirmations_required).toBe('number');
    expect(result.btc_confirmations_required).toBe(1);
  });

  test('converts nullable empty-string fields to null', () => {
    const onFieldChange = jest.fn();
    const fields = createConfigFieldsController(rawConfig, onFieldChange);
    const result = collectConfigValues(fields);
    expect(result.daily_withdrawal_limit_sats).toBeNull();
    expect(result.per_tx_limit_sats).toBeNull();
  });

  test('preserves string xpub value', () => {
    const onFieldChange = jest.fn();
    const fields = createConfigFieldsController(rawConfig, onFieldChange);
    const result = collectConfigValues(fields);
    expect(result.btc_xpub).toBe('xpub6CUGRUo...');
  });

  test('collects all 9 config keys', () => {
    const onFieldChange = jest.fn();
    const fields = createConfigFieldsController(rawConfig, onFieldChange);
    const result = collectConfigValues(fields);
    expect(Object.keys(result).length).toBe(9);
  });
});
