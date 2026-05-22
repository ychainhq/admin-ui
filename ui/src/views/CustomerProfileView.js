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
const ACTIVE_TAB = 'profile';

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 10); } catch { return '—'; }
}

async function safeLoad(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.message?.startsWith('HTTP 404') || e.message?.toLowerCase().includes('not found')) return null;
    throw e;
  }
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomers" href="#" class="text-on-surface-variant hover:text-on-surface transition-colors">Customers</a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span rv-text="header.customerId" class="text-on-surface font-semibold"></span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Profile</span>
  `,
  showSearch: false,
});

const profileSectionTpl = `
<div class="glass-card rounded-xl overflow-hidden mb-md">
  <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
    <span class="material-symbols-outlined text-on-surface-variant text-[18px]">badge</span>
    <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">KYC Profile</span>
  </div>

  <!-- Not set -->
  <div rv-show="profile.notSet" class="p-lg text-center">
    <span class="material-symbols-outlined text-[40px] text-on-surface-variant">person_search</span>
    <p class="font-body-sm text-on-surface-variant mt-sm">No KYC profile submitted yet</p>
  </div>

  <!-- Natural person -->
  <div rv-show="profile.isNaturalPerson" class="divide-y divide-white/5">
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Given name</span>
      <span rv-text="profile.givenName" class="font-body-md text-on-surface font-semibold"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Family name</span>
      <span rv-text="profile.familyName" class="font-body-md text-on-surface font-semibold"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Date of birth</span>
      <span rv-text="profile.dateOfBirth" class="font-mono-data text-on-surface"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Nationalities</span>
      <span rv-text="profile.nationalities" class="font-body-md text-on-surface"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Country of residence</span>
      <span rv-text="profile.countryOfResidence" class="font-body-md text-on-surface"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Occupation</span>
      <span rv-text="profile.occupation" class="font-body-md text-on-surface"></span>
    </div>
  </div>

  <!-- Legal entity -->
  <div rv-show="profile.isLegalEntity" class="divide-y divide-white/5">
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Legal name</span>
      <span rv-text="profile.legalName" class="font-body-md text-on-surface font-semibold"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Entity subtype</span>
      <span rv-text="profile.entitySubtype" class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Country of incorporation</span>
      <span rv-text="profile.countryOfIncorporation" class="font-body-md text-on-surface"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Date of incorporation</span>
      <span rv-text="profile.dateOfIncorporation" class="font-mono-data text-on-surface"></span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3">Regulated</span>
      <span rv-text="profile.regulatedLabel" rv-attr-class="profile.regulatedBadgeClass"></span>
    </div>
  </div>
</div>
`;

const identifiersSectionTpl = `
<div class="glass-card rounded-xl overflow-hidden mb-md">
  <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
    <span class="material-symbols-outlined text-on-surface-variant text-[18px]">fingerprint</span>
    <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Identifiers</span>
  </div>
  <div rv-show="identifiersEmpty" class="p-lg text-center">
    <span class="material-symbols-outlined text-[40px] text-on-surface-variant">badge</span>
    <p class="font-body-sm text-on-surface-variant mt-sm">No identifiers on file</p>
  </div>
  <div rv-hide="identifiersEmpty" class="overflow-x-auto">
    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="border-b border-white/5 bg-white/[0.02]">
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TYPE</th>
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">VALUE</th>
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">COUNTRY</th>
          <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">EXPIRY</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-white/5">
        <tr rv-each-ident="identifiers" class="hover:bg-white/[0.02]">
          <td class="px-md py-3">
            <span rv-text="ident.type" class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20"></span>
          </td>
          <td rv-text="ident.value" class="px-md py-3 font-mono-data text-on-surface text-[13px]"></td>
          <td rv-text="ident.country" class="px-md py-3 font-body-sm text-on-surface-variant"></td>
          <td rv-text="ident.expiry" class="px-md py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
