export const template = `
<div rv-each-field="config.fields" class="border-b border-white/5 py-md">
  <div class="flex flex-col lg:flex-row lg:items-start gap-md">
    <div class="lg:w-1/2">
      <span rv-text="field.label" class="font-mono-data text-on-surface block"></span>
      <span rv-text="field.description" class="font-body-sm text-on-surface-variant mt-xs block"></span>
    </div>
    <div class="lg:w-1/2">
      <select
        rv-show="field.isSelect"
        rv-on-change="field.onChange"
        rv-attr-name="field.key"
        class="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none appearance-none"
      >
        <option rv-each-opt="field.options" rv-attr-value="opt.value" rv-attr-selected="opt.selected" rv-text="opt.label"></option>
      </select>
      <input
        rv-hide="field.isSelect"
        rv-on-input="field.onInput"
        rv-attr-value="field.displayValue"
        rv-attr-type="field.inputType"
        rv-attr-name="field.key"
        rv-attr-placeholder="field.placeholder"
        class="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      />
    </div>
  </div>
</div>
`;

const FIELD_DEFINITIONS = [
  {
    key: 'btcConfirmationsRequired',
    label: 'btcConfirmationsRequired',
    description: 'Number of network confirmations needed before a transaction is recognized as pending.',
    inputType: 'number',
    placeholder: 'e.g. 1',
  },
  {
    key: 'btcFinalityConfirmations',
    label: 'btcFinalityConfirmations',
    description: 'The threshold at which a transaction is considered irreversible for accounting.',
    inputType: 'number',
    placeholder: 'e.g. 6',
  },
  {
    key: 'custodyMode',
    label: 'custodyMode',
    description: "Define who controls the cryptographic keys for this tenant's assets.",
    inputType: 'select',
    options: ['external_signer', 'platform_custody', 'hybrid_custody'],
  },
  {
    key: 'withdrawalMode',
    label: 'withdrawalMode',
    description: 'Authorised protocol for outgoing asset transfers.',
    inputType: 'select',
    options: ['external_signer', 'automatic', 'manual_approval', 'threshold_based'],
  },
  {
    key: 'dailyWithdrawalLimitSats',
    label: 'dailyWithdrawalLimitSats',
    description: 'Max Satoshis allowed for withdrawal in a 24-hour window. Leave empty for no limit.',
    inputType: 'number',
    placeholder: 'null — no limit',
    nullable: true,
  },
  {
    key: 'perTxLimitSats',
    label: 'perTxLimitSats',
    description: 'Maximum value allowable per a single transaction.',
    inputType: 'number',
    placeholder: 'null — no limit',
    nullable: true,
  },
  {
    key: 'btcXpub',
    label: 'btcXpub',
    description: 'Master Extended Public Key for address generation and tracking.',
    inputType: 'text',
    placeholder: 'xpub...',
  },
  {
    key: 'btcSweepThresholdSats',
    label: 'btcSweepThresholdSats',
    description: 'Balance trigger for sweeping UTXOs into cold storage.',
    inputType: 'number',
    placeholder: 'e.g. 100000',
  },
  {
    key: 'customerSessionTtlSeconds',
    label: 'customerSessionTtlSeconds',
    description: 'Time-to-live for active end-user web sessions.',
    inputType: 'number',
    placeholder: 'e.g. 3600',
  },
];

export function createConfigFieldsController(rawConfig, onFieldChange) {
  return FIELD_DEFINITIONS.map(def => {
    const isSelect = def.inputType === 'select';
    const raw = rawConfig[def.key];
    const displayValue = raw === null || raw === undefined ? '' : String(raw);

    return {
      key:          def.key,
      label:        def.label,
      description:  def.description,
      inputType:    def.inputType,
      placeholder:  def.placeholder || '',
      isSelect,
      displayValue,
      nullable:     def.nullable || false,
      options: isSelect ? def.options.map(o => ({
        value:    o,
        label:    o,
        selected: displayValue === o ? true : null,
      })) : [],
      onInput(e) {
        onFieldChange(def.key, e.target.value);
      },
      onChange(e) {
        onFieldChange(def.key, e.target.value);
      },
    };
  });
}

export function collectConfigValues(fields) {
  const result = {};
  fields.forEach(field => {
    const raw = field.displayValue;
    if (field.nullable && (raw === '' || raw === 'null')) {
      result[field.key] = null;
    } else if (field.inputType === 'number' && raw !== '') {
      result[field.key] = Number(raw);
    } else {
      result[field.key] = raw;
    }
  });
  return result;
}
