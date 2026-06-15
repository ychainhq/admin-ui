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
        rv-html="field.optionsHtml"
        rv-on-change="field.onChange"
        class="w-full bg-[#151b2d] border border-[#45474c] rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none appearance-none"
      ></select>
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

export const batchConfigTemplate = `
<div rv-each-field="batchConfig.fields" class="border-b border-white/5 last:border-0 px-md py-md">
  <div class="flex flex-col lg:flex-row lg:items-start gap-sm lg:gap-md">
    <div class="lg:w-1/2">
      <span rv-text="field.label" class="font-mono-data text-on-surface block"></span>
      <span rv-text="field.description" class="font-body-sm text-on-surface-variant mt-xs block"></span>
    </div>
    <div class="lg:w-1/2">
      <select
        rv-show="field.isSelect"
        rv-html="field.optionsHtml"
        rv-on-change="field.onChange"
        class="w-full bg-[#151b2d] border border-[#45474c] rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none appearance-none"
      ></select>
      <input
        rv-hide="field.isSelect"
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

export const BATCH_CONFIG_FIELD_DEFINITIONS = [
  {
    key: 'withdrawalFeeCoverage',
    label: 'withdrawalFeeCoverage',
    description: 'Who pays the network fee: tenant absorbs it, sender pays on top of the amount, or recipient gets amount minus fee.',
    inputType: 'select',
    options: [
      { value: 'tenant_pays', label: 'tenant_pays — platform absorbs fee (recipient gets full amount)' },
      { value: 'sender_pays', label: 'sender_pays — customer billed amount + fee' },
      { value: 'recipient_pays', label: 'recipient_pays — recipient receives amount − fee' },
    ],
  },
  {
    key: 'tronUsdtWithdrawalFee',
    label: 'tronUsdtWithdrawalFee',
    description: 'Fixed USDT fee charged per withdrawal (micro-USDT, 6 decimals). "0" = no customer fee (platform absorbs). "1000000" = 1 USDT. Applied per the feeCoverage mode above.',
    inputType: 'text',
    placeholder: 'e.g. 1000000 (= 1 USDT), 0 = no fee',
  },
  {
    key: 'btcMinOutputsPerBatch',
    label: 'btcMinOutputsPerBatch',
    description: 'Minimum number of queued withdrawals needed to trigger a batch.',
    inputType: 'number',
    placeholder: 'e.g. 1',
  },
  {
    key: 'btcMaxOutputsPerBatch',
    label: 'btcMaxOutputsPerBatch',
    description: 'Maximum outputs (recipients) included in a single batch transaction.',
    inputType: 'number',
    placeholder: 'e.g. 200',
  },
  {
    key: 'btcMaxBatchAgeSeconds',
    label: 'btcMaxBatchAgeSeconds',
    description: 'Force a batch when the oldest queued withdrawal is this many seconds old.',
    inputType: 'number',
    placeholder: 'e.g. 30',
  },
  {
    key: 'btcMaxFeeRateSatVb',
    label: 'btcMaxFeeRateSatVb',
    description: 'Cap on the network fee rate (sat/vByte). Batch is skipped if fee rate exceeds this.',
    inputType: 'number',
    placeholder: 'e.g. 50',
  },
  {
    key: 'btcTargetBlocks',
    label: 'btcTargetBlocks',
    description: 'Target number of blocks for fee estimation (lower = faster, higher fee).',
    inputType: 'number',
    placeholder: 'e.g. 6',
  },
  {
    key: 'btcRbfEnabled',
    label: 'btcRbfEnabled',
    description: 'Enable Replace-By-Fee signalling on batch transactions.',
    inputType: 'select',
    options: [
      { value: 'true', label: 'true — RBF enabled (opt-in)' },
      { value: 'false', label: 'false — RBF disabled' },
    ],
  },
  {
    key: 'btcBatchingEnabled',
    label: 'btcBatchingEnabled',
    description: 'Master switch for the automatic withdrawal batcher worker.',
    inputType: 'select',
    options: [
      { value: 'true', label: 'true — auto-batching on' },
      { value: 'false', label: 'false — manual only' },
    ],
  },
];

function buildOptionsHtml(options, displayValue) {
  return options.map(o => {
    const sel = o.value === displayValue ? ' selected' : '';
    return `<option value="${o.value}"${sel}>${o.label}</option>`;
  }).join('');
}

function normalizeBatchValue(value, def) {
  if (value === null || value === undefined) return '';
  if (def.inputType === 'select') {
    const hasBooleanOptions = def.options.some(o => o.value === 'true' || o.value === 'false');
    if (hasBooleanOptions) {
      // Backend sends SQLite INTEGER (0/1) for boolean flags — coerce to 'true'/'false' to match option values.
      if (value === true || value === 1 || value === '1' || value === 'true') return 'true';
      if (value === false || value === 0 || value === '0' || value === 'false') return 'false';
    }
  }
  return String(value);
}

export function createBatchConfigFieldsController(rawConfig, onFieldChange) {
  return BATCH_CONFIG_FIELD_DEFINITIONS.map(def => {
    const isSelect = def.inputType === 'select';
    const raw = rawConfig[def.key];
    // batch config is snake_case from backend — also try snake_case key
    const snakeKey = def.key.replace(/([A-Z])/g, c => '_' + c.toLowerCase());
    const value = raw !== undefined ? raw : (rawConfig[snakeKey] !== undefined ? rawConfig[snakeKey] : null);
    const displayValue = normalizeBatchValue(value, def);

    return {
      key: def.key,
      label: def.label,
      description: def.description,
      inputType: isSelect ? 'select' : def.inputType,
      placeholder: def.placeholder || '',
      isSelect,
      displayValue,
      optionsHtml: isSelect ? buildOptionsHtml(def.options, displayValue) : '',
      options: isSelect
        ? def.options.map(o => ({ value: o.value, label: o.label, selected: o.value === displayValue }))
        : [],
      onInput(e) { onFieldChange(def.key, e.target.value); },
      onChange(e) { onFieldChange(def.key, e.target.value); },
    };
  });
}

export function collectBatchConfigValues(fields) {
  const result = {};
  fields.forEach(field => {
    const raw = field.displayValue;
    if (raw === '') return;
    if (field.inputType === 'select' && (raw === 'true' || raw === 'false')) {
      result[field.key] = raw === 'true';
    } else if (field.inputType === 'number' && raw !== '') {
      result[field.key] = Number(raw);
    } else {
      result[field.key] = raw;
    }
  });
  return result;
}

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
    inputType: 'textarea',
    placeholder: 'xpub...',
  },
  {
    key: 'btcSweepThresholdSats',
    label: 'btcSweepThresholdSats',
    description: 'Balance trigger for sweeping UTXOs into cold storage.',
    inputType: 'number',
    placeholder: 'e.g. 100000',
    keepAsString: true,
  },
  {
    key: 'customerSessionTtlSeconds',
    label: 'customerSessionTtlSeconds',
    description: 'Time-to-live for active end-user web sessions.',
    inputType: 'number',
    placeholder: 'e.g. 3600',
  },
  {
    key: 'actorTokenSecret',
    label: 'actorTokenSecret',
    description: 'HMAC-SHA256 secret for X-Actor-Token JWT signing. Min 32 chars. Leave empty to disable actor-level RBAC.',
    inputType: 'text',
    placeholder: 'min. 32 characters — leave empty to disable',
    nullable: true,
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
      optionsHtml: isSelect ? buildOptionsHtml(def.options.map(o => ({ value: o, label: o })), displayValue) : '',
      options: isSelect ? def.options.map(o => ({ value: o, label: o, selected: o === displayValue })) : [],
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
