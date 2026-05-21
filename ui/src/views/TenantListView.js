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

const desktopTopBarTpl = `
<div class="hidden lg:flex fixed top-0 left-[280px] right-0 z-40 bg-surface-container-low/50 backdrop-blur-xl border-b border-white/10 items-center justify-between px-margin-desktop h-16">
  <nav class="flex items-center gap-2 text-label-md font-label-md">
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Tenants</span>
  </nav>
  <div class="flex items-center gap-md">
    <div class="relative">
      <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">search</span>
      <input rv-on-input="search.onInput" rv-attr-value="search.value"
        class="bg-surface-container-high border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-body-sm w-72 focus:ring-1 focus:ring-secondary focus:border-secondary transition-all text-on-surface outline-none"
        placeholder="Search tenants, IDs..." type="text">
    </div>
    <div class="flex items-center gap-sm">
      <button class="p-2 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-full transition-colors active:scale-95">
        <span class="material-symbols-outlined">notifications</span>
      </button>
      <button class="p-2 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-full transition-colors active:scale-95">
        <span class="material-symbols-outlined">settings</span>
      </button>
    </div>
    <div class="h-8 w-px bg-white/10"></div>
    <div class="flex items-center gap-sm">
      <div class="text-right">
        <p class="text-label-md font-label-md text-on-surface">Admin Profile</p>
        <p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Superuser</p>
      </div>
      <div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center border border-white/20">
        <span class="material-symbols-outlined text-secondary text-[18px]">admin_panel_settings</span>
      </div>
    </div>
  </div>
</div>
`;

