import rivets from '../rivets.js';
import { template as topBarTpl } from '../components/TopAppBar.js';
import { createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl } from '../components/BottomNav.js';
import { createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl } from '../components/DesktopSidebar.js';
import { createSidebarController } from '../components/DesktopSidebar.js';
import { template as searchBarTpl } from '../components/SearchBar.js';
import { createSearchController } from '../components/SearchBar.js';
import { template as tenantCardTpl } from '../components/TenantCard.js';
import { createTenantViewModel } from '../components/TenantCard.js';
import { template as paginationTpl } from '../components/Pagination.js';
import { createPaginationController } from '../components/Pagination.js';

const ROUTE = '/tenants';
const PER_PAGE = 10;

const template = `
<div class="min-h-screen">

  ${sidebarTpl}

  <div class="lg:ml-[280px]">

    ${topBarTpl}

    <!-- Desktop top bar -->
    <div class="hidden lg:flex fixed top-0 left-[280px] right-0 z-40 bg-surface-dim/80 backdrop-blur-xl border-b border-white/10 items-center justify-between px-margin-desktop h-16">
      <div class="flex flex-col">
        <span class="font-headline-sm text-headline-sm text-primary">Tenant List</span>
        <span class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant -mt-0.5">Platform &gt; Tenants</span>
      </div>
      <div class="flex items-center gap-sm">
        <button class="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">notifications</button>
        <button class="material-symbols-outlined text-on-surface-variant hover:text-primary transition-colors">settings</button>
        <div class="flex items-center gap-xs px-sm py-xs bg-surface-container rounded-full border border-white/10">
          <span class="material-symbols-outlined text-secondary text-[18px]">admin_panel_settings</span>
          <span class="font-label-md text-on-surface-variant text-[12px]">Admin</span>
        </div>
      </div>
    </div>

    <!-- Main content -->
    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="max-w-3xl lg:max-w-none mx-auto">

        <!-- Create button (desktop) -->
        <div class="hidden lg:flex justify-between items-center mb-gutter pt-gutter">
          <h1 class="font-headline-md text-on-surface">Tenants</h1>
          <button rv-on-click="createTenant" class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:brightness-110">
            <span class="material-symbols-outlined text-[20px]">add</span>
            Create Tenant
          </button>
        </div>

        ${searchBarTpl}

        <!-- Loading state -->
        <div rv-show="loading" class="flex justify-center py-lg">
          <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
        </div>

        <!-- Error state -->
        <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-gutter">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-error">error</span>
            <span rv-text="error" class="font-body-sm text-error"></span>
          </div>
        </div>

        <!-- Empty state -->
        <div rv-show="isEmpty" class="glass-card rounded-xl p-lg text-center">
          <span class="material-symbols-outlined text-[48px] text-on-surface-variant">business</span>
          <p class="font-body-md text-on-surface-variant mt-sm">No tenants found</p>
        </div>

        <!-- Tenant list -->
        <div rv-hide="loading" class="space-y-4">
          ${tenantCardTpl}
        </div>

        ${paginationTpl}
      </div>
    </main>

    ${bottomNavTpl}

    <!-- FAB (mobile) -->
    <button rv-on-click="createTenant" class="lg:hidden fixed bottom-24 right-6 w-14 h-14 bg-secondary text-on-secondary-fixed rounded-full shadow-lg shadow-black/40 flex items-center justify-center active:scale-90 transition-all z-50">
      <span class="material-symbols-outlined text-[32px]">add</span>
    </button>

  </div>

  <!-- Mobile drawer overlay -->
  <div rv-show="drawerOpen" rv-on-click="closeDrawer" class="fixed inset-0 bg-black/60 z-[55] transition-opacity duration-300"></div>

  <!-- Mobile drawer -->
  <aside rv-attr-class="drawerClass" class="fixed inset-y-0 left-0 w-[280px] z-[60] bg-surface-container-low border-r border-white/5 shadow-xl flex flex-col py-lg transition-transform duration-300 lg:hidden">
    <div class="px-gutter mb-lg">
      <div class="flex items-center gap-sm mb-sm">
        <div class="w-10 h-10 rounded-full bg-secondary-container/20 flex items-center justify-center border border-secondary/20">
          <span class="material-symbols-outlined text-secondary text-[24px]">admin_panel_settings</span>
        </div>
        <div class="flex flex-col">
          <span class="font-headline-sm text-[16px] text-primary leading-tight">Console Admin</span>
          <span class="font-body-sm text-on-surface-variant text-[12px]">Super User</span>
        </div>
      </div>
      <div class="px-2 py-1 bg-white/5 rounded-md inline-block">
        <span class="font-label-md text-[10px] text-on-surface-variant">NODE: NODE-01</span>
      </div>
    </div>
    <nav class="flex-1 space-y-1">
      <a rv-each-item="sidebar.navItems" rv-attr-class="item.itemClass" rv-on-click="item.navigate" href="#">
        <span rv-text="item.icon" class="material-symbols-outlined"></span>
        <span rv-text="item.label" class="font-body-md text-body-md"></span>
      </a>
    </nav>
    <div class="mt-auto px-gutter pt-lg border-t border-white/5">
      <button rv-on-click="closeDrawer" class="w-full flex items-center justify-center gap-xs py-3 text-on-surface-variant hover:text-white transition-colors">
        <span class="material-symbols-outlined">close</span>
        Close Menu
      </button>
    </div>
  </aside>

</div>
`;

