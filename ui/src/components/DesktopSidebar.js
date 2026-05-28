export const template = `
<aside class="hidden lg:flex fixed inset-y-0 left-0 w-[280px] flex-col bg-surface-container-lowest border-r border-white/5 z-40">
  <div class="px-sm pt-md pb-md border-b border-white/5">
    <h1 class="text-headline-sm font-headline-sm text-secondary font-bold">LedgerConsole</h1>
  </div>

  <div class="flex items-center gap-sm px-sm py-md border-b border-white/5">
    <div class="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center border border-white/10">
      <span class="material-symbols-outlined text-secondary">admin_panel_settings</span>
    </div>
    <div>
      <p class="text-label-md font-label-md text-on-surface">Platform Admin</p>
      <p class="text-body-sm font-body-sm text-on-surface-variant">Global Context</p>
    </div>
  </div>

  <nav class="flex-1 overflow-y-auto hide-scrollbar py-sm flex flex-col gap-1">
    <span rv-each-item="sidebar.navItems" class="contents">
      <div rv-show="item.separator" class="px-sm pb-xs pt-md">
        <p rv-text="item.label" class="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold"></p>
      </div>
      <a rv-show="item.showActive" rv-on-click="item.navigate" href="#" class="flex items-center gap-sm px-sm py-2 rounded-lg transition-all cursor-pointer text-secondary border-r-2 border-secondary bg-secondary/10 font-bold">
        <span rv-text="item.icon" class="material-symbols-outlined"></span>
        <span rv-text="item.label" class="text-label-md font-label-md"></span>
      </a>
      <a rv-show="item.showInactive" rv-on-click="item.navigate" href="#" class="flex items-center gap-sm px-sm py-2 rounded-lg transition-all cursor-pointer text-on-surface-variant hover:text-on-surface hover:bg-white/5">
        <span rv-text="item.icon" class="material-symbols-outlined"></span>
        <span rv-text="item.label" class="text-label-md font-label-md"></span>
      </a>
    </span>
  </nav>

  <div class="mt-auto border-t border-white/5 pt-md px-sm pb-md space-y-1">
    <button rv-on-click="sidebar.createTenant" class="w-full bg-secondary text-on-secondary-fixed py-2.5 rounded-lg text-label-md font-label-md font-bold hover:brightness-110 active:scale-95 transition-all mb-md">
      Create New Tenant
    </button>
    <a class="flex items-center gap-sm px-sm py-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all" href="#">
      <span class="material-symbols-outlined">description</span>
      <span class="text-label-md font-label-md">Docs</span>
    </a>
    <a class="flex items-center gap-sm px-sm py-2 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all" href="#">
      <span class="material-symbols-outlined">cloud_done</span>
      <span class="text-label-md font-label-md">Status</span>
    </a>
  </div>
</aside>
`;

const BASE_NAV_CLASS = 'flex items-center gap-sm px-sm py-2 rounded-lg transition-all cursor-pointer';
const ACTIVE_NAV_CLASS = `${BASE_NAV_CLASS} text-secondary border-r-2 border-secondary bg-secondary/10 font-bold`;
const INACTIVE_NAV_CLASS = `${BASE_NAV_CLASS} text-on-surface-variant hover:text-on-surface hover:bg-white/5`;

const BASE_DRAWER_CLASS = 'flex items-center gap-sm px-4 py-3 transition-colors duration-200 cursor-pointer';
const ACTIVE_DRAWER_CLASS = `${BASE_DRAWER_CLASS} bg-secondary/10 text-secondary font-bold border-l-4 border-secondary`;
const INACTIVE_DRAWER_CLASS = `${BASE_DRAWER_CLASS} text-on-surface-variant hover:bg-white/5`;

const NAV_ITEMS = [
  { label: 'Platform Dashboard', icon: 'dashboard',              route: '/dashboard' },
  { label: 'Global Config',      icon: 'settings_applications',  route: '/global-config' },
  { label: 'Tenant List',        icon: 'corporate_fare',         route: '/tenants' },
  { label: 'Customers',          icon: 'group',                  route: '/customers' },
  { label: 'Onboarding',         icon: 'person_add',             route: '/onboarding' },
  { label: 'API Keys',           icon: 'key',                    route: '/api-keys' },
  { label: 'Customer Assets',    icon: 'account_balance_wallet', route: '/customer-assets' },
  { label: 'Transactions',       icon: 'swap_horiz',             route: '/transactions' },
  { label: 'Support',            icon: 'contact_support',        route: '/support' },
  { separator: true,             label: 'Audit' },
  { label: 'Audit Logs',         icon: 'receipt_long',           route: '/audit-logs' },
  { separator: true,             label: 'Operations' },
  { label: 'Wallets',            icon: 'account_balance',        route: '/wallets' },
  { label: 'Withdrawal Batches', icon: 'pending_actions',        route: '/withdrawal-batches' },
  { label: 'Signing Tasks',      icon: 'task_alt',               route: '/signing-tasks' },
  { label: 'External Signers',   icon: 'verified_user',          route: '/external-signers' },
  { separator: true,             label: 'Dev Tools' },
  { label: 'Dev Nodes',          icon: 'hub',                    route: '/nodes' },
];

export function createSidebarController({ activeRoute, router, onCreateTenant }) {
  return {
    navItems: NAV_ITEMS.map(item => {
      if (item.separator) {
        return { separator: true, label: item.label, icon: '', isActive: false, showActive: false, showInactive: false, itemClass: '', drawerItemClass: '', navigate: () => {} };
      }
      const isActive = activeRoute === item.route || activeRoute.startsWith(item.route + '/');
      return {
        ...item,
        separator: false,
        isActive,
        showActive: isActive,
        showInactive: !isActive,
        itemClass: isActive ? ACTIVE_NAV_CLASS : INACTIVE_NAV_CLASS,
        drawerItemClass: isActive ? ACTIVE_DRAWER_CLASS : INACTIVE_DRAWER_CLASS,
        navigate: (e) => { e?.preventDefault(); router.navigate(`#${item.route}`); },
      };
    }),
    createTenant: onCreateTenant || (() => router.navigate('#/tenants/new')),
  };
}
