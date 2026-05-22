import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';

const ROUTE = '/customers';

const IDENTIFIER_TYPES = [
  'passport','national_id','driving_license','social_security',
  'tax_id','vat_id','company_reg','national_business_id',
  'lei','eori','duns','bic','internal','other',
];

const DOCUMENT_TYPES = [
  'passport','national_id','driving_license','proof_of_address','bank_statement',
  'company_certificate','articles_of_association','trust_deed','foundation_charter',
  'ubo_declaration','power_of_attorney','tax_certificate','financial_statements',
  'aml_questionnaire','regulatory_license','other',
];

const ADDRESS_TYPES = ['registered','correspondence','residential','operational'];

const ENTITY_SUBTYPES = ['company','foundation','association','ngo','public_body','trust','other'];

const template = `
<div class="min-h-screen">

  ${sidebarTpl}

  <div class="lg:ml-[280px]">

    ${topBarTpl}

    <!-- Desktop top bar -->
    <div class="hidden lg:flex fixed top-0 left-[280px] right-0 z-40 bg-surface-dim/80 backdrop-blur-xl border-b border-white/10 items-center justify-between px-margin-desktop h-16">
      <div class="flex flex-col">
        <span class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">Platform &gt; Customers &gt; New</span>
      </div>
      <div rv-hide="success" class="flex items-center gap-sm">
        <button rv-on-click="cancel"
          class="border border-white/20 text-on-surface px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:bg-white/5">
          Cancel
        </button>
        <button rv-on-click="submit" rv-attr-disabled="submitting"
          class="bg-secondary text-on-secondary-fixed px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:brightness-110 disabled:opacity-50">
          <span rv-hide="submitting">Create Customer</span>
          <span rv-show="submitting">Creating…</span>
        </button>
      </div>
    </div>

    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="max-w-xl mx-auto">

        <div class="pt-gutter mb-gutter">
          <h1 class="font-headline-md text-headline-md text-on-surface">New Customer</h1>
          <p rv-hide="success" class="font-body-sm text-on-surface-variant mt-xs">Register a new customer for the active tenant.</p>
        </div>

        <!-- ══════════════════════════════════════════ SUCCESS STATE -->
        <div rv-show="success" class="glass-card rounded-xl p-lg text-center space-y-md">
          <div class="flex flex-col items-center gap-sm">
            <span class="material-symbols-outlined text-tertiary text-5xl">check_circle</span>
            <h2 class="font-headline-sm text-on-surface">Customer created</h2>
          </div>
          <div class="bg-surface-container-low rounded-lg px-md py-sm text-left space-y-xs">
            <p class="font-body-sm text-on-surface-variant">ID</p>
            <p class="font-mono-data text-on-surface text-sm break-all" rv-text="success.id"></p>
            <p rv-show="success.reference" class="font-body-sm text-on-surface-variant mt-xs">Reference</p>
            <p rv-show="success.reference" class="font-body-sm text-on-surface" rv-text="success.reference"></p>
          </div>
          <!-- Sub-call warnings -->
          <div rv-show="hasSubErrors" class="bg-error/10 border border-error/30 rounded-lg px-md py-sm text-left space-y-xs">
            <p class="font-label-md text-[10px] uppercase text-error">Partial failures — data can be added from the customer profile</p>
            <p rv-each-e="subErrors" rv-text="e" class="font-body-sm text-error"></p>
          </div>
          <div class="flex gap-sm justify-center pt-sm">
            <button rv-on-click="viewCustomer"
              class="bg-secondary text-on-secondary-fixed px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:brightness-110">
              View Customer
            </button>
            <button rv-on-click="createAnother"
              class="border border-white/20 text-on-surface px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:bg-white/5">
              + Create Another
            </button>
          </div>
        </div>

        <!-- ══════════════════════════════════════════ FORM -->
        <div rv-hide="success" class="space-y-gutter">

          <!-- Error banner -->
          <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-error">error</span>
              <span rv-text="error" class="font-body-sm text-error"></span>
            </div>
          </div>

          <!-- ── Basic ── -->
          <div class="glass-card rounded-xl p-md space-y-md">
            <p class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">Basic</p>

            <!-- Party type -->
            <div>
              <label class="block font-label-md text-on-surface-variant text-[10px] uppercase mb-xs">Party Type</label>
              <div class="flex gap-sm">
                <button rv-show="isNaturalPerson" rv-on-click="setNaturalPerson"
                  class="flex-1 py-sm rounded-lg font-headline-sm text-[13px] font-bold transition-all border bg-secondary text-on-secondary-fixed border-secondary">
                  Natural Person
                </button>
                <button rv-hide="isNaturalPerson" rv-on-click="setNaturalPerson"
                  class="flex-1 py-sm rounded-lg font-headline-sm text-[13px] font-bold transition-all border border-white/20 text-on-surface hover:bg-white/5">
                  Natural Person
                </button>
                <button rv-hide="isLegalEntity" rv-on-click="setLegalEntity"
                  class="flex-1 py-sm rounded-lg font-headline-sm text-[13px] font-bold transition-all border border-white/20 text-on-surface hover:bg-white/5">
                  Legal Entity
                </button>
                <button rv-show="isLegalEntity" rv-on-click="setLegalEntity"
                  class="flex-1 py-sm rounded-lg font-headline-sm text-[13px] font-bold transition-all border bg-secondary text-on-secondary-fixed border-secondary">
                  Legal Entity
                </button>
              </div>
            </div>

            <!-- Reference -->
            <div>
              <label class="block font-label-md text-on-surface-variant text-[10px] uppercase mb-xs">
                Reference <span class="normal-case opacity-60">(optional)</span>
              </label>
              <input rv-on-input="onReferenceInput"
                class="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
                type="text" placeholder="e.g. user-abc-123" autocomplete="off" />
            </div>

            <!-- Metadata -->
            <div>
              <label class="block font-label-md text-on-surface-variant text-[10px] uppercase mb-xs">
                Metadata <span class="normal-case opacity-60">(optional JSON)</span>
              </label>
              <textarea rv-on-input="onMetadataInput"
                class="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none resize-none"
                rows="3" placeholder='{ "plan": "pro" }'></textarea>
              <p rv-show="metadataError" rv-text="metadataError" class="font-body-sm text-error mt-xs"></p>
            </div>
          </div>

          <!-- ── Profile ── -->
          <div class="glass-card rounded-xl overflow-hidden">
            <button rv-on-click="toggleProfile"
              class="w-full flex items-center justify-between px-md py-sm hover:bg-white/5 transition-all">
              <span class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">
                Profile <span class="normal-case opacity-60">(optional)</span>
              </span>
              <span class="material-symbols-outlined text-on-surface-variant text-lg" rv-text="profileChevron"></span>
            </button>
            <div rv-show="profileOpen" class="px-md pb-md space-y-md border-t border-white/10 pt-md">

              <!-- natural_person fields -->
              <div rv-show="isNaturalPerson">
                <div class="grid grid-cols-3 gap-sm mb-md">
                  <div>
                    <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">First name *</label>
                    <input rv-on-input="onProfileInput" data-field="given_name"
                      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm"
                      type="text" placeholder="Jan" />
                  </div>
                  <div>
                    <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Middle name</label>
                    <input rv-on-input="onProfileInput" data-field="middle_name"
                      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm"
                      type="text" placeholder="Maria" />
                  </div>
                  <div>
                    <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Last name *</label>
                    <input rv-on-input="onProfileInput" data-field="family_name"
                      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm"
                      type="text" placeholder="Kowalski" />
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-sm">
                  <div>
                    <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Date of birth</label>
                    <input rv-on-input="onProfileInput" data-field="date_of_birth"
                      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm"
                      type="date" />
                  </div>
                  <div>
                    <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Nationality</label>
                    <input rv-on-input="onProfileInput" data-field="nationality"
                      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm uppercase"
                      type="text" placeholder="PL" maxlength="2" />
                  </div>
                </div>
                <p rv-show="profileError" rv-text="profileError" class="font-body-sm text-error mt-xs"></p>
              </div>

              <!-- legal_entity fields -->
              <div rv-show="isLegalEntity">
                <div class="space-y-md">
                  <div>
                    <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Entity subtype *</label>
                    <select rv-on-change="onEntitySubtypeChange"
                      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm">
                      <option value="">— select —</option>
                      <option value="company">Company</option>
                      <option value="foundation">Foundation</option>
                      <option value="association">Association</option>
                      <option value="ngo">NGO</option>
                      <option value="public_body">Public body</option>
                      <option value="trust">Trust</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Legal name *</label>
                    <input rv-on-input="onProfileInput" data-field="legal_name"
                      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm"
                      type="text" placeholder="ACME Sp. z o.o." />
                  </div>
                  <div>
                    <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Country of incorporation *</label>
                    <input rv-on-input="onProfileInput" data-field="country_of_incorporation"
                      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm uppercase"
                      type="text" placeholder="PL" maxlength="2" />
                  </div>
                </div>
                <p rv-show="profileError" rv-text="profileError" class="font-body-sm text-error mt-xs"></p>
              </div>

            </div>
          </div>

          <!-- ── Identifier ── -->
          <div class="glass-card rounded-xl overflow-hidden">
            <button rv-on-click="toggleIdentifier"
              class="w-full flex items-center justify-between px-md py-sm hover:bg-white/5 transition-all">
              <span class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">
                Identifier <span class="normal-case opacity-60">(optional)</span>
              </span>
              <span class="material-symbols-outlined text-on-surface-variant text-lg" rv-text="identifierChevron"></span>
            </button>
            <div rv-show="identifierOpen" class="px-md pb-md space-y-md border-t border-white/10 pt-md">
              <div class="grid grid-cols-2 gap-sm">
                <div>
                  <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Type</label>
                  <select rv-on-change="onIdentifierTypeChange"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary transition-all outline-none text-sm">
                    <option value="">— select —</option>
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="driving_license">Driving license</option>
                    <option value="social_security">Social security</option>
                    <option value="tax_id">Tax ID</option>
                    <option value="vat_id">VAT ID</option>
                    <option value="company_reg">Company reg.</option>
                    <option value="national_business_id">National business ID</option>
                    <option value="lei">LEI</option>
                    <option value="eori">EORI</option>
                    <option value="duns">DUNS</option>
                    <option value="bic">BIC</option>
                    <option value="internal">Internal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Value</label>
                  <input rv-on-input="onIdentifierValueInput"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm"
                    type="text" placeholder="AB 123456" />
                </div>
              </div>
            </div>
          </div>

          <!-- ── Document ── -->
          <div class="glass-card rounded-xl overflow-hidden">
            <button rv-on-click="toggleDocument"
              class="w-full flex items-center justify-between px-md py-sm hover:bg-white/5 transition-all">
              <span class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">
                Document <span class="normal-case opacity-60">(optional)</span>
              </span>
              <span class="material-symbols-outlined text-on-surface-variant text-lg" rv-text="documentChevron"></span>
            </button>
            <div rv-show="documentOpen" class="px-md pb-md space-y-md border-t border-white/10 pt-md">
              <div class="grid grid-cols-2 gap-sm">
                <div>
                  <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Type</label>
                  <select rv-on-change="onDocumentTypeChange"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary transition-all outline-none text-sm">
                    <option value="">— select —</option>
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="driving_license">Driving license</option>
                    <option value="proof_of_address">Proof of address</option>
                    <option value="bank_statement">Bank statement</option>
                    <option value="company_certificate">Company certificate</option>
                    <option value="articles_of_association">Articles of association</option>
                    <option value="trust_deed">Trust deed</option>
                    <option value="foundation_charter">Foundation charter</option>
                    <option value="ubo_declaration">UBO declaration</option>
                    <option value="power_of_attorney">Power of attorney</option>
                    <option value="tax_certificate">Tax certificate</option>
                    <option value="financial_statements">Financial statements</option>
                    <option value="aml_questionnaire">AML questionnaire</option>
                    <option value="regulatory_license">Regulatory license</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Document number</label>
                  <input rv-on-input="onDocumentNumberInput"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm"
                    type="text" placeholder="AB 123456" />
                </div>
              </div>
            </div>
          </div>

          <!-- ── Primary Address ── -->
          <div class="glass-card rounded-xl overflow-hidden">
            <button rv-on-click="toggleAddress"
              class="w-full flex items-center justify-between px-md py-sm hover:bg-white/5 transition-all">
              <span class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">
                Primary Address <span class="normal-case opacity-60">(optional)</span>
              </span>
              <span class="material-symbols-outlined text-on-surface-variant text-lg" rv-text="addressChevron"></span>
            </button>
            <div rv-show="addressOpen" class="px-md pb-md space-y-md border-t border-white/10 pt-md">
              <div>
                <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Address type</label>
                <select rv-on-change="onAddressTypeChange"
                  class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary transition-all outline-none text-sm">
                  <option value="registered">Registered</option>
                  <option value="correspondence">Correspondence</option>
                  <option value="residential">Residential</option>
                  <option value="operational">Operational</option>
                </select>
              </div>
              <div>
                <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Line 1</label>
                <input rv-on-input="onAddressInput" data-field="line1"
                  class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm"
                  type="text" placeholder="ul. Testowa 1" />
              </div>
              <div class="grid grid-cols-2 gap-sm">
                <div>
                  <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">City</label>
                  <input rv-on-input="onAddressInput" data-field="city"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm"
                    type="text" placeholder="Warszawa" />
                </div>
                <div>
                  <label class="block font-label-md text-[10px] uppercase text-on-surface-variant mb-xs">Country</label>
                  <input rv-on-input="onAddressInput" data-field="country"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-3 py-2 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none text-sm uppercase"
                    type="text" placeholder="PL" maxlength="2" />
                </div>
              </div>
            </div>
          </div>

          <!-- Mobile actions -->
          <div class="lg:hidden flex gap-sm">
            <button rv-on-click="cancel"
              class="flex-1 border border-white/20 text-on-surface px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all">
              Cancel
            </button>
            <button rv-on-click="submit" rv-attr-disabled="submitting"
              class="flex-1 bg-secondary text-on-secondary-fixed px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all disabled:opacity-50">
              <span rv-hide="submitting">Create</span>
              <span rv-show="submitting">Creating…</span>
            </button>
          </div>

        </div><!-- /form -->
      </div>
    </main>

    ${bottomNavTpl}

  </div>

</div>
`;

