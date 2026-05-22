import { createFilterPanelController, createFilterPanelTemplate } from './FilterPanel.js';

const STATUS_FILTERS = [
  { value: '',            label: 'All statuses' },
  { value: 'active',      label: 'Active' },
  { value: 'pending',     label: 'Pending' },
  { value: 'restricted',  label: 'Restricted' },
  { value: 'suspended',   label: 'Suspended' },
  { value: 'frozen',      label: 'Frozen' },
  { value: 'closed',      label: 'Closed' },
  { value: 'rejected',    label: 'Rejected' },
  { value: 'disabled',    label: 'Disabled' },
];

const PARTY_TYPE_FILTERS = [
  { value: '',               label: 'All types' },
  { value: 'natural_person', label: 'Natural Person' },
  { value: 'legal_entity',   label: 'Legal Entity' },
];

const IDENTIFIER_TYPES = [
  { value: '',                     label: 'Any type' },
  { value: 'passport',             label: 'Passport' },
  { value: 'national_id',          label: 'National ID' },
  { value: 'driving_license',      label: 'Driving License' },
  { value: 'social_security',      label: 'Social Security' },
  { value: 'tax_id',               label: 'Tax ID' },
  { value: 'vat_id',               label: 'VAT ID' },
  { value: 'company_reg',          label: 'Company Reg.' },
  { value: 'national_business_id', label: 'National Business ID' },
  { value: 'lei',                  label: 'LEI' },
  { value: 'eori',                 label: 'EORI' },
  { value: 'duns',                 label: 'DUNS' },
  { value: 'bic',                  label: 'BIC' },
  { value: 'internal',             label: 'Internal' },
  { value: 'other',                label: 'Other' },
];

const trim = (v) => (v && String(v).trim()) || undefined;

const customerSearchConfig = {
  bindName: 'searchForm',
  title: 'Search Customers',
  helpHtml: 'Use <code class="text-secondary font-mono">*</code> as wildcard — <code class="text-on-surface-variant font-mono">jan*</code> starts with &nbsp;·&nbsp; <code class="text-on-surface-variant font-mono">*ski</code> ends with',
  sections: [
    {
      key: 'core',
      label: 'Core',
      expanded: true,
      fields: [
        { name: 'id', label: 'Customer ID', placeholder: 'cust_...' },
        { name: 'reference', label: 'Reference', placeholder: 'e.g. REF-001 or REF-*' },
        { name: 'display_name', label: 'Display Name', placeholder: 'Kowalski or Kow*' },
        { name: 'status', label: 'Status', type: 'select', options: STATUS_FILTERS },
        { name: 'party_type', label: 'Party Type', type: 'select', options: PARTY_TYPE_FILTERS },
        { name: 'country_of_origin', label: 'Country (ISO-2)', placeholder: 'e.g. PL', maxLength: 2, normalize: (v) => trim(v)?.toUpperCase() },
      ],
    },
    {
      key: 'profile',
      label: 'Profile',
      gridClass: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm mb-md',
      fields: [
        { name: 'profile_given_name', label: 'Given Name', placeholder: 'Jan or Jan*' },
        { name: 'profile_family_name', label: 'Family Name', placeholder: 'Kowalski or *ski' },
        { name: 'profile_middle_name', label: 'Middle Name', placeholder: 'Adam' },
        { name: 'profile_business_name', label: 'Business / Legal Name', placeholder: 'Acme or Acme*' },
      ],
    },
    {
      key: 'contact',
      label: 'Contact',
      gridClass: 'grid grid-cols-1 sm:grid-cols-2 gap-sm mb-md',
      fields: [
        { name: 'contact_email', label: 'Email', placeholder: 'jan@* or *@example.com' },
        { name: 'contact_phone', label: 'Phone', placeholder: '+48* or *789' },
      ],
    },
    {
      key: 'identifier',
      label: 'Identifier',
      gridClass: 'grid grid-cols-1 sm:grid-cols-2 gap-sm mb-md',
      fields: [
        { name: 'identifier_type', label: 'Type', type: 'select', options: IDENTIFIER_TYPES },
        { name: 'identifier_value', label: 'Value', placeholder: 'AB123456 or AB1*' },
      ],
    },
    {
      key: 'relationship',
      label: 'Relationship (External Party)',
      gridClass: 'grid grid-cols-1 sm:grid-cols-3 gap-sm mb-md',
      fields: [
        { name: 'rel_display_name', label: 'Party Name', placeholder: 'Hans Mueller or Hans*' },
        { name: 'rel_identifier_type', label: 'ID Type', type: 'select', options: IDENTIFIER_TYPES },
        { name: 'rel_identifier_value', label: 'ID Value', placeholder: 'DE987654 or DE9*' },
      ],
    },
  ],
};

export const template = createFilterPanelTemplate(customerSearchConfig);

export function createCustomerSearchFormController({ onSearch, onClear }) {
  const ctrl = createFilterPanelController(customerSearchConfig, { onSearch, onClear });

  ctrl.statusFilters = STATUS_FILTERS;
  ctrl.partyTypeFilters = PARTY_TYPE_FILTERS;
  ctrl.identifierTypes = IDENTIFIER_TYPES;

  return ctrl;
}
