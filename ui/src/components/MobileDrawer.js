const DRAWER_BASE = 'fixed inset-y-0 left-0 w-[280px] z-[60] bg-surface-container-low border-r border-white/5 shadow-xl flex flex-col py-lg transition-transform duration-300 lg:hidden';

export const template = `
  <div rv-show="mobileDrawer.isOpen" rv-on-click="mobileDrawer.close" class="fixed inset-0 bg-black/60 z-[55] transition-opacity duration-300"></div>

  <aside rv-attr-class="mobileDrawer.drawerClass" class="${DRAWER_BASE} -translate-x-full">
    <div class="px-gutter mb-lg">
      <div class="flex items-center gap-sm mb-sm">
        <div class="w-12 h-12 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary border border-secondary/20">
          <span class="material-symbols-outlined text-[32px]">admin_panel_settings</span>
        </div>
        <div class="flex flex-col">
          <span class="font-headline-sm text-[16px] text-primary leading-tight">Console Admin</span>
          <span class="font-body-sm text-on-surface-variant">Super User</span>
        </div>
      </div>
      <div class="px-2 py-1 bg-white/5 rounded-md inline-block">
        <span class="font-label-md text-label-md text-on-surface-variant">NODE: NODE-01</span>
      </div>
    </div>
    <nav class="flex-1 flex flex-col gap-1 overflow-y-auto">
      <span rv-each-item="sidebar.navItems" class="contents">
        <div rv-show="item.separator" class="px-4 pt-md pb-xs">
          <p rv-text="item.label" class="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold"></p>
        </div>
        <a rv-show="item.showActive" rv-on-click="item.navigate" href="#" class="flex items-center gap-sm px-4 py-3 transition-colors duration-200 cursor-pointer bg-secondary/10 text-secondary font-bold border-l-4 border-secondary">
          <span rv-text="item.icon" class="material-symbols-outlined"></span>
          <span rv-text="item.label" class="font-body-sm text-body-sm"></span>
        </a>
        <a rv-show="item.showInactive" rv-on-click="item.navigate" href="#" class="flex items-center gap-sm px-4 py-3 transition-colors duration-200 cursor-pointer text-on-surface-variant hover:bg-white/5">
          <span rv-text="item.icon" class="material-symbols-outlined"></span>
          <span rv-text="item.label" class="font-body-sm text-body-sm"></span>
        </a>
      </span>
    </nav>
    <div class="mt-auto px-gutter pt-lg border-t border-white/5">
      <button rv-on-click="mobileDrawer.close" class="w-full flex items-center justify-center gap-xs py-3 text-on-surface-variant hover:text-white transition-colors">
        <span class="material-symbols-outlined">close</span>
        Close Menu
      </button>
    </div>
  </aside>
`;

export function createMobileDrawerController() {
  const ctrl = {
    isOpen: false,
    drawerClass: `${DRAWER_BASE} -translate-x-full`,
    open() {
      ctrl.isOpen = true;
      ctrl.drawerClass = `${DRAWER_BASE} translate-x-0`;
    },
    close() {
      ctrl.isOpen = false;
      ctrl.drawerClass = `${DRAWER_BASE} -translate-x-full`;
    },
  };
  return ctrl;
}
