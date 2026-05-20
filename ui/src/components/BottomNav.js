export const template = `
<nav class="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface-dim/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center h-20 px-4">
  <a rv-each-item="bottomNav.items" rv-attr-class="item.itemClass" rv-on-click="item.navigate" href="#">
    <span rv-text="item.icon" class="material-symbols-outlined"></span>
    <span rv-text="item.label" class="font-label-md text-label-md"></span>
  </a>
</nav>
`;

const BASE_ITEM_CLASS = 'flex flex-col items-center justify-center transition-all active:scale-90 py-1 px-3 rounded-xl';
const ACTIVE_ITEM_CLASS = `${BASE_ITEM_CLASS} bg-secondary-container/20 text-secondary`;
const INACTIVE_ITEM_CLASS = `${BASE_ITEM_CLASS} text-on-surface-variant hover:text-primary`;

export function createBottomNavController({ activeRoute, router }) {
  const items = [
    { label: 'Dashboard', icon: 'dashboard',              route: '/dashboard' },
    { label: 'Assets',    icon: 'account_balance_wallet', route: '/assets' },
    { label: 'Activity',  icon: 'history',                route: '/activity' },
    { label: 'System',    icon: 'settings',               route: '/tenants' },
  ];

  return {
    items: items.map(item => {
      const isActive = activeRoute.startsWith(item.route);
      return {
        ...item,
        itemClass: isActive ? ACTIVE_ITEM_CLASS : INACTIVE_ITEM_CLASS,
        navigate: () => router.navigate(`#${item.route}`),
      };
    }),
  };
}
