import { createFilterPanelController, createFilterPanelTemplate } from './FilterPanel.js';

const STATUS_FILTERS = [
  { value: '',         label: 'All statuses' },
  { value: 'pending',  label: 'Pending' },
  { value: 'claimed',  label: 'Claimed' },
  { value: 'signed',   label: 'Signed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired',  label: 'Expired' },
];

const REQUEST_TYPE_FILTERS = [
  { value: '',                      label: 'All types' },
  { value: 'btc_withdrawal_batch',  label: 'BTC Withdrawal Batch' },
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
