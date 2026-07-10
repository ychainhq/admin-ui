import { createFilterPanelController, createFilterPanelTemplate } from './FilterPanel.js';

function positiveInt(raw) {
  const n = parseInt(raw, 10);
  return (!isNaN(n) && n > 0) ? String(n) : undefined;
}

const STATUS_OPTIONS = [
  { value: '',                  label: 'All statuses' },
  { value: 'pending_signature', label: 'Pending signature' },
  { value: 'broadcast',        label: 'Broadcast' },
  { value: 'confirmed',        label: 'Confirmed' },
  { value: 'failed',           label: 'Failed' },
];

const CHAIN_OPTIONS = [
  { value: '',        label: 'All chains' },
  { value: 'bitcoin', label: 'Bitcoin' },
  { value: 'tron',    label: 'TRON' },
];

const ASSET_OPTIONS = [
  { value: '',            label: 'All assets' },
  { value: 'bitcoin:BTC', label: 'BTC' },
  { value: 'tron:TRX',   label: 'TRX' },
  { value: 'tron:USDT',  label: 'USDT (TRC-20)' },
];

const sweepSearchConfig = {
  bindName: 'sweepSearchForm',
  title: 'Filter Sweeps',
  sections: [
    {
      key: 'core',
      label: 'Filters',
      expanded: true,
      fields: [
        { name: 'chainId', label: 'Chain',  type: 'select', options: CHAIN_OPTIONS },
        { name: 'assetId', label: 'Asset',  type: 'select', options: ASSET_OPTIONS },
        { name: 'status',  label: 'Status', type: 'select', options: STATUS_OPTIONS },
      ],
    },
    {
      key: 'advanced',
      label: 'Amount & Date',
      expanded: false,
      fields: [
        { name: 'amountGt', label: 'Amount >',    inputType: 'number', normalize: positiveInt, placeholder: 'sats' },
        { name: 'amountLt', label: 'Amount <',    inputType: 'number', normalize: positiveInt, placeholder: 'sats' },
        { name: 'createdFrom', label: 'Created from', inputType: 'date' },
        { name: 'createdTo',   label: 'Created to',   inputType: 'date' },
      ],
    },
  ],
};

export const template = createFilterPanelTemplate(sweepSearchConfig);

export function createSweepSearchFormController({ onSearch, onClear }) {
  return createFilterPanelController(sweepSearchConfig, { onSearch, onClear });
}
