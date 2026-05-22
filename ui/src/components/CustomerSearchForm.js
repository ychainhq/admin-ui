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

// Maps section keys → form field names (used for activeCount computation)
const SECTION_FIELDS = {
  core:         ['id', 'reference', 'display_name', 'status', 'party_type', 'country_of_origin'],
  profile:      ['profile_given_name', 'profile_family_name', 'profile_middle_name', 'profile_business_name'],
  contact:      ['contact_email', 'contact_phone'],
  identifier:   ['identifier_type', 'identifier_value'],
  relationship: ['rel_display_name', 'rel_identifier_type', 'rel_identifier_value'],
};

const inputClass  = 'w-full glass-card border border-white/10 rounded-lg px-3 py-2 text-body-sm text-on-surface bg-transparent focus:ring-1 focus:ring-secondary outline-none placeholder:text-on-surface-variant/40';
const labelClass  = 'block text-label-sm text-on-surface-variant mb-1';
const selectClass = `${inputClass} cursor-pointer appearance-none`;

const toggleRowClass = 'flex items-center justify-between text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant/60 mb-sm cursor-pointer select-none hover:text-on-surface-variant/80 transition-colors -mx-1 px-1 rounded';
const badgeClass     = 'normal-case tracking-normal text-[11px] font-semibold text-secondary bg-secondary/10 border border-secondary/20 px-2 py-0.5 rounded-full';

// Builds the collapsible section header row (shared across all 5 sections)
const mkHead = (key, label) => `
<div rv-on-click="searchForm.sections.${key}.toggle" class="${toggleRowClass}">
  <span>${label}</span>
  <span class="flex items-center gap-xs">
    <span rv-show="searchForm.sections.${key}.activeCount" class="${badgeClass}">
      <span rv-text="searchForm.sections.${key}.activeCount"></span> active
    </span>
    <span rv-show="searchForm.sections.${key}.expanded"  class="material-symbols-outlined text-[16px]">expand_less</span>
    <span rv-hide="searchForm.sections.${key}.expanded"  class="material-symbols-outlined text-[16px]">expand_more</span>
  </span>
</div>`;

export const template = `
<div class="glass-card rounded-xl p-md mb-gutter">

  <h3 class="text-title-md font-semibold text-on-surface mb-md">Search Customers</h3>

  <!-- CORE (expanded by default) -->
  ${mkHead('core', 'Core')}
  <div rv-show="searchForm.sections.core.expanded">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sm mb-md">
      <div>
        <label class="${labelClass}">Customer ID</label>
        <input rv-on-input="searchForm.onFormInput" name="id" type="text" placeholder="cust_..." class="${inputClass}">
      </div>
      <div>
        <label class="${labelClass}">Reference</label>
        <input rv-on-input="searchForm.onFormInput" name="reference" type="text" placeholder="e.g. REF-001 or REF-*" class="${inputClass}">
      </div>
      <div>
        <label class="${labelClass}">Display Name</label>
        <input rv-on-input="searchForm.onFormInput" name="display_name" type="text" placeholder="Kowalski or Kow*" class="${inputClass}">
      </div>
      <div>
        <label class="${labelClass}">Status</label>
        <select rv-on-change="searchForm.onFormInput" name="status" class="${selectClass}">
          <option rv-each-f="searchForm.statusFilters" rv-attr-value="f.value" rv-text="f.label"></option>
        </select>
      </div>
      <div>
        <label class="${labelClass}">Party Type</label>
        <select rv-on-change="searchForm.onFormInput" name="party_type" class="${selectClass}">
          <option rv-each-f="searchForm.partyTypeFilters" rv-attr-value="f.value" rv-text="f.label"></option>
        </select>
      </div>
      <div>
        <label class="${labelClass}">Country (ISO-2)</label>
        <input rv-on-input="searchForm.onFormInput" name="country_of_origin" type="text" placeholder="e.g. PL" maxlength="2" class="${inputClass}">
      </div>
    </div>
  </div>

  <!-- PROFILE (collapsed by default) -->
  ${mkHead('profile', 'Profile')}
  <div rv-show="searchForm.sections.profile.expanded">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-sm mb-md">
      <div>
        <label class="${labelClass}">Given Name</label>
        <input rv-on-input="searchForm.onFormInput" name="profile_given_name" type="text" placeholder="Jan or Jan*" class="${inputClass}">
      </div>
      <div>
        <label class="${labelClass}">Family Name</label>
        <input rv-on-input="searchForm.onFormInput" name="profile_family_name" type="text" placeholder="Kowalski or *ski" class="${inputClass}">
      </div>
      <div>
        <label class="${labelClass}">Middle Name</label>
        <input rv-on-input="searchForm.onFormInput" name="profile_middle_name" type="text" placeholder="Adam" class="${inputClass}">
      </div>
      <div>
        <label class="${labelClass}">Business / Legal Name</label>
        <input rv-on-input="searchForm.onFormInput" name="profile_business_name" type="text" placeholder="Acme or Acme*" class="${inputClass}">
      </div>
    </div>
  </div>

  <!-- CONTACT (collapsed by default) -->
  ${mkHead('contact', 'Contact')}
  <div rv-show="searchForm.sections.contact.expanded">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm mb-md">
      <div>
        <label class="${labelClass}">Email</label>
        <input rv-on-input="searchForm.onFormInput" name="contact_email" type="text" placeholder="jan@* or *@example.com" class="${inputClass}">
      </div>
      <div>
        <label class="${labelClass}">Phone</label>
        <input rv-on-input="searchForm.onFormInput" name="contact_phone" type="text" placeholder="+48* or *789" class="${inputClass}">
      </div>
    </div>
  </div>

  <!-- IDENTIFIER (collapsed by default) -->
  ${mkHead('identifier', 'Identifier')}
  <div rv-show="searchForm.sections.identifier.expanded">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm mb-md">
      <div>
        <label class="${labelClass}">Type</label>
        <select rv-on-change="searchForm.onFormInput" name="identifier_type" class="${selectClass}">
          <option rv-each-f="searchForm.identifierTypes" rv-attr-value="f.value" rv-text="f.label"></option>
        </select>
      </div>
      <div>
        <label class="${labelClass}">Value</label>
        <input rv-on-input="searchForm.onFormInput" name="identifier_value" type="text" placeholder="AB123456 or AB1*" class="${inputClass}">
      </div>
    </div>
  </div>

  <!-- RELATIONSHIP (collapsed by default) -->
  ${mkHead('relationship', 'Relationship (External Party)')}
  <div rv-show="searchForm.sections.relationship.expanded">
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-sm mb-md">
      <div>
        <label class="${labelClass}">Party Name</label>
        <input rv-on-input="searchForm.onFormInput" name="rel_display_name" type="text" placeholder="Hans Mueller or Hans*" class="${inputClass}">
      </div>
      <div>
        <label class="${labelClass}">ID Type</label>
        <select rv-on-change="searchForm.onFormInput" name="rel_identifier_type" class="${selectClass}">
          <option rv-each-f="searchForm.identifierTypes" rv-attr-value="f.value" rv-text="f.label"></option>
        </select>
      </div>
      <div>
        <label class="${labelClass}">ID Value</label>
        <input rv-on-input="searchForm.onFormInput" name="rel_identifier_value" type="text" placeholder="DE987654 or DE9*" class="${inputClass}">
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="flex items-center justify-between pt-md border-t border-white/10">
    <p class="text-body-sm text-on-surface-variant/60 hidden sm:block">
      Use <code class="text-secondary font-mono">*</code> as wildcard — <code class="text-on-surface-variant font-mono">jan*</code> starts with &nbsp;·&nbsp; <code class="text-on-surface-variant font-mono">*ski</code> ends with
    </p>
    <div class="flex gap-sm ml-auto">
      <button rv-on-click="searchForm.onClear"
        class="px-md py-2 rounded-lg border border-white/10 text-label-md text-on-surface-variant hover:bg-white/5 transition-colors">
        Clear
      </button>
      <button rv-on-click="searchForm.onSearch"
        class="flex items-center gap-xs px-md py-2 rounded-lg bg-secondary text-on-secondary-fixed text-label-md font-semibold hover:brightness-110 transition-all">
        <span class="material-symbols-outlined text-[18px]">search</span>
        Search
      </button>
    </div>
  </div>

</div>
`;

