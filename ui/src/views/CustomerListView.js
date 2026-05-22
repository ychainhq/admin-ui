import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as paginationTpl, createPaginationController } from '../components/Pagination.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { template as customerCardTpl, createCustomerViewModel } from '../components/CustomerCard.js';
import { template as searchFormTpl, createCustomerSearchFormController } from '../components/CustomerSearchForm.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/customers';
const PER_PAGE = 20;

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Customers</span>
  `,
  showSearch: false,
});

const desktopTableTpl = `
<div rv-show="hasSearched" rv-hide="loading" class="hidden lg:block">
  <div rv-show="isEmpty" class="glass-card rounded-xl p-lg text-center">
    <span class="material-symbols-outlined text-[48px] text-on-surface-variant">manage_search</span>
    <p class="font-body-md text-on-surface-variant mt-sm">No customers found matching your criteria</p>
  </div>
  <div rv-hide="isEmpty" class="glass-card rounded-xl overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse">
        <thead>
          <tr class="border-b border-white/10 bg-white/5">
            <th class="px-md py-4 text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">CUSTOMER &amp; REFERENCE</th>
            <th class="px-md py-4 text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
            <th class="px-md py-4 text-label-md font-label-md text-on-surface-variant uppercase tracking-wider">CREATED DATE</th>
            <th class="px-md py-4 text-label-md font-label-md text-on-surface-variant uppercase tracking-wider text-right">ACTION</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          <tr rv-each-customer="customers" class="hover:bg-white/[0.03] transition-colors">
            <td class="px-md py-4">
              <div class="flex items-center gap-sm">
                <div class="w-10 h-10 rounded-lg bg-tertiary/10 flex items-center justify-center border border-tertiary/20 shrink-0">
                  <span class="material-symbols-outlined text-tertiary">person</span>
                </div>
                <div>
                  <p rv-text="customer.customerId" class="font-mono-data text-[13px] text-on-surface"></p>
                  <p rv-show="customer.hasReference" rv-text="customer.reference" class="font-body-sm text-on-surface-variant"></p>
                  <p rv-hide="customer.hasReference" class="font-body-sm text-on-surface-variant italic opacity-50">No reference</p>
                </div>
              </div>
            </td>
            <td class="px-md py-4">
              <span rv-text="customer.statusLabel" rv-attr-class="customer.statusBadgeClass"></span>
            </td>
            <td rv-text="customer.createdAt" class="px-md py-4 font-body-sm text-on-surface-variant font-mono"></td>
            <td class="px-md py-4 text-right">
              <button rv-on-click="customer.view"
                class="flex items-center gap-xs ml-auto px-md py-2 rounded text-secondary hover:bg-secondary/10 text-label-md font-bold transition-all">
                <span class="material-symbols-outlined text-[16px]">open_in_new</span>
                View
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex items-center justify-between px-md py-4 bg-white/[0.02] border-t border-white/5">
      <p class="text-body-sm font-body-sm text-on-surface-variant">
        Showing <span rv-text="pagination.from" class="text-on-surface font-semibold"></span>–<span rv-text="pagination.to" class="text-on-surface font-semibold"></span>
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

        <!-- No active tenant guard -->
        <div rv-show="noActiveTenant" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mt-gutter flex items-start gap-sm">
          <span class="material-symbols-outlined text-error shrink-0 mt-xs">hub</span>
          <div>
            <p class="font-body-md text-error font-semibold">No active tenant</p>
            <p class="font-body-sm text-on-surface-variant mt-xs">
              Go to <a rv-on-click="goToTenants" href="#" class="text-secondary underline">Tenants</a>
              and click <strong>Work with</strong> to activate a tenant first.
            </p>
          </div>
        </div>

        <div rv-hide="noActiveTenant">

          <!-- Desktop page header -->
          <div class="hidden lg:flex flex-col lg:flex-row lg:items-end justify-between gap-md pt-gutter mb-gutter">
            <div>
              <h2 class="text-display-lg font-display-lg text-on-surface mb-xs">Customers</h2>
              <p class="text-body-md font-body-md text-on-surface-variant">Search customers for the active tenant.</p>
            </div>
            <button rv-hide="noActiveTenant" rv-on-click="createCustomer"
              class="hidden lg:flex items-center gap-xs px-md py-2 rounded-lg bg-secondary text-on-secondary-fixed text-label-md font-semibold hover:brightness-110 transition-all shrink-0">
              <span class="material-symbols-outlined text-[18px]">person_add</span>
              New Customer
            </button>
          </div>

          <!-- Search form (always visible) -->
          ${searchFormTpl}

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

          <!-- Pre-search prompt -->
          <div rv-hide="hasSearched" rv-hide="loading" class="glass-card rounded-xl p-lg text-center">
            <span class="material-symbols-outlined text-[48px] text-on-surface-variant">manage_search</span>
            <p class="font-body-md text-on-surface-variant mt-sm">Enter search criteria above and click Search</p>
          </div>

          <!-- Mobile: cards + pagination (after search) -->
          <div rv-show="hasSearched" rv-hide="loading" class="lg:hidden">
            <div rv-show="isEmpty" class="glass-card rounded-xl p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">manage_search</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No customers found matching your criteria</p>
            </div>
            <div rv-hide="isEmpty">
              ${customerCardTpl}
              ${paginationTpl}
            </div>
          </div>

          <!-- Desktop: table (after search) -->
          ${desktopTableTpl}

        </div>
      </div>
    </main>

    ${bottomNavTpl}

    <!-- FAB (mobile) -->
    <button rv-hide="noActiveTenant" rv-on-click="createCustomer"
      class="lg:hidden fixed bottom-24 right-6 w-14 h-14 bg-secondary text-on-secondary rounded-full shadow-lg shadow-black/40 flex items-center justify-center active:scale-90 transition-all z-50 group">
      <span class="material-symbols-outlined text-[32px]">person_add</span>
      <span class="absolute right-full mr-4 bg-surface-container px-3 py-1.5 rounded-lg text-secondary font-label-md whitespace-nowrap opacity-0 group-active:opacity-100 transition-opacity pointer-events-none shadow-xl border border-white/10">New Customer</span>
    </button>

  </div>

  ${mobileDrawerTpl}

