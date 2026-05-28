import { createFilterPanelController, createFilterPanelTemplate } from './FilterPanel.js';

const CATEGORY_FILTERS = [
  { value: '',                 label: 'All categories' },
  { value: 'wallet',           label: 'Wallet' },
  { value: 'address',          label: 'Address' },
  { value: 'payment_request',  label: 'Payment Request' },
  { value: 'deposit',          label: 'Deposit' },
  { value: 'withdrawal',       label: 'Withdrawal' },
  { value: 'withdrawal_batch', label: 'Withdrawal Batch' },
  { value: 'sweep',            label: 'Sweep' },
  { value: 'webhook',          label: 'Webhook' },
  { value: 'customer',         label: 'Customer' },
  { value: 'ledger',           label: 'Ledger' },
  { value: 'signing_task',     label: 'Signing Task' },
  { value: 'external_signer',  label: 'External Signer' },
  { value: 'platform',         label: 'Platform' },
  { value: 'transaction',      label: 'Transaction' },
];

const dateToStartMs = (v) => {
  if (!v) return undefined;
  const t = new Date(v + 'T00:00:00').getTime();
  return isNaN(t) ? undefined : t;
};

const dateToEndMs = (v) => {
  if (!v) return undefined;
  const t = new Date(v + 'T23:59:59.999').getTime();
  return isNaN(t) ? undefined : t;
};

const auditLogSearchConfig = {
  bindName: 'auditLogSearchForm',
  title: 'Filter Audit Logs',
  sections: [
    {
      key: 'core',
      label: 'Filters',
      expanded: true,
      fields: [
        { name: 'category',    label: 'Category',    type: 'select', options: CATEGORY_FILTERS },
        { name: 'subcategory', label: 'Subcategory', placeholder: 'created, updated…' },
        { name: 'entity_id',   label: 'Entity ID',   placeholder: 'abc*' },
        { name: 'actor_login', label: 'Actor Login', placeholder: 'user_123' },
      ],
    },
    {
      key: 'dates',
      label: 'Date Range',
      expanded: false,
      gridClass: 'grid grid-cols-1 sm:grid-cols-2 gap-sm mb-md',
      fields: [
        { name: 'from', label: 'From', inputType: 'date', normalize: dateToStartMs },
        { name: 'to',   label: 'To',   inputType: 'date', normalize: dateToEndMs },
      ],
    },
  ],
};

export const template = createFilterPanelTemplate(auditLogSearchConfig);

export function createAuditLogSearchFormController({ onSearch, onClear }) {
  return createFilterPanelController(auditLogSearchConfig, { onSearch, onClear });
}