export function createController({ api, router }) {
  const self = {
    topBar: createTopBarController({
      title: 'New Customer',
      breadcrumb: 'Customers > New',
      onBack: () => router.navigate('#/customers'),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    // UI state
    submitting: false,
    error: null,
    success: null,       // null | { id, reference } — drives success screen
    subErrors: [],
    hasSubErrors: false,

    // Section open/close + chevrons (plain properties — getters are not reactive in Rivets)
    profileOpen: false,    profileChevron: 'expand_more',
    identifierOpen: false, identifierChevron: 'expand_more',
    documentOpen: false,   documentChevron: 'expand_more',
    addressOpen: false,    addressChevron: 'expand_more',

    // Party type (plain properties — updated explicitly, getters not reactive in Rivets)
    isNaturalPerson: true,
    isLegalEntity: false,

    metadataError: null,
    profileError: null,

    _form: {
      party_type: 'natural_person',
      reference: '',
      metadataRaw: '',
      // natural person profile
      given_name: '',
      middle_name: '',
      family_name: '',
      date_of_birth: '',
      nationality: '',
      // legal entity profile
      entity_subtype: '',
      legal_name: '',
      country_of_incorporation: '',
      // identifier
      identifier_type: '',
      identifier_value: '',
      // document
      document_type: '',
      document_number: '',
      // address
      address_type: 'registered',
      address_line1: '',
      address_city: '',
      address_country: '',
    },

    // ── Party type ──────────────────────────────────────────
    setNaturalPerson() {
      self._form.party_type = 'natural_person';
      self.isNaturalPerson = true;
      self.isLegalEntity   = false;
    },
    setLegalEntity() {
      self._form.party_type = 'legal_entity';
      self.isNaturalPerson = false;
      self.isLegalEntity   = true;
    },

    // ── Section toggles ─────────────────────────────────────
    toggleProfile() {
      self.profileOpen = !self.profileOpen;
      self.profileChevron = self.profileOpen ? 'expand_less' : 'expand_more';
    },
    toggleIdentifier() {
      self.identifierOpen = !self.identifierOpen;
      self.identifierChevron = self.identifierOpen ? 'expand_less' : 'expand_more';
    },
    toggleDocument() {
      self.documentOpen = !self.documentOpen;
      self.documentChevron = self.documentOpen ? 'expand_less' : 'expand_more';
    },
    toggleAddress() {
      self.addressOpen = !self.addressOpen;
      self.addressChevron = self.addressOpen ? 'expand_less' : 'expand_more';
    },

    // ── Input handlers ───────────────────────────────────────
    onReferenceInput(e)     { self._form.reference     = e.target.value.trim(); },
    onMetadataInput(e)      { self._form.metadataRaw   = e.target.value.trim(); self.metadataError = null; },
    onProfileInput(e)       { self._form[e.target.dataset.field] = e.target.value.trim(); self.profileError = null; },
    onEntitySubtypeChange(e){ self._form.entity_subtype = e.target.value; },
    onIdentifierTypeChange(e){ self._form.identifier_type  = e.target.value; },
    onIdentifierValueInput(e){ self._form.identifier_value = e.target.value.trim(); },
    onDocumentTypeChange(e)   { self._form.document_type   = e.target.value; },
    onDocumentNumberInput(e)  { self._form.document_number = e.target.value.trim(); },
    onAddressTypeChange(e)  { self._form.address_type = e.target.value; },
    onAddressInput(e)       { self._form['address_' + e.target.dataset.field] = e.target.value.trim(); },

    // ── Validation helpers ───────────────────────────────────
    _parseMetadata() {
      const raw = self._form.metadataRaw;
      if (!raw) return { ok: true, value: undefined };
      try   { return { ok: true, value: JSON.parse(raw) }; }
      catch { return { ok: false, error: 'Metadata must be valid JSON.' }; }
    },

    _profilePayload() {
      const f = self._form;
      if (f.party_type === 'natural_person') {
        if (!f.given_name && !f.family_name && !f.middle_name && !f.date_of_birth && !f.nationality) return null;
        if (!f.given_name || !f.family_name) return { error: 'First name and last name are required when Profile is filled.' };
        const p = { partyType: 'natural_person', person_type: 'individual', given_name: f.given_name, family_name: f.family_name };
        if (f.middle_name)   p.middle_name   = f.middle_name;
        if (f.date_of_birth) p.date_of_birth = f.date_of_birth;
        if (f.nationality)   p.nationalities = [f.nationality.toUpperCase()];
        return p;
      } else {
        if (!f.entity_subtype && !f.legal_name && !f.country_of_incorporation) return null;
        if (!f.entity_subtype || !f.legal_name || !f.country_of_incorporation)
          return { error: 'Entity subtype, legal name and country of incorporation are required.' };
        return { partyType: 'legal_entity', entity_subtype: f.entity_subtype, legal_name: f.legal_name, country_of_incorporation: f.country_of_incorporation.toUpperCase() };
      }
    },

    // ── Submit ───────────────────────────────────────────────
    async submit() {
      self.error = null;
      self.metadataError = null;
      self.profileError = null;

      const meta = self._parseMetadata();
      if (!meta.ok) { self.metadataError = meta.error; return; }

      const profilePayload = self._profilePayload();
      if (profilePayload && profilePayload.error) { self.profileError = profilePayload.error; return; }

      self.submitting = true;
      const errors = [];

      try {
        // 1. Create customer
        const body = { party_type: self._form.party_type };
        if (self._form.reference) body.reference = self._form.reference;
        if (meta.value !== undefined) body.metadata = meta.value;

        const customer = await api.createCustomer(body);
        const id = customer.id;

        // 2. Profile
        if (profilePayload) {
          try { await api.upsertCustomerProfile(id, profilePayload); }
          catch (e) { errors.push(`profile: ${e.message}`); }
        }

        // 3. Identifier
        const f = self._form;
        if (f.identifier_type && f.identifier_value) {
          try { await api.addCustomerIdentifier(id, { type: f.identifier_type, value: f.identifier_value }); }
          catch (e) { errors.push(`identifier: ${e.message}`); }
        }

        // 4. Document
        if (f.document_type && f.document_number) {
          try { await api.addCustomerDocument(id, { document_type: f.document_type, document_number: f.document_number, storage_ref: 'n/a', storage_system: 'manual' }); }
          catch (e) { errors.push(`document: ${e.message}`); }
        }

        // 5. Address
        if (f.address_line1 && f.address_city && f.address_country) {
          try {
            await api.upsertCustomerContact(id, {
              addresses: [{ type: f.address_type, line1: f.address_line1, city: f.address_city, country: f.address_country.toUpperCase(), is_primary: true }],
            });
          } catch (e) { errors.push(`address: ${e.message}`); }
        }

        self.subErrors = errors;
        self.hasSubErrors = errors.length > 0;
        self.success = { id, reference: customer.reference || self._form.reference || null };
      } catch (e) {
        self.error = e.message;
      } finally {
        self.submitting = false;
      }
    },

    viewCustomer() { router.navigate(`#/customers/${self.success.id}/profile`); },

    createAnother() {
      self.success = null;
      self.subErrors = [];
      self.hasSubErrors = false;
      self.error = null;
      self._form = {
        party_type: 'natural_person', reference: '', metadataRaw: '',
        given_name: '', middle_name: '', family_name: '', date_of_birth: '', nationality: '',
        entity_subtype: '', legal_name: '', country_of_incorporation: '',
        identifier_type: '', identifier_value: '',
        document_type: '', document_number: '',
        address_type: 'registered', address_line1: '', address_city: '', address_country: '',
      };
      self.isNaturalPerson = true;
      self.isLegalEntity   = false;
      self.profileOpen = false;    self.profileChevron = 'expand_more';
      self.identifierOpen = false; self.identifierChevron = 'expand_more';
      self.documentOpen = false;   self.documentChevron = 'expand_more';
      self.addressOpen = false;    self.addressChevron = 'expand_more';
    },

    cancel() { router.navigate('#/customers'); },
  };
  return self;
}

export const CustomerCreateView = {
  mount(el, _params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    return { unbind() { binding.unbind(); } };
  },
};
