export const template = `
<div rv-each-field="config.fields" class="border-b border-white/5 last:border-0 px-md py-md">
  <div class="flex flex-col lg:flex-row lg:items-start gap-sm lg:gap-md">
    <div class="lg:w-1/2">
      <span rv-text="field.label" class="font-mono-data text-on-surface block"></span>
      <span rv-text="field.description" class="font-body-sm text-on-surface-variant mt-xs block"></span>
    </div>
    <div class="lg:w-1/2">
      <select
        rv-show="field.isSelect"
        rv-value="field.displayValue"
        rv-on-change="field.onChange"
        rv-attr-name="field.key"
        class="w-full bg-[#151b2d] border border-[#45474c] rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none appearance-none"
      >
        <option rv-each-opt="field.options" rv-attr-value="opt.value" rv-text="opt.label"></option>
      </select>
      <textarea
        rv-show="field.isTextarea"
        rv-value="field.displayValue"
        rv-on-input="field.onInput"
        rv-attr-name="field.key"
        rv-attr-placeholder="field.placeholder"
        rows="3"
        class="w-full bg-[#151b2d] border border-[#45474c] rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none resize-none"
      ></textarea>
      <input
        rv-hide="field.notInput"
        rv-value="field.displayValue"
        rv-on-input="field.onInput"
        rv-attr-type="field.inputType"
        rv-attr-name="field.key"
        rv-attr-placeholder="field.placeholder"
        class="w-full bg-[#151b2d] border border-[#45474c] rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      />
    </div>
  </div>
</div>
`;

const FIELD_DEFINITIONS = [
  {
    key: 'btc_confirmations_required',
    label: 'btc_confirmations_required',
    description: 'Number of network confirmations needed before a transaction is recognized as pending.',
    inputType: 'number',
    placeholder: 'e.g. 1',
  },
  {
    key: 'btc_finality_confirmations',
    label: 'btc_finality_confirmations',
    description: 'The threshold at which a transaction is considered irreversible for accounting.',
    inputType: 'number',
    placeholder: 'e.g. 6',
  },
  {
    key: 'custody_mode',
    label: 'custody_mode',
    description: "Define who controls the cryptographic keys for this tenant's assets.",
    inputType: 'select',
    options: ['external_signer', 'platform_custody', 'hybrid_custody'],
  },
  {
    key: 'withdrawal_mode',
    label: 'withdrawal_mode',
    description: 'Authorised protocol for outgoing asset transfers.',
    inputType: 'select',
    options: ['external_signer', 'automatic', 'manual_approval', 'threshold_based'],
  },
  {
    key: 'daily_withdrawal_limit_sats',
    label: 'daily_withdrawal_limit_sats',
    description: 'Max Satoshis allowed for withdrawal in a 24-hour window. Leave empty for no limit.',
    inputType: 'number',
    placeholder: 'null — no limit',
    nullable: true,
  },
  {
    key: 'per_tx_limit_sats',
    label: 'per_tx_limit_sats',
    description: 'Maximum value allowable per a single transaction.',
    inputType: 'number',
    placeholder: 'null — no limit',
    nullable: true,
  },
  {
    key: 'btc_xpub',
    label: 'btc_xpub',
    description: 'Master Extended Public Key for address generation and tracking.',
    inputType: 'textarea',
    placeholder: 'xpub...',
  },
  {
    key: 'btc_sweep_threshold_sats',
    label: 'btc_sweep_threshold_sats',
    description: 'Balance trigger for sweeping UTXOs into cold storage.',
    inputType: 'number',
    placeholder: 'e.g. 100000',
    keepAsString: true,
  },
  {
    key: 'customer_session_ttl_seconds',
    label: 'customer_session_ttl_seconds',
    description: 'Time-to-live for active end-user web sessions.',
    inputType: 'number',
    placeholder: 'e.g. 3600',
  },
];

export function createConfigFieldsController(rawConfig, onFieldChange) {
  return FIELD_DEFINITIONS.map(def => {
    const isSelect   = def.inputType === 'select';
    const isTextarea = def.inputType === 'textarea';
    const isInput    = !isSelect && !isTextarea;
    const raw = rawConfig[def.key];
    const displayValue = raw === null || raw === undefined ? '' : String(raw);

    return {
      key:          def.key,
      label:        def.label,
      description:  def.description,
      inputType:    isInput ? def.inputType : 'text',
      placeholder:  def.placeholder || '',
      isSelect,
      isTextarea,
      isInput,
      notInput:     isSelect || isTextarea,
      displayValue,
      nullable:     def.nullable || false,
      keepAsString: def.keepAsString || false,
      options: isSelect ? def.options.map(o => ({ value: o, label: o })) : [],
      onInput(e) { onFieldChange(def.key, e.target.value); },
      onChange(e) { onFieldChange(def.key, e.target.value); },
    };
  });
}

export function collectConfigValues(fields) {
  const result = {};
  fields.forEach(field => {
    const raw = field.displayValue;
    if (field.nullable && (raw === '' || raw === 'null')) {
      result[field.key] = null;
    } else if (field.inputType === 'number' && !field.keepAsString && raw !== '') {
      result[field.key] = Number(raw);
    } else {
      result[field.key] = raw;
    }
  });
  return result;
}
