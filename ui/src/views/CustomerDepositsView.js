import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { template as paginationTpl, createPaginationController } from '../components/Pagination.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { template as headerTpl, createCustomerDetailHeaderController } from '../components/CustomerDetailHeader.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/customers';
const ACTIVE_TAB = 'deposits';
const PER_PAGE = 20;

async function safeLoad(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.message?.startsWith('HTTP 404') || e.message?.toLowerCase().includes('not found')) return null;
    throw e;
  }
}

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 16).replace('T', ' '); } catch { return '—'; }
}

const DEPOSIT_STATUS_BADGE = {
  pending:   'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  confirmed: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  finalized: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/30',
};

function depositStatusBadge(status) {
  return DEPOSIT_STATUS_BADGE[status] || DEPOSIT_STATUS_BADGE.pending;
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomers" href="#" class="text-on-surface-variant hover:text-on-surface transition-colors">Customers</a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomer" href="#" rv-text="header.customerId" class="text-on-surface font-semibold hover:text-secondary transition-colors"></a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Deposits</span>
  `,
  showSearch: false,
});

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

          <div rv-hide="loading" class="glass-card rounded-xl overflow-hidden">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
              <span class="material-symbols-outlined text-on-surface-variant text-[18px]">inbox</span>
              <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Deposits</span>
            </div>

            <!-- Empty state -->
            <div rv-show="depositsEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">inbox</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No deposits yet</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="depositsEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">DEPOSIT ID</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">AMOUNT</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ASSET</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ADDRESS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">DETECTED AT</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-deposit="deposits" class="hover:bg-white/[0.02]">
                    <td rv-text="deposit.depositId" class="px-md py-3 font-mono-data text-on-surface text-[12px]"></td>
                    <td rv-text="deposit.amount"    class="px-md py-3 font-mono-data text-on-surface font-semibold"></td>
                    <td rv-text="deposit.asset"     class="px-md py-3 font-label-md text-on-surface-variant"></td>
                    <td class="px-md py-3">
                      <span rv-text="deposit.statusLabel" rv-attr-class="deposit.statusBadgeClass"></span>
                    </td>
                    <td class="px-md py-3">
                      <span rv-text="deposit.addressShort" rv-attr-title="deposit.address" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td rv-text="deposit.detectedAt" class="px-md py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="depositsEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-deposit="deposits" class="px-md py-3">
                <div class="flex items-start justify-between mb-sm">
                  <div>
                    <p rv-text="deposit.depositId" class="font-mono-data text-on-surface text-[12px]"></p>
                    <p class="font-body-sm text-on-surface-variant mt-xs">
                      <span rv-text="deposit.amount" class="font-semibold text-on-surface"></span>
                      <span rv-text="deposit.asset"></span>
                    </p>
                  </div>
                  <span rv-text="deposit.statusLabel" rv-attr-class="deposit.statusBadgeClass"></span>
                </div>
                <p class="font-mono-data text-on-surface-variant text-[11px] truncate">
                  <span rv-text="deposit.addressShort"></span>
                </p>
                <p rv-text="deposit.detectedAt" class="font-mono-data text-on-surface-variant text-[11px] mt-xs"></p>
              </div>
            </div>

            <!-- Pagination (mobile only, desktop uses same component) -->
            <div rv-hide="depositsEmpty" class="border-t border-white/5">
              ${paginationTpl}
            </div>
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
      title: 'Deposits',
      breadcrumb: 'Customers > Deposits',
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

    deposits: [],
    depositsEmpty: true,
    pagination: createPaginationController({ page: 1, total: 0, onPageChange: () => {} }),
    _cursor: undefined,
    _prevCursors: [],
    _nextCursor: undefined,

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

    async loadDeposits() {
      const data = await api.getCustomerDeposits(id, { limit: PER_PAGE, cursor: self._cursor });
      const items = data.data || [];
      self._nextCursor = data.pagination?.nextCursor || undefined;
      self.deposits = items.map(d => {
        const addr = d.address || '';
        return {
          depositId:       d.depositId || d.deposit_id || '—',
          amount:          d.amount || '0',
          asset:           d.asset || '—',
          statusLabel:     (d.status || '').toUpperCase(),
          statusBadgeClass: depositStatusBadge(d.status),
          address:         addr,
          addressShort:    addr.length > 16 ? addr.slice(0, 8) + '…' + addr.slice(-6) : addr,
          detectedAt:      fmtDate(d.detectedAt || d.detected_at),
        };
      });
      self.depositsEmpty = self.deposits.length === 0;
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
    },

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const [customer, , profileData, contactData] = await Promise.all([
          api.getCustomer(id),
          self.loadDeposits(),
          safeLoad(() => api.getCustomerProfile(id)),
          safeLoad(() => api.getCustomerContact(id)),
        ]);
        self.header.setCustomer(customer);
        self.header.setProfile(profileData);
        self.header.setContact(contactData);
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

export const CustomerDepositsView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router, id: params.id });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
