import { createFilterPanelController, createFilterPanelTemplate } from './FilterPanel.js';

const STATUS_FILTERS = [
  { value: '',                     label: 'All statuses' },
  { value: 'detected',             label: 'Detected' },
  { value: 'pending_confirmation', label: 'Pending confirmation' },
  { value: 'confirmed',            label: 'Confirmed' },
  { value: 'finalized',            label: 'Finalized' },
];

const trim = (v) => (v && String(v).trim()) || undefined;
const positiveInt = (v) => {
  const value = trim(v);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const depositSearchConfig = {
  bindName: 'depositSearchForm',
  title: 'Filter Deposits',
  helpHtml: 'Text filters accept <code class="text-secondary font-mono">*</code> wildcards. Confirmation filters are inclusive.',
  sections: [
    {
      key: 'core',
      label: 'Core',
      expanded: true,
      fields: [
        { name: 'depositId', label: 'Deposit ID', placeholder: 'dep_...' },
        { name: 'status', label: 'Status', type: 'select', options: STATUS_FILTERS },
        { name: 'assetId', label: 'Asset', placeholder: 'bitcoin:BTC' },
      ],
    },
    {
      key: 'chain',
      label: 'Chain Data',
      gridClass: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sm mb-md',
      fields: [
        { name: 'txHash', label: 'TX Hash', placeholder: '958a... or 958a*' },
        { name: 'address', label: 'Address', placeholder: 'bcrt1... or *k38wuf' },
        { name: 'minConfirmations', label: 'Min Confirmations', inputType: 'number', placeholder: '0', normalize: positiveInt },
        { name: 'maxConfirmations', label: 'Max Confirmations', inputType: 'number', placeholder: '110', normalize: positiveInt },
      ],
    },
  ],
};

export const template = createFilterPanelTemplate(depositSearchConfig);

export function createDepositSearchFormController({ onSearch, onClear }) {
  const ctrl = createFilterPanelController(depositSearchConfig, { onSearch, onClear });
  ctrl.statusFilters = STATUS_FILTERS;
  return ctrl;
}
