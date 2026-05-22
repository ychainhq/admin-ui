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
const ACTIVE_TAB = 'governance';

async function safeLoad(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.message?.startsWith('HTTP 404') || e.message?.toLowerCase().includes('not found')) return null;
    throw e;
  }
}

const DATA_CLASS_BADGE = {
  confidential: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
  restricted:   'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  internal:     'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-outline/10 text-on-surface-variant border border-white/10',
  public:       'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
};

const LAWFUL_BASIS_LABEL = {
  consent:           'Consent',
  legal_obligation:  'Legal obligation',
  contract:          'Contract',
  legitimate_interest: 'Legitimate interest',
  vital_interest:    'Vital interest',
  public_task:       'Public task',
};

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomers" href="#" class="text-on-surface-variant hover:text-on-surface transition-colors">Customers</a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomer" href="#" rv-text="header.customerId" class="text-on-surface font-semibold hover:text-secondary transition-colors"></a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Governance</span>
  `,
  showSearch: false,
});

const classificationSectionTpl = `
<div class="glass-card rounded-xl overflow-hidden mb-md">
  <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
    <span class="material-symbols-outlined text-on-surface-variant text-[18px]">policy</span>
    <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Data Classification</span>
  </div>
  <div rv-show="gov.notSet" class="p-lg text-center">
    <span class="material-symbols-outlined text-[40px] text-on-surface-variant">policy</span>
    <p class="font-body-sm text-on-surface-variant mt-sm">No data governance configuration on file</p>
  </div>
  <div rv-hide="gov.notSet" class="divide-y divide-white/5">
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Classification</span>
      <span rv-text="gov.dataClassification" rv-attr-class="gov.classificationBadgeClass"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Lawful basis (GDPR)</span>
      <span rv-text="gov.lawfulBasisLabel" class="font-body-md text-on-surface"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Retention policy</span>
      <span rv-text="gov.retentionPolicy" class="font-mono-data text-on-surface text-[13px]"></span>
    </div>
  </div>
</div>
`;

const controlsSectionTpl = `
<div rv-hide="gov.notSet" class="glass-card rounded-xl overflow-hidden">
  <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
    <span class="material-symbols-outlined text-on-surface-variant text-[18px]">security</span>
    <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Processing Controls</span>
  </div>
  <div class="divide-y divide-white/5">
    <div class="flex items-center justify-between px-md py-3">
      <div class="flex items-center gap-sm">
        <span class="material-symbols-outlined text-[20px] text-on-surface-variant">visibility_off</span>
        <div>
          <p class="font-body-md text-on-surface">PII Masking</p>
          <p class="font-body-sm text-on-surface-variant">Personally identifiable information must be masked</p>
        </div>
      </div>
      <span rv-text="gov.maskingLabel" rv-attr-class="gov.maskingBadgeClass"></span>
    </div>
    <div class="flex items-center justify-between px-md py-3">
      <div class="flex items-center gap-sm">
        <span class="material-symbols-outlined text-[20px] text-on-surface-variant">lock</span>
        <div>
          <p class="font-body-md text-on-surface">Encryption at rest</p>
          <p class="font-body-sm text-on-surface-variant">Data must be stored encrypted</p>
        </div>
      </div>
      <span rv-text="gov.encryptionLabel" rv-attr-class="gov.encryptionBadgeClass"></span>
    </div>
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
            ${classificationSectionTpl}
            ${controlsSectionTpl}
          </div>

        </div>
      </div>
    </main>

    ${bottomNavTpl}

  </div>

  ${mobileDrawerTpl}

</div>
`;

export function createController({ api, router, id }) {
  const self = {
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'Governance',
      breadcrumb: 'Customers > Governance',
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

    gov: { notSet: true },

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },
    goToCustomers(e) { e?.preventDefault(); router.navigate('#/customers'); },
    goToCustomer(e) { e?.preventDefault(); router.navigate(`#/customers/${encodeURIComponent(id)}/profile`); },

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
        const [customer, govData, profileData, contactData] = await Promise.all([
          api.getCustomer(id),
          safeLoad(() => api.getCustomerDataGovernance(id)),
          safeLoad(() => api.getCustomerProfile(id)),
          safeLoad(() => api.getCustomerContact(id)),
        ]);

        self.header.setCustomer(customer);
        self.header.setProfile(profileData);
        self.header.setContact(contactData);

        if (!govData) {
          self.gov = { notSet: true };
        } else {
          const cls = govData.data_classification || '';
          const masking = Boolean(govData.masking_required);
          const encryption = Boolean(govData.encryption_required);
          const boolBadge = (v) => v
            ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20'
            : 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-outline/10 text-on-surface-variant border border-white/10';
          self.gov = {
            notSet:                 false,
            dataClassification:     cls.toUpperCase() || '—',
            classificationBadgeClass: DATA_CLASS_BADGE[cls] || DATA_CLASS_BADGE.internal,
            lawfulBasisLabel:       LAWFUL_BASIS_LABEL[govData.lawful_basis] || govData.lawful_basis || '—',
            retentionPolicy:        govData.retention_policy || '—',
            maskingLabel:           masking ? 'REQUIRED' : 'NOT REQUIRED',
            maskingBadgeClass:      boolBadge(masking),
            encryptionLabel:        encryption ? 'REQUIRED' : 'NOT REQUIRED',
            encryptionBadgeClass:   boolBadge(encryption),
          };
        }

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

export const CustomerGovernanceView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router, id: params.id });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
