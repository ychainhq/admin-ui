import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { template as headerTpl, createCustomerDetailHeaderController } from '../components/CustomerDetailHeader.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/customers';
const ACTIVE_TAB = 'compliance';

async function safeLoad(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.message?.startsWith('HTTP 404') || e.message?.toLowerCase().includes('not found')) return null;
    throw e;
  }
}

function statusBadge(status, map) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold';
  return map[status] || `${base} bg-outline/10 text-on-surface-variant border border-white/10`;
}

const KYC_BADGE = {
  approved: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  pending:  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  rejected: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
  expired:  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
};
const RISK_BADGE = {
  low:    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  medium: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  high:   'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
};
const PEP_BADGE = {
  not_pep: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  pep:     'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
  unknown: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-outline/10 text-on-surface-variant border border-white/10',
};
const SANCTIONS_BADGE = {
  clear:        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  flagged:      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
  under_review: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
};
const REL_TYPE_BADGE = {
  ubo:      'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  director: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-outline/10 text-on-surface-variant border border-white/10',
};

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomers" href="#" class="text-on-surface-variant hover:text-on-surface transition-colors">Customers</a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span rv-text="header.customerId" class="text-on-surface font-semibold"></span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Compliance</span>
  `,
  showSearch: false,
});

const amlSectionTpl = `
<div class="glass-card rounded-xl overflow-hidden mb-md">
  <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
    <span class="material-symbols-outlined text-on-surface-variant text-[18px]">gpp_maybe</span>
    <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">AML / KYC Status</span>
  </div>
  <div rv-show="aml.notSet" class="p-lg text-center">
    <span class="material-symbols-outlined text-[40px] text-on-surface-variant">gpp_maybe</span>
    <p class="font-body-sm text-on-surface-variant mt-sm">No AML/KYC record on file</p>
  </div>
  <div rv-hide="aml.notSet" class="divide-y divide-white/5">
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">KYC Status</span>
      <span rv-text="aml.kycStatus" rv-attr-class="aml.kycStatusBadgeClass"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">KYC Verified At</span>
      <span rv-text="aml.kycVerifiedAt" class="font-mono-data text-on-surface text-[13px]"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">KYC Provider</span>
      <span rv-text="aml.kycProvider" class="font-body-md text-on-surface"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">CDD Level</span>
      <span rv-text="aml.cddLevel" rv-attr-class="aml.cddLevelBadgeClass"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">AML Risk Level</span>
      <span rv-text="aml.riskLevel" rv-attr-class="aml.riskBadgeClass"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">PEP Status</span>
      <span rv-text="aml.pepStatus" rv-attr-class="aml.pepBadgeClass"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Sanctions Status</span>
      <span rv-text="aml.sanctionsStatus" rv-attr-class="aml.sanctionsBadgeClass"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Source of Funds</span>
      <span rv-text="aml.sourceOfFunds" class="font-body-md text-on-surface"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Expected Monthly Volume</span>
      <span rv-text="aml.expectedMonthlyVolume" class="font-mono-data text-on-surface text-[13px]"></span>
    </div>
  </div>
