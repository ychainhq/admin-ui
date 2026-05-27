import { createFilterPanelController, createFilterPanelTemplate } from './FilterPanel.js';

const STATUS_FILTERS = [
  { value: '',                   label: 'All statuses' },
  { value: 'building',           label: 'Building' },
  { value: 'pending_approval',   label: 'Pending approval' },
  { value: 'pending_signature',  label: 'Pending signature' },
  { value: 'broadcast',          label: 'Broadcast' },
  { value: 'confirmed',          label: 'Confirmed' },
  { value: 'failed',             label: 'Failed' },
  { value: 'cancelled',          label: 'Cancelled' },
];

const withdrawalBatchSearchConfig = {
  bindName: 'withdrawalBatchSearchForm',
  title: 'Filter Batches',
  sections: [
    {
      key: 'core',
      label: 'Filters',
      expanded: true,
      fields: [
        { name: 'status',  label: 'Status',   type: 'select', options: STATUS_FILTERS },
        { name: 'chainId', label: 'Chain ID', placeholder: 'bitcoin' },
      ],
    },
  ],
};

export const template = createFilterPanelTemplate(withdrawalBatchSearchConfig);

export function createWithdrawalBatchSearchFormController({ onSearch, onClear }) {
  return createFilterPanelController(withdrawalBatchSearchConfig, { onSearch, onClear });
}
