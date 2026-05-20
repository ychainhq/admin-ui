export const template = `
<aside class="hidden lg:flex fixed inset-y-0 left-0 w-[280px] flex-col bg-surface-container-low border-r border-white/5 z-40">
  <div class="px-gutter pt-lg pb-md border-b border-white/5">
    <div class="flex items-center gap-sm">
      <div class="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
        <span class="material-symbols-outlined text-secondary text-[20px]">hub</span>
      </div>
      <span class="font-headline-sm text-headline-sm text-primary">LedgerConsole</span>
    </div>
  </div>

  <div class="px-gutter py-md border-b border-white/5">
    <div class="flex items-center gap-sm">
      <div class="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center border border-secondary/20">
        <span class="material-symbols-outlined text-secondary text-[24px]">admin_panel_settings</span>
      </div>
      <div class="flex flex-col">
        <span rv-text="sidebar.userName" class="font-headline-sm text-[14px] text-primary leading-tight"></span>
        <span rv-text="sidebar.userRole" class="font-body-sm text-on-surface-variant text-[12px]"></span>
      </div>
    </div>
    <div class="mt-sm px-2 py-1 bg-white/5 rounded-md inline-block">
      <span rv-text="sidebar.nodeLabel" class="font-label-md text-[10px] text-on-surface-variant"></span>
    </div>
  </div>

  <nav class="flex-1 overflow-y-auto hide-scrollbar py-sm">
    <a rv-each-item="sidebar.navItems" rv-attr-class="item.itemClass" rv-on-click="item.navigate" href="#">
      <span rv-text="item.icon" class="material-symbols-outlined"></span>
      <span rv-text="item.label" class="font-body-md text-body-md"></span>
    </a>
  </nav>
</aside>
`;

const BASE_NAV_CLASS = 'flex items-center gap-sm px-4 py-3 transition-colors duration-200 cursor-pointer';
const ACTIVE_NAV_CLASS = `${BASE_NAV_CLASS} bg-secondary/10 text-secondary font-bold border-l-4 border-l-secondary`;
const INACTIVE_NAV_CLASS = `${BASE_NAV_CLASS} text-on-surface-variant hover:bg-white/5`;

const NAV_ITEMS = [
  { label: 'Platform Dashboard', icon: 'dashboard',             route: '/dashboard' },
  { label: 'Audit Logs',         icon: 'receipt_long',          route: '/audit-logs' },
  { label: 'Global Config',      icon: 'tune',                  route: '/global-config' },
  { label: 'Tenant List',        icon: 'business',              route: '/tenants' },
  { label: 'Onboarding',         icon: 'rocket_launch',         route: '/onboarding' },
  { label: 'API Keys',           icon: 'key',                   route: '/api-keys' },
  { label: 'Customer Assets',    icon: 'account_balance_wallet', route: '/customer-assets' },
];

export function createSidebarController({ activeRoute, router, userName = 'Console Admin', userRole = 'Super User', nodeLabel = 'NODE: NODE-01' }) {
  return {
    userName,
    userRole,
    nodeLabel,
    navItems: NAV_ITEMS.map(item => {
      const isActive = activeRoute === item.route || activeRoute.startsWith(item.route + '/');
      return {
        ...item,
        itemClass: isActive ? ACTIVE_NAV_CLASS : INACTIVE_NAV_CLASS,
        navigate: () => router.navigate(`#${item.route}`),
      };
    }),
  };
}