</div>
`;

const relationshipsSectionTpl = `
<div class="glass-card rounded-xl overflow-hidden mb-md">
  <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
    <span class="material-symbols-outlined text-on-surface-variant text-[18px]">account_tree</span>
    <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Relationships</span>
  </div>
  <div rv-show="relationshipsEmpty" class="p-lg text-center">
    <span class="material-symbols-outlined text-[40px] text-on-surface-variant">account_tree</span>
    <p class="font-body-sm text-on-surface-variant mt-sm">No relationships recorded</p>
  </div>
  <div rv-hide="relationshipsEmpty" class="divide-y divide-white/5">
    <div rv-each-rel="relationships" class="px-md py-3">
      <div class="flex items-start justify-between gap-sm mb-sm">
        <div class="flex items-center gap-sm">
          <span class="material-symbols-outlined text-on-surface-variant text-[20px]">corporate_fare</span>
          <span rv-text="rel.legalName" class="font-body-md text-on-surface font-semibold"></span>
        </div>
        <span rv-text="rel.typeLabel" rv-attr-class="rel.typeBadgeClass"></span>
      </div>
      <div class="flex flex-wrap gap-md ml-8 font-body-sm text-on-surface-variant">
        <span rv-show="rel.identifierValue">
          <span rv-text="rel.identifierType"></span>: <span rv-text="rel.identifierValue" class="font-mono-data text-on-surface text-[12px]"></span>
        </span>
        <span rv-show="rel.country">Country: <span rv-text="rel.country"></span></span>
        <span rv-show="rel.ownershipPercent">Ownership: <span rv-text="rel.ownershipPercent" class="font-semibold text-on-surface"></span>%</span>
        <span rv-show="rel.isControlling" class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20">CONTROLLING</span>
      </div>
      <p rv-show="rel.notes" class="ml-8 mt-xs font-body-sm text-on-surface-variant italic">
        "<span rv-text="rel.notes"></span>"
      </p>
    </div>
  </div>
</div>
`;

const documentsSectionTpl = `
<div class="glass-card rounded-xl overflow-hidden">
  <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
    <span class="material-symbols-outlined text-on-surface-variant text-[18px]">folder_open</span>
    <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Documents</span>
  </div>
  <div rv-show="documentsEmpty" class="p-lg text-center">
    <span class="material-symbols-outlined text-[40px] text-on-surface-variant">folder_open</span>
    <p class="font-body-sm text-on-surface-variant mt-sm">No documents uploaded</p>
  </div>
  <div rv-hide="documentsEmpty" class="overflow-x-auto">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="border-b border-white/5 bg-white/[0.02]">
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TYPE</th>
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">NUMBER</th>
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">COUNTRY</th>
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">EXPIRY</th>
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">UPLOADED BY</th>
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">HASH</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-white/5">
        <tr rv-each-doc="documents" class="hover:bg-white/[0.02]">
          <td class="px-md py-3">
            <span rv-text="doc.type" class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20"></span>
          </td>
          <td rv-text="doc.number" class="px-md py-3 font-mono-data text-on-surface text-[13px]"></td>
          <td rv-text="doc.country" class="px-md py-3 font-body-sm text-on-surface-variant"></td>
          <td rv-text="doc.expiry"  class="px-md py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
          <td rv-text="doc.uploadedBy" class="px-md py-3 font-body-sm text-on-surface-variant"></td>
          <td class="px-md py-3">
            <span rv-text="doc.hashShort" rv-attr-title="doc.hashFull" class="font-mono-data text-on-surface-variant text-[11px] cursor-help"></span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
`;

const template = `
<div class="min-h-screen">

  ${sidebarTpl}

  <div class="lg:ml-[280px]">

    ${topBarTpl}
    ${desktopTopBarTpl}

    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="mx-auto">

        <div rv-show="noActiveTenant" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mt-gutter flex items-start gap-sm">
          <span class="material-symbols-outlined text-error shrink-0 mt-xs">hub</span>
          <div>
            <p class="font-body-md text-error font-semibold">No active tenant</p>
            <p class="font-body-sm text-on-surface-variant mt-xs">
              Go to <a rv-on-click="goToTenants" href="#" class="text-secondary underline">Tenants</a> and click <strong>Work with</strong> first.
            </p>
          </div>
        </div>

        <div rv-hide="noActiveTenant" class="pt-gutter">

          ${headerTpl}

          <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-error">error</span>
              <span rv-text="error" class="font-body-sm text-error"></span>
            </div>
          </div>

          <div rv-show="loading" class="flex justify-center py-lg">
            <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
          </div>

          <div rv-hide="loading">
            ${amlSectionTpl}
            ${relationshipsSectionTpl}
            ${documentsSectionTpl}
          </div>

        </div>
      </div>
    </main>

    ${bottomNavTpl}

  </div>

  ${mobileDrawerTpl}