const desktopTableTpl = `
<div rv-hide="loading" class="hidden lg:block">
  <div rv-show="isEmpty" class="glass-card rounded-xl p-lg text-center">
    <span class="material-symbols-outlined text-[48px] text-on-surface-variant">business</span>
    <p class="font-body-md text-on-surface-variant mt-sm">No tenants found</p>
  </div>
  <div rv-hide="isEmpty" class="glass-card rounded-xl overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-white/10 bg-white/5">
            <th class="px-md py-4 text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">TENANT NAME &amp; ID</th>
            <th class="px-md py-4 text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
            <th class="px-md py-4 text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">CUSTODY MODE</th>
            <th class="px-md py-4 text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">CREATED DATE</th>
            <th class="px-md py-4 text-label-md font-label-md text-on-surface-variant uppercase tracking-wider text-right">ACTION</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <tr rv-each-tenant="tenants" rv-attr-class="tenant.rowClass">
            <td class="px-md py-4">
              <div class="flex items-center gap-sm">
                <div class="w-10 h-10 rounded bg-primary/10 flex items-center justify-center border border-primary/20">
                  <span class="material-symbols-outlined text-primary">account_balance</span>
                </div>
                <div>
                  <p rv-text="tenant.name" class="text-body-md font-semibold text-on-surface"></p>
                  <p rv-text="tenant.id" class="text-mono-data text-[12px] text-on-surface-variant opacity-60"></p>
                </div>
              </div>
            </td>
            <td class="px-md py-4">
              <span rv-show="tenant.isActive" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20">ACTIVE</span>
              <span rv-hide="tenant.isActive" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20">SUSPENDED</span>
            </td>
            <td class="px-md py-4">
              <div class="flex items-center gap-xs">
                <span rv-text="tenant.custodyIcon" class="material-symbols-outlined text-[18px] text-on-surface-variant"></span>
                <span rv-text="tenant.custodyMode" class="text-body-sm text-on-surface"></span>
              </div>
            </td>
            <td rv-text="tenant.createdAt" class="px-md py-4 text-body-sm text-on-surface-variant font-mono"></td>
            <td class="px-md py-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button rv-on-click="tenant.viewConfig" class="flex items-center gap-1 px-3 py-2 rounded text-primary hover:text-on-primary-fixed-variant hover:bg-primary/10 text-label-md transition-all">
                  <span class="material-symbols-outlined text-[18px]">settings_ethernet</span>View Config
                </button>
                <button rv-show="tenant.isActive" rv-on-click="tenant.workWith" class="px-4 py-2 rounded bg-secondary text-on-secondary-fixed text-label-md font-bold hover:brightness-110 active:scale-95 transition-all">Work with</button>
                <button rv-hide="tenant.isActive" rv-on-click="tenant.workWith" class="px-4 py-2 rounded border border-white/10 text-on-surface-variant text-label-md font-bold hover:bg-white/5 transition-all">Work with</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex items-center justify-between px-md py-4 bg-white/[0.02] border-t border-white/5">
      <p class="text-body-sm font-body-sm text-on-surface-variant">
        Showing <span rv-text="pagination.from" class="text-on-surface font-semibold"></span>–<span rv-text="pagination.to" class="text-on-surface font-semibold"></span> of <span rv-text="pagination.totalCount" class="text-on-surface font-semibold"></span> tenants
      </p>
      <div class="flex items-center gap-base">
        <button rv-on-click="pagination.prevPage" rv-attr-disabled="pagination.prevDisabled"
          class="p-2 rounded hover:bg-white/5 text-on-surface-variant disabled:opacity-30">
          <span class="material-symbols-outlined">chevron_left</span>
        </button>
        <div class="flex gap-1">
          <span rv-each-pg="pagination.pages" class="contents">
            <button rv-show="pg.isActive" rv-on-click="pg.go" rv-text="pg.label" class="w-8 h-8 rounded bg-secondary text-on-secondary-fixed text-label-md font-bold"></button>
            <button rv-hide="pg.isActive" rv-on-click="pg.go" rv-text="pg.label" class="w-8 h-8 rounded hover:bg-white/5 text-on-surface-variant text-label-md transition-colors"></button>
          </span>
        </div>
        <button rv-on-click="pagination.nextPage" rv-attr-disabled="pagination.nextDisabled"
          class="p-2 rounded hover:bg-white/5 text-on-surface-variant transition-colors">
          <span class="material-symbols-outlined">chevron_right</span>
        </button>
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

        <!-- Desktop: Page header -->
        <div class="hidden lg:flex flex-col lg:flex-row lg:items-end justify-between gap-md pt-gutter mb-gutter">
          <div>
            <h2 class="text-display-lg font-display-lg text-on-surface mb-xs">Tenant Registry</h2>
            <p class="text-body-md font-body-md text-on-surface-variant max-w-2xl">Manage institutional entities and cryptographic custody configurations across the global network.</p>
          </div>
          <div class="flex items-center gap-sm shrink-0">
            <button class="flex items-center gap-base glass-card px-md py-2.5 rounded-lg text-label-md font-label-md text-on-surface hover:bg-white/10 transition-all">
              <span class="material-symbols-outlined text-[18px]">filter_list</span>
              Filter
            </button>
            <button class="flex items-center gap-base glass-card px-md py-2.5 rounded-lg text-label-md font-label-md text-on-surface hover:bg-white/10 transition-all">
              <span class="material-symbols-outlined text-[18px]">download</span>
              Export CSV
            </button>
          </div>
        </div>

        <!-- Error state -->
        <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-gutter">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-error">error</span>
            <span rv-text="error" class="font-body-sm text-error"></span>
          </div>
        </div>

        <!-- Loading state -->
        <div rv-show="loading" class="flex justify-center py-lg">
          <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
        </div>

        <!-- Mobile: search + cards + pagination -->
        <div rv-hide="loading" class="lg:hidden">
          ${searchBarTpl}
          <div rv-show="isEmpty" class="glass-card rounded-xl p-lg text-center">
            <span class="material-symbols-outlined text-[48px] text-on-surface-variant">business</span>
            <p class="font-body-md text-on-surface-variant mt-sm">No tenants found</p>
          </div>
          <div rv-hide="isEmpty" class="space-y-4">
            ${tenantCardTpl}
          </div>
          <div rv-hide="isEmpty">
            ${paginationTpl}
          </div>
        </div>

        <!-- Desktop: table with pagination -->
        ${desktopTableTpl}

      </div>
    </main>

    ${bottomNavTpl}

    <!-- FAB (mobile) -->
    <button rv-on-click="createTenant" class="lg:hidden fixed bottom-24 right-6 w-14 h-14 bg-secondary text-on-secondary rounded-full shadow-lg shadow-black/40 flex items-center justify-center active:scale-90 transition-all z-50 group">
      <span class="material-symbols-outlined text-[32px]">add</span>
      <span class="absolute right-full mr-4 bg-surface-container px-3 py-1.5 rounded-lg text-secondary font-label-md whitespace-nowrap opacity-0 group-active:opacity-100 transition-opacity pointer-events-none shadow-xl border border-white/10">Create Tenant</span>
    </button>

  </div>

  <!-- Mobile drawer overlay -->
  <div rv-show="drawerOpen" rv-on-click="closeDrawer" class="fixed inset-0 bg-black/60 z-[55] transition-opacity duration-300"></div>

  <!-- Mobile drawer -->
  <aside rv-attr-class="drawerClass" class="fixed inset-y-0 left-0 w-[280px] z-[60] bg-surface-container-low border-r border-white/5 shadow-xl flex flex-col py-lg transition-transform duration-300 lg:hidden -translate-x-full">
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
    sidebar: createSidebarController({
      activeRoute: ROUTE,
      router,
      onCreateTenant: () => self.createTenant(),
    }),
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

    _cursor: undefined,
    _prevCursors: [],
    _nextCursor: undefined,
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
        const data = await api.getTenants({ limit: PER_PAGE, cursor: self._cursor });
        const items = data.data || [];
        self._nextCursor = data.pagination?.nextCursor || undefined;
        self._total = items.length;
        self.tenants = items.map(t => createTenantViewModel(t, { router, api }));
        self.isEmpty = self.tenants.length === 0;
        const currentPage = self._prevCursors.length + 1;
        self.pagination = createPaginationController({
          page: currentPage,
          total: self._nextCursor ? currentPage * PER_PAGE + 1 : (currentPage - 1) * PER_PAGE + items.length,
          onPageChange: (p) => {
            if (p > currentPage && self._nextCursor) {
              self._prevCursors.push(self._cursor);
              self._cursor = self._nextCursor;
              self.load();
            } else if (p < currentPage && self._prevCursors.length > 0) {
              self._cursor = self._prevCursors.pop();
              self.load();
            }
          },
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