/**
 * @param {{ onSearch: (filters: object) => void, onClear: () => void }} props
 */
export function createCustomerSearchFormController({ onSearch, onClear }) {
  const makeSection = (expanded) => {
    const section = {
      expanded,
      activeCount: 0,
      toggle(e) { e?.preventDefault(); section.expanded = !section.expanded; },
    };
    return section;
  };

  const self = {
    statusFilters:    STATUS_FILTERS,
    partyTypeFilters: PARTY_TYPE_FILTERS,
    identifierTypes:  IDENTIFIER_TYPES,

    sections: {
      core:         makeSection(true),
      profile:      makeSection(false),
      contact:      makeSection(false),
      identifier:   makeSection(false),
      relationship: makeSection(false),
    },

    _form: {
      id: '', reference: '', display_name: '', status: '', party_type: '', country_of_origin: '',
      profile_given_name: '', profile_family_name: '', profile_middle_name: '', profile_business_name: '',
      contact_email: '', contact_phone: '',
      identifier_type: '', identifier_value: '',
      rel_display_name: '', rel_identifier_type: '', rel_identifier_value: '',
    },

    onFormInput(e) {
      const field = e.target.name;
      if (field) {
        self._form[field] = e.target.value;
        syncCounts();
      }
    },

    onSearch(e) {
      e?.preventDefault();
      const f = self._form;
      const trim = (v) => (v && v.trim()) || undefined;
      onSearch({
        id:                    trim(f.id),
        reference:             trim(f.reference),
        display_name:          trim(f.display_name),
        status:                trim(f.status),
        party_type:            trim(f.party_type),
        country_of_origin:     trim(f.country_of_origin)?.toUpperCase(),
        profile_given_name:    trim(f.profile_given_name),
        profile_family_name:   trim(f.profile_family_name),
        profile_middle_name:   trim(f.profile_middle_name),
        profile_business_name: trim(f.profile_business_name),
        contact_email:         trim(f.contact_email),
        contact_phone:         trim(f.contact_phone),
        identifier_type:       trim(f.identifier_type),
        identifier_value:      trim(f.identifier_value),
        rel_display_name:      trim(f.rel_display_name),
        rel_identifier_type:   trim(f.rel_identifier_type),
        rel_identifier_value:  trim(f.rel_identifier_value),
      });
    },

    onClear(e) {
      e?.preventDefault();
      Object.keys(self._form).forEach(k => { self._form[k] = ''; });
      syncCounts();
      onClear();
    },
  };

  // Recomputes activeCount for every section from current _form state.
  // Function declaration so it is hoisted and available inside onFormInput/onClear above.
  function syncCounts() {
    for (const [key, fields] of Object.entries(SECTION_FIELDS)) {
      self.sections[key].activeCount = fields.filter(n => self._form[n]).length;
    }
  }

  return self;
}