`;

const contactSectionTpl = `
<div class="glass-card rounded-xl overflow-hidden">
  <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
    <span class="material-symbols-outlined text-on-surface-variant text-[18px]">contact_mail</span>
    <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Contact</span>
  </div>
  <div rv-show="contact.notSet" class="p-lg text-center">
    <span class="material-symbols-outlined text-[40px] text-on-surface-variant">contact_mail</span>
    <p class="font-body-sm text-on-surface-variant mt-sm">No contact information on file</p>
  </div>
  <div rv-hide="contact.notSet" class="divide-y divide-white/5">
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3 flex items-center gap-xs">
        <span class="material-symbols-outlined text-[16px]">mail</span> Email
      </span>
      <span class="flex items-center gap-sm">
        <span rv-text="contact.email" class="font-body-md text-on-surface"></span>
        <span rv-show="contact.emailVerified" class="material-symbols-outlined text-[16px] text-tertiary">verified</span>
      </span>
    </div>
    <div class="flex flex-col lg:flex-row lg:items-center gap-xs px-md py-3">
      <span class="font-body-sm text-on-surface-variant lg:w-1/3 flex items-center gap-xs">
        <span class="material-symbols-outlined text-[16px]">phone</span> Phone
      </span>
      <span class="flex items-center gap-sm">
        <span rv-text="contact.phone" class="font-body-md text-on-surface font-mono"></span>
        <span rv-show="contact.phoneVerified" class="material-symbols-outlined text-[16px] text-tertiary">verified</span>
      </span>
    </div>
    <!-- Addresses -->
    <div rv-show="contact.hasAddresses" class="px-md py-3">
      <p class="font-body-sm text-on-surface-variant mb-sm">Addresses</p>
      <div rv-each-addr="contact.addresses" class="glass-card rounded-lg p-sm mb-sm last:mb-0">
        <div class="flex items-start justify-between gap-sm mb-xs">
          <span rv-text="addr.type" class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20 capitalize"></span>
          <span rv-show="addr.isPrimary" class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20">PRIMARY</span>
        </div>
        <p rv-text="addr.line1" class="font-body-sm text-on-surface"></p>
        <p class="font-body-sm text-on-surface-variant">
          <span rv-text="addr.city"></span><span rv-show="addr.postalCode">, <span rv-text="addr.postalCode"></span></span>
        </p>
        <p rv-text="addr.country" class="font-body-sm text-on-surface-variant"></p>
      </div>
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

        <!-- No active tenant guard -->
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

          <!-- Error state -->
          <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-error">error</span>
              <span rv-text="error" class="font-body-sm text-error"></span>
            </div>
          </div>

          <!-- Loading state -->
          <div rv-show="loading" class="flex justify-center py-lg">
            <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
          </div>

          <!-- Sections -->
          <div rv-hide="loading">
            ${profileSectionTpl}
            ${identifiersSectionTpl}
            ${contactSectionTpl}
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
      title: 'Customer Profile',
      breadcrumb: 'Customers > Profile',
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

    profile: { notSet: true, isNaturalPerson: false },
    identifiers: [],
    identifiersEmpty: true,
    contact: { notSet: true, addresses: [], hasAddresses: false },

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
        const [customer, profileData, idsData, contactData] = await Promise.all([
          api.getCustomer(id),
          safeLoad(() => api.getCustomerProfile(id)),
          safeLoad(() => api.getCustomerIdentifiers(id)),
          safeLoad(() => api.getCustomerContact(id)),
        ]);

        self.header.setCustomer(customer);

        // Profile
        if (!profileData) {
          self.profile = { notSet: true, isNaturalPerson: false, isLegalEntity: false };
        } else {
          const isNatural = !!profileData.person_type;
          self.profile = {
            notSet: false,
            isNaturalPerson: isNatural,
            isLegalEntity: !isNatural,
            // Natural person
            givenName:           profileData.given_name || '—',
            familyName:          profileData.family_name || '—',
            dateOfBirth:         profileData.date_of_birth || '—',
            nationalities:       (profileData.nationalities || []).join(', ') || '—',
            countryOfResidence:  profileData.country_of_residence || '—',
            occupation:          profileData.occupation || '—',
            // Legal entity
            legalName:               profileData.legal_name || '—',
            entitySubtype:           profileData.entity_subtype || '—',
            countryOfIncorporation:  profileData.country_of_incorporation || '—',
            dateOfIncorporation:     fmtDate(profileData.date_of_incorporation),
            regulatedLabel:          profileData.regulated ? 'YES' : 'NO',
            regulatedBadgeClass:     profileData.regulated
              ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20'
              : 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
          };
        }

        // Identifiers
        const idsList = idsData?.data || [];
        self.identifiers = idsList.map(d => ({
          type:    d.type || '—',
          value:   d.value || '—',
          country: d.issuing_country || '—',
          expiry:  fmtDate(d.valid_until),
        }));
        self.identifiersEmpty = self.identifiers.length === 0;

        // Contact
        if (!contactData) {
          self.contact = { notSet: true, addresses: [], hasAddresses: false };
        } else {
          const addrs = (contactData.addresses || []).map(a => ({
            type:       a.type || '—',
            line1:      a.line1 || '—',
            city:       a.city || '',
            postalCode: a.postal_code || '',
            country:    a.country || '—',
            isPrimary:  Boolean(a.is_primary),
          }));
          self.contact = {
            notSet:        false,
            email:         contactData.email || '—',
            phone:         contactData.phone || '—',
            emailVerified: Boolean(contactData.email_verified),
            phoneVerified: Boolean(contactData.phone_verified),
            addresses:     addrs,
            hasAddresses:  addrs.length > 0,
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

export const CustomerProfileView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router, id: params.id });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