export function createController({ api, router }) {
  const self = {
    // Layout
    topBar: createTopBarController({
      title: 'Platform Admin',
      breadcrumb: 'Platform > Tenants',
      onBack: () => window.history.back(),
      onMenuOpen: () => { self.drawerOpen = true; self._syncDrawer(); },
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    // Search
    search: createSearchController({
      value: '',
      onInput: (val) => { self.search.value = val; self._page = 1; self.load(); },
    }),

    // Tenant list state
    tenants: [],
    loading: false,
    error: null,
    isEmpty: false,

    // Pagination state
    pagination: createPaginationController({ page: 1, total: 0, onPageChange: () => {} }),

    // Drawer state
    drawerOpen: false,
    drawerClass: 'fixed inset-y-0 left-0 w-[280px] z-[60] bg-surface-container-low border-r border-white/5 shadow-xl flex flex-col py-lg transition-transform duration-300 lg:hidden -translate-x-full',

    _page: 1,
    _total: 0,

    _syncDrawer() {
      self.drawerClass = self.drawerOpen
        ? 'fixed inset-y-0 left-0 w-[280px] z-[60] bg-surface-container-low border-r border-white/5 shadow-xl flex flex-col py-lg transition-transform duration-300 lg:hidden translate-x-0'
        : 'fixed inset-y-0 left-0 w-[280px] z-[60] bg-surface-container-low border-r border-white/5 shadow-xl flex flex-col py-lg transition-transform duration-300 lg:hidden -translate-x-full';
    },

    closeDrawer() {
      self.drawerOpen = false;
      self._syncDrawer();
    },

    createTenant() {
      router.navigate('#/tenants/new');
    },

    async load() {
      self.loading = true;
      self.error = null;
      self.isEmpty = false;
      try {
        const data = await api.getTenants({ search: self.search.value, page: self._page });
        const items = data.items || data.tenants || data.data || [];
        self._total = data.total || data.count || items.length;
        self.tenants = items.map(t => createTenantViewModel(t, { router }));
        self.isEmpty = self.tenants.length === 0;
        self.pagination = createPaginationController({
          page: self._page,
          total: self._total,
          onPageChange: (p) => { self._page = p; self.load(); },
        });
      } catch (e) {
        self.error = e.message;
      } finally {
        self.loading = false;
      }
    },

    init() {
      self.load();
    },
  };
  return self;
}

export const TenantListView = {
  mount(el, _params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return {
      unbind() {
        binding.unbind();
      },
    };
  },
};
