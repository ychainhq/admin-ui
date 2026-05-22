import { customerStatusBadgeClass } from './CustomerCard.js';

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 10); } catch { return '—'; }
}

const TABS = [
  { key: 'profile',    label: 'Profile',    icon: 'person' },
  { key: 'compliance', label: 'Compliance', icon: 'shield' },
  { key: 'governance', label: 'Governance', icon: 'policy' },
  { key: 'balances',   label: 'Balances',   icon: 'account_balance_wallet' },
  { key: 'deposits',   label: 'Deposits',   icon: 'inbox' },
];

const TAB_ACTIVE   = 'flex items-center gap-xs px-md pb-3 pt-sm text-secondary border-b-2 border-secondary cursor-pointer whitespace-nowrap font-label-md';
const TAB_INACTIVE = 'flex items-center gap-xs px-md pb-3 pt-sm text-on-surface-variant hover:text-on-surface border-b-2 border-transparent transition-colors cursor-pointer whitespace-nowrap font-label-md';

export const template = `
<div class="glass-card rounded-xl p-md mb-md">

  <!-- Loading skeleton -->
  <div rv-show="header.loading" class="flex items-center gap-md animate-pulse">
    <div class="w-12 h-12 rounded-lg bg-white/10 shrink-0"></div>
    <div class="flex-1 space-y-xs">
      <div class="h-4 bg-white/10 rounded w-48"></div>
      <div class="h-3 bg-white/5 rounded w-32"></div>
    </div>
  </div>

  <!-- Customer info -->
  <div rv-hide="header.loading" class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md">
    <div class="flex items-start gap-md">
      <div class="w-12 h-12 rounded-lg bg-tertiary/10 flex items-center justify-center border border-tertiary/20 shrink-0">
        <span class="material-symbols-outlined text-tertiary">person</span>
      </div>
      <div>
        <div class="flex flex-wrap items-center gap-sm mb-xs">
          <span rv-text="header.customerId" class="font-mono-data text-on-surface text-[14px]"></span>
          <span rv-text="header.statusLabel" rv-attr-class="header.statusBadgeClass"></span>
        </div>
        <p rv-show="header.hasFullName" rv-text="header.fullName" class="font-body-md text-on-surface font-semibold"></p>
        <p rv-show="header.hasReference" rv-text="header.reference" class="font-body-sm text-on-surface-variant"></p>
        <p class="font-body-sm text-on-surface-variant mt-xs flex items-center gap-xs">
          <span class="material-symbols-outlined text-[14px]">calendar_today</span>
          <span rv-text="header.createdAtLabel"></span>
          <span rv-show="header.hasCity" class="material-symbols-outlined text-[14px] ml-xs">location_on</span>
          <span rv-show="header.hasCity" rv-text="header.city"></span>
        </p>
      </div>
    </div>
    <button rv-show="header.canDisable" rv-attr-disabled="header.disableLoading" rv-on-click="header.onDisable"
      class="shrink-0 flex items-center gap-xs px-md py-sm rounded-lg border border-error/30 text-error hover:bg-error/10 transition-all text-label-md font-bold active:scale-95 disabled:opacity-50">
      <span class="material-symbols-outlined text-[16px]">person_off</span>
      <span rv-hide="header.disableLoading">Disable</span>
      <span rv-show="header.disableLoading">Disabling…</span>
    </button>
  </div>

  <!-- Tab navigation -->
  <div class="mt-md border-b border-white/10 overflow-x-auto hide-scrollbar -mx-md px-md">
    <div class="flex gap-0">
      <a rv-each-tab="header.tabs" rv-attr-class="tab.tabClass" rv-on-click="tab.navigate" href="#">
        <span rv-text="tab.icon" class="material-symbols-outlined text-[16px] pointer-events-none"></span>
        <span rv-text="tab.label" class="pointer-events-none"></span>
      </a>
    </div>
  </div>

</div>
`;

export function createCustomerDetailHeaderController({ customerId, activeTab, router, onDisable }) {
  const ctrl = {
    loading: true,
    customerId,
    reference: '',
    hasReference: false,
    statusLabel: '',
    statusBadgeClass: '',
    createdAtLabel: '',
    canDisable: false,
    disableLoading: false,
    fullName: '',
    hasFullName: false,
    city: '',
    hasCity: false,
    onDisable() { onDisable?.(); },
    tabs: TABS.map(tab => {
      const route = `/customers/${encodeURIComponent(customerId)}/${tab.key}`;
      return {
        ...tab,
        tabClass: tab.key === activeTab ? TAB_ACTIVE : TAB_INACTIVE,
        navigate(e) { e?.preventDefault(); router.navigate(`#${route}`); },
      };
    }),
    setCustomer(customer) {
      ctrl.loading = false;
      ctrl.reference = customer.reference || '';
      ctrl.hasReference = Boolean(customer.reference);
      ctrl.statusLabel = (customer.status || '').toUpperCase();
      ctrl.statusBadgeClass = customerStatusBadgeClass(customer.status);
      ctrl.createdAtLabel = fmtDate(customer.createdAt || customer.created_at);
      ctrl.canDisable = customer.status === 'active';
    },
    setProfile(profileData) {
      if (!profileData) return;
      const parts = [profileData.given_name, profileData.middle_name, profileData.family_name].filter(Boolean);
      ctrl.fullName = parts.join(' ');
      ctrl.hasFullName = ctrl.fullName.length > 0;
    },
    setContact(contactData) {
      if (!contactData) return;
      const addrs = contactData.addresses || [];
      const primary = addrs.find(a => a.is_primary) || addrs[0];
      ctrl.city = primary?.city || '';
      ctrl.hasCity = !!ctrl.city;
    },
  };
  return ctrl;
}