</div>
`;

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 10); } catch { return '—'; }
}

export function createController({ api, router, id }) {
  const self = {
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'Compliance',
      breadcrumb: 'Customers > Compliance',
      onBack: () => router.navigate('#/customers'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    error: null,

    header: createCustomerDetailHeaderController({
      customerId: id,
      activeTab: ACTIVE_TAB,
      router,
      onDisable: () => self.disableCustomer(),
    }),

    aml: { notSet: true },
    relationships: [],
    relationshipsEmpty: true,
    documents: [],
    documentsEmpty: true,

    goToTenants() { router.navigate('#/tenants'); },
    goToCustomers() { router.navigate('#/customers'); },

    async disableCustomer() {
      self.header.disableLoading = true;
      try {
        await api.disableCustomer(id);
        self.header.canDisable = false;
        self.header.statusLabel = 'DISABLED';
        self.header.statusBadgeClass = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20';
      } catch (e) {
        self.error = e.message;
      } finally {
        self.header.disableLoading = false;
      }
    },

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const [customer, amlData, relsData, docsData] = await Promise.all([
          api.getCustomer(id),
          safeLoad(() => api.getCustomerAmlKyc(id)),
          safeLoad(() => api.getCustomerRelationships(id)),
          safeLoad(() => api.getCustomerDocuments(id)),
        ]);

        self.header.setCustomer(customer);

        // AML/KYC
        if (!amlData) {
          self.aml = { notSet: true };
        } else {
          self.aml = {
            notSet:                   false,
            kycStatus:                (amlData.kyc_status || '—').toUpperCase(),
            kycStatusBadgeClass:      statusBadge(amlData.kyc_status, KYC_BADGE),
            kycVerifiedAt:            fmtDate(amlData.kyc_verified_at),
            kycProvider:              amlData.kyc_provider || '—',
            cddLevel:                 amlData.cdd_level || '—',
            cddLevelBadgeClass:       'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
            riskLevel:                (amlData.aml_risk_level || '—').toUpperCase(),
            riskBadgeClass:           statusBadge(amlData.aml_risk_level, RISK_BADGE),
            pepStatus:                (amlData.pep_status || '—').replace('_', ' ').toUpperCase(),
            pepBadgeClass:            statusBadge(amlData.pep_status, PEP_BADGE),
            sanctionsStatus:          (amlData.sanctions_status || '—').replace('_', ' ').toUpperCase(),
            sanctionsBadgeClass:      statusBadge(amlData.sanctions_status, SANCTIONS_BADGE),
            sourceOfFunds:            (amlData.source_of_funds || []).join(', ') || '—',
            expectedMonthlyVolume:    amlData.expected_monthly_volume || '—',
          };
        }

        // Relationships
        const relsList = relsData?.data || [];
        self.relationships = relsList.map(r => ({
          legalName:       r.external_party?.legal_name || '—',
          typeLabel:       (r.relationship_type || '—').toUpperCase(),
          typeBadgeClass:  statusBadge(r.relationship_type, REL_TYPE_BADGE),
          identifierType:  r.external_party?.identifier_type || '',
          identifierValue: r.external_party?.identifier_value || '',
          country:         r.external_party?.country || '',
          ownershipPercent: r.ownership_percent != null ? String(r.ownership_percent) : '',
          isControlling:   Boolean(r.is_controlling),
          notes:           r.notes || '',
        }));
        self.relationshipsEmpty = self.relationships.length === 0;

        // Documents
        const docsList = docsData?.data || [];
        self.documents = docsList.map(d => ({
          type:       d.document_type || '—',
          number:     d.document_number || '—',
          country:    d.issuing_country || '—',
          expiry:     fmtDate(d.expiry_date),
          uploadedBy: d.uploaded_by || '—',
          hashShort:  d.file_hash ? d.file_hash.slice(0, 16) + '…' : '—',
          hashFull:   d.file_hash || '',
        }));
        self.documentsEmpty = self.documents.length === 0;

      } catch (e) {
        self.error = e.message;
      } finally {
        self.loading = false;
      }
    },

    init() {
      if (!self.noActiveTenant) self.load();
    },
  };
  return self;
}

export const CustomerComplianceView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router, id: params.id });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