</div>
`;

export function createController({ api, router }) {
  const self = {
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'Customers',
      breadcrumb: 'Tenant > Customers',
      onBack: () => window.history.back(),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    customers: [],
    loading: false,
    error: null,
    isEmpty: false,
    hasSearched: false,

    pagination: createPaginationController({ page: 1, total: 0, onPageChange: () => {} }),
    _cursor: undefined,
    _prevCursors: [],
    _nextCursor: undefined,
    _activeFilters: {},

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },
    createCustomer() { router.navigate('#/customers/new'); },

    async load() {
      self.loading = true;
      self.error = null;
      self.isEmpty = false;
      try {
        const data = await api.getCustomers({
          limit: PER_PAGE,
          cursor: self._cursor,
          ...self._activeFilters,
        });
        const items = data.data || [];
        self._nextCursor = data.pagination?.nextCursor || undefined;
        self.customers = items.map(c => createCustomerViewModel(c, { router }));
        self.isEmpty = self.customers.length === 0;
        const currentPage = self._prevCursors.length + 1;
        self.pagination = createPaginationController({
          page: currentPage,
          total: self._nextCursor
            ? currentPage * PER_PAGE + 1
            : (currentPage - 1) * PER_PAGE + items.length,
          onPageChange(p) {
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
      // No auto-load — user must submit the search form first.
    },
  };

  self.searchForm = createCustomerSearchFormController({
    onSearch(filters) {
      self._activeFilters = filters;
      self._cursor = undefined;
      self._prevCursors = [];
      self.hasSearched = true;
      self.load();
    },
    onClear() {
      self._activeFilters = {};
      self._cursor = undefined;
      self._prevCursors = [];
      self.hasSearched = false;
      self.customers = [];
      self.isEmpty = false;
      self.error = null;
    },
  });

  return self;
}

export const CustomerListView = {
  mount(el, _params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
