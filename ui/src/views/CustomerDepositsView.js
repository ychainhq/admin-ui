import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { template as paginationTpl, createPaginationController } from '../components/Pagination.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { template as headerTpl, createCustomerDetailHeaderController } from '../components/CustomerDetailHeader.js';
import { template as depositSearchTpl, createDepositSearchFormController } from '../components/DepositSearchForm.js';
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

function formatRawAmount(raw, assetId) {
  if (raw === null || raw === undefined || raw === '') return '0';
  const value = String(raw);
  if (assetId === 'bitcoin:BTC') {
    const sats = BigInt(value);
    const sign = sats < 0n ? '-' : '';
    const abs = sats < 0n ? -sats : sats;
    const whole = abs / 100000000n;
    const fraction = String(abs % 100000000n).padStart(8, '0');
    return `${sign}${whole}.${fraction}`;
  }
  return value;
}

const DEPOSIT_STATUS_BADGE = {
  detected:             'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  pending:              'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  pending_confirmation: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  confirmed:            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  finalized:            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/30',
};

function depositStatusBadge(status) {
  return DEPOSIT_STATUS_BADGE[status] || DEPOSIT_STATUS_BADGE.pending;
}

function normalizeDeposit(d) {
  const assetId = d.asset_id || d.assetId || '';
  const [, assetFromAssetId] = assetId.includes(':') ? assetId.split(':') : ['', ''];
  const addr = d.address || '';
  const status = d.status || '';

  return {
    depositId:       d.depositId || d.deposit_id || d.id || '—',
    amount:          d.amount || d.amount_display || d.amountDisplay || formatRawAmount(d.amount_raw || d.amountRaw, assetId),
    asset:           d.asset || assetFromAssetId || assetId || '—',
    statusLabel:     status.toUpperCase(),
    statusBadgeClass: depositStatusBadge(status),
    address:         addr,
    addressShort:    addr.length > 16 ? addr.slice(0, 8) + '…' + addr.slice(-6) : addr,
    detectedAt:      fmtDate(d.detectedAt || d.detected_at || d.created_at || d.createdAt),
  };
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

          <!-- Deposit Address card -->
          <div class="glass-card rounded-xl overflow-hidden mb-md">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
              <span class="material-symbols-outlined text-on-surface-variant text-[18px]">qr_code_2</span>
              <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Deposit Address</span>
            </div>
            <div class="p-md">
              <div rv-show="depositAddr.error" class="flex items-center gap-sm mb-sm text-error">
                <span class="material-symbols-outlined text-[16px]">error</span>
                <span rv-text="depositAddr.error" class="font-body-sm"></span>
              </div>
              <div rv-show="depositAddr.address" class="mb-sm">
                <div class="flex items-center gap-sm flex-wrap">
                  <span rv-text="depositAddr.address" class="font-mono-data text-on-surface text-[13px] break-all"></span>
                  <button rv-on-click="depositAddr.copy"
                    class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                    <span class="material-symbols-outlined text-[14px]">content_copy</span>
                    Copy
                  </button>
                </div>
                <p class="font-body-sm text-on-surface-variant mt-sm flex items-center gap-xs">
                  <span class="material-symbols-outlined text-[14px]">info</span>
                  To fund this address go to
                  <a rv-on-click="depositAddr.goToDevNodes" href="#"
                    class="text-secondary underline hover:brightness-110">Dev Nodes → Send Transaction</a>
                </p>
              </div>
              <button rv-show="depositAddr.showCreate" rv-on-click="depositAddr.create" rv-attr-disabled="depositAddr.loading"
                class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
                <span class="material-symbols-outlined text-[18px]">add_circle</span>
                <span rv-hide="depositAddr.loading">Create Deposit Address</span>
                <span rv-show="depositAddr.loading">Creating…</span>
              </button>
            </div>
          </div>

          <!-- Deposit Addresses list -->
          <div class="glass-card rounded-xl overflow-hidden mb-md">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">wallet</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Deposit Addresses</span>
              </div>
              <button rv-on-click="generateDepositAddress" rv-attr-disabled="depositGenerating"
                class="flex items-center gap-xs px-sm py-1 rounded-lg bg-secondary text-on-secondary-fixed text-[12px] font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
                <span class="material-symbols-outlined text-[14px]">add</span>
                <span rv-hide="depositGenerating">Generate</span>
                <span rv-show="depositGenerating">Generating…</span>
              </button>
            </div>
            <div rv-show="depositGenResult" class="px-md py-sm bg-tertiary/10 border-b border-tertiary/20 flex items-center gap-sm">
              <span class="material-symbols-outlined text-tertiary text-[16px]">check_circle</span>
              <span rv-text="depositGenResult" class="font-mono-data text-tertiary text-[12px] break-all"></span>
            </div>
            <div rv-show="depositGenError" class="px-md py-sm bg-error/10 border-b border-error/20 flex items-center gap-sm">
              <span class="material-symbols-outlined text-error text-[16px]">error</span>
              <span rv-text="depositGenError" class="font-body-sm text-error"></span>
            </div>
            <!-- Address filter bar -->
            <div rv-show="addressesLoaded" class="px-md py-sm border-b border-white/5 flex flex-wrap gap-sm items-center">
              <span class="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">Filter:</span>
              <select rv-on-change="onAddrFilterChange" name="status"
                class="bg-[#151b2d] border border-white/10 rounded-lg px-sm py-1 text-on-surface text-[12px] font-mono-data focus:ring-1 focus:ring-secondary outline-none appearance-none">
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="disabled">Disabled</option>
              </select>
              <select rv-on-change="onAddrFilterChange" name="chain"
                class="bg-[#151b2d] border border-white/10 rounded-lg px-sm py-1 text-on-surface text-[12px] font-mono-data focus:ring-1 focus:ring-secondary outline-none appearance-none">
                <option value="">All chains</option>
                <option value="bitcoin">Bitcoin</option>
              </select>
            </div>
            <div rv-show="depositAddressesEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[40px] text-on-surface-variant">account_balance_wallet</span>
              <p class="font-body-sm text-on-surface-variant mt-sm">No deposit addresses yet — click Generate to create one</p>
            </div>
            <div rv-hide="depositAddressesEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ADDRESS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CHAIN</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-daddr="depositAddresses" class="hover:bg-white/[0.02]">
                    <td class="px-md py-3 font-mono-data text-on-surface text-[12px]">
                      <span rv-text="daddr.addressShort"></span>
                    </td>
                    <td class="px-md py-3">
                      <span rv-text="daddr.chain" class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20"></span>
                    </td>
                    <td class="px-md py-3">
                      <span rv-text="daddr.statusLabel" rv-attr-class="daddr.statusBadgeClass"></span>
                    </td>
                    <td class="px-md py-3">
                      <button rv-on-click="daddr.copy"
                        class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:bg-white/5 transition-all text-[12px]">
                        <span class="material-symbols-outlined text-[14px]">content_copy</span>
                        Copy
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div rv-hide="depositAddressesEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-daddr="depositAddresses" class="px-md py-3 space-y-xs">
                <div class="flex items-center justify-between gap-sm">
                  <span rv-text="daddr.chain" class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20"></span>
                  <span rv-text="daddr.statusLabel" rv-attr-class="daddr.statusBadgeClass"></span>
                </div>
                <p rv-text="daddr.addressShort" class="font-mono-data text-on-surface text-[12px] break-all"></p>
                <button rv-on-click="daddr.copy"
                  class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:bg-white/5 transition-all text-[12px]">
                  <span class="material-symbols-outlined text-[14px]">content_copy</span>
                  Copy
                </button>
              </div>
            </div>
          </div>

          ${depositSearchTpl}

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
    depositAddresses: [],
    depositAddressesEmpty: true,
    _allDepositAddresses: [],
    addrFilter: {
      status: '',
      chain: '',
    },
    addressesLoaded: false,
    depositGenerating: false,
    depositGenError: null,
    depositGenResult: null,
    pagination: createPaginationController({ page: 1, total: 0, onPageChange: () => {} }),
    _cursor: undefined,
    _prevCursors: [],
    _nextCursor: undefined,
    _activeFilters: {},

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },
    goToCustomers(e) { e?.preventDefault(); router.navigate('#/customers'); },
    goToCustomer(e) { e?.preventDefault(); router.navigate(`#/customers/${encodeURIComponent(id)}/profile`); },

    depositAddr: {
      address: '',
      showCreate: true,
      loading: false,
      error: null,
      async create() {
        self.depositAddr.loading = true;
        self.depositAddr.error = null;
        try {
          const result = await api.createDepositAddress(id, { chain: 'bitcoin' });
          const addr = result.address || result.depositAddress || '';
          self.depositAddr.address = addr;
          self.depositAddr.showCreate = false;
          if (addr) {
            const isActive = !result.status || result.status === 'active';
            self._allDepositAddresses = [{
              addressShort: addr,
              chain:        result.chain_id || result.chain || 'bitcoin',
              statusLabel:  result.status || 'active',
              statusBadgeClass: isActive
                ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20'
                : 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-on-surface-variant border border-white/10',
              copy() { navigator.clipboard?.writeText(addr)?.catch(() => {}); },
            }, ...self._allDepositAddresses];
            self._applyAddrFilter();
          }
        } catch (e) {
          self.depositAddr.error = e.message;
        } finally {
          self.depositAddr.loading = false;
        }
      },
      copy() {
        if (self.depositAddr.address) navigator.clipboard.writeText(self.depositAddr.address).catch(() => {});
      },
      goToDevNodes(e) { e?.preventDefault(); router.navigate('#/nodes/btc-regtest'); },
    },

    _applyAddrFilter() {
      const { status, chain } = self.addrFilter;
      const filtered = self._allDepositAddresses.filter(a => {
        if (status && a.statusLabel.toLowerCase() !== status) return false;
        if (chain && a.chain.toLowerCase() !== chain.toLowerCase()) return false;
        return true;
      });
      self.depositAddresses = filtered;
      self.depositAddressesEmpty = filtered.length === 0;
    },

    onAddrFilterChange(e) {
      const { name, value } = e.target;
      self.addrFilter[name] = value;
      self._applyAddrFilter();
    },

    async generateDepositAddress() {
      self.depositGenerating = true;
      self.depositGenError = null;
      self.depositGenResult = null;
      try {
        const result = await api.createDepositAddress(id, { chain: 'bitcoin' });
        const addr = result.address || '';
        const isActive = !result.status || result.status === 'active';
        self._allDepositAddresses = [{
          addressShort: addr,
          chain:        result.chain || 'bitcoin',
          statusLabel:  result.status || 'active',
          statusBadgeClass: isActive
            ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20'
            : 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-on-surface-variant border border-white/10',
          copy() { navigator.clipboard?.writeText(addr)?.catch(() => {}); },
        }, ...self._allDepositAddresses];
        self._applyAddrFilter();
        self.depositGenResult = addr;
      } catch (e) {
        self.depositGenError = e.message;
      } finally {
        self.depositGenerating = false;
      }
    },

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
      const data = await api.getCustomerDeposits(id, {
        limit: PER_PAGE,
        cursor: self._cursor,
        ...self._activeFilters,
      });
      const items = data.data || [];
      self._nextCursor = data.pagination?.nextCursor || undefined;
      self.deposits = items.map(normalizeDeposit);
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
        const [customer, , profileData, contactData, depositAddrsData] = await Promise.all([
          api.getCustomer(id),
          self.loadDeposits(),
          safeLoad(() => api.getCustomerProfile(id)),
          safeLoad(() => api.getCustomerContact(id)),
          safeLoad(() => api.getCustomerAddresses(id)),
        ]);
        self.header.setCustomer(customer);
        self.header.setProfile(profileData);
        self.header.setContact(contactData);

        const addrsList = depositAddrsData?.data || [];
        self.depositAddresses = addrsList.map(a => {
          const isActive = !a.status || a.status === 'active';
          return {
            addressShort: a.address || '—',
            chain:        a.chain_id || a.chain || '—',
            statusLabel:  a.status || 'active',
            statusBadgeClass: isActive
              ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20'
              : 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-on-surface-variant border border-white/10',
            copy() { navigator.clipboard?.writeText(a.address)?.catch(() => {}); },
          };
        });
        self._allDepositAddresses = self.depositAddresses.slice();
        self._applyAddrFilter();
        self.addressesLoaded = true;
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

  self.depositSearchForm = createDepositSearchFormController({
    onSearch(filters) {
      self._activeFilters = filters;
      self._cursor = undefined;
      self._prevCursors = [];
      self.load();
    },
    onClear() {
      self._activeFilters = {};
      self._cursor = undefined;
      self._prevCursors = [];
      self.error = null;
      self.load();
    },
  });

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
