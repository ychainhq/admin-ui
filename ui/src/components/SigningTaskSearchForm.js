import { createFilterPanelController, createFilterPanelTemplate } from './FilterPanel.js';

const STATUS_FILTERS = [
  { value: '',                 label: 'All statuses' },
  { value: 'created',          label: 'Created' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved',         label: 'Approved' },
  { value: 'available',        label: 'Available' },
  { value: 'claimed',          label: 'Claimed' },
  { value: 'signing',          label: 'Signing' },
  { value: 'signed',           label: 'Signed' },
  { value: 'submitted',        label: 'Submitted' },
  { value: 'rejected',         label: 'Rejected' },
  { value: 'failed',           label: 'Failed' },
  { value: 'expired',          label: 'Expired' },
  { value: 'cancelled',        label: 'Cancelled' },
];

const REQUEST_TYPE_FILTERS = [
  { value: '',                      label: 'All types' },
  { value: 'btc_withdrawal_batch',  label: 'BTC Withdrawal Batch' },
  { value: 'btc_sweep',             label: 'BTC Sweep' },
  { value: 'evm_withdrawal',        label: 'EVM Withdrawal' },
];

const signingTaskSearchConfig = {
  bindName: 'signingTaskSearchForm',
  title: 'Filter Tasks',
  sections: [
    {
      key: 'core',
      label: 'Filters',
      expanded: true,
      fields: [
        { name: 'status',      label: 'Status', type: 'select', options: STATUS_FILTERS },
        { name: 'requestType', label: 'Type',   type: 'select', options: REQUEST_TYPE_FILTERS },
      ],
    },
  ],
};

export const template = createFilterPanelTemplate(signingTaskSearchConfig);

export function createSigningTaskSearchFormController({ onSearch, onClear }) {
  return createFilterPanelController(signingTaskSearchConfig, { onSearch, onClear });
}
