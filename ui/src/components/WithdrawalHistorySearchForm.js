import { createFilterPanelController, createFilterPanelTemplate } from './FilterPanel.js';

const STATUS_FILTERS = [
  { value: '',                   label: 'All statuses' },
  { value: 'queued',             label: 'Queued' },
  { value: 'pending_approval',   label: 'Pending approval' },
  { value: 'pending_signature',  label: 'Pending signature' },
  { value: 'broadcast',          label: 'Broadcast' },
  { value: 'confirmed',          label: 'Confirmed' },
  { value: 'failed',             label: 'Failed' },
  { value: 'cancelled',          label: 'Cancelled' },
];

const withdrawalHistorySearchConfig = {
  bindName: 'withdrawalHistorySearchForm',
  title: 'Filter Withdrawals',
  sections: [
    {
      key: 'core',
      label: 'Filters',
      expanded: true,
      fields: [
        { name: 'status',    label: 'Status',     type: 'select', options: STATUS_FILTERS },
        { name: 'toAddress', label: 'To Address', placeholder: 'bcrt1q…' },
      ],
    },
  ],
};

export const template = createFilterPanelTemplate(withdrawalHistorySearchConfig);

export function createWithdrawalHistorySearchFormController({ onSearch, onClear }) {
  return createFilterPanelController(withdrawalHistorySearchConfig, { onSearch, onClear });
}
