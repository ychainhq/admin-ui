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

const sweepSearchConfig = {
  bindName: 'sweepSearchForm',
  title: 'Filter Sweeps',
  sections: [
    {
      key: 'core',
      label: 'Filters',
      expanded: true,
      fields: [
        { name: 'status', label: 'Status', type: 'select', options: STATUS_OPTIONS },
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
