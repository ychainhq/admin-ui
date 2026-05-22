import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { template as headerTpl, createCustomerDetailHeaderController } from '../components/CustomerDetailHeader.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/customers';
const ACTIVE_TAB = 'balances';

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

function normalizeBalance(raw) {
  const assetId = raw.asset_id || raw.assetId || '';
  const [chainFromAsset, assetFromAsset] = assetId.includes(':') ? assetId.split(':') : ['', ''];

  return {
    asset: raw.asset || assetFromAsset || '—',
    chain: raw.chain || chainFromAsset || '—',
    available: raw.available ?? formatRawAmount(raw.settled, assetId),
    pending: raw.pending_display || raw.pendingDisplay || formatRawAmount(raw.pending, assetId),
    hold: raw.hold ?? formatRawAmount(raw.hold_raw || raw.holdRaw || '0', assetId),
    total: raw.total_display || raw.totalDisplay || formatRawAmount(raw.total, assetId),
  };
}

async function safeLoad(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.message?.startsWith('HTTP 404') || e.message?.toLowerCase().includes('not found')) return null;
    throw e;
  }
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomers" href="#" class="text-on-surface-variant hover:text-on-surface transition-colors">Customers</a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomer" href="#" rv-text="header.customerId" class="text-on-surface font-semibold hover:text-secondary transition-colors"></a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Balances</span>
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
              <span class="material-symbols-outlined text-on-surface-variant text-[18px]">account_balance_wallet</span>
              <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Asset Balances</span>
            </div>

            <!-- Empty state -->
            <div rv-show="balancesEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">account_balance_wallet</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No balances for this customer</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="balancesEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ASSET</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CHAIN</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">AVAILABLE</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">PENDING</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">HOLD</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-balance="balances" class="hover:bg-white/[0.02]">
                    <td class="px-md py-3">
                      <span class="flex items-center gap-sm">
                        <span class="w-7 h-7 rounded bg-secondary/10 flex items-center justify-center">
                          <span class="material-symbols-outlined text-secondary text-[16px]">currency_bitcoin</span>
                        </span>
                        <span rv-text="balance.asset" class="font-label-md font-bold text-on-surface"></span>
                      </span>
                    </td>
                    <td rv-text="balance.chain" class="px-md py-3 font-body-sm text-on-surface-variant"></td>
                    <td rv-text="balance.available" class="px-md py-3 font-mono-data text-on-surface text-right"></td>
                    <td rv-text="balance.pending"   class="px-md py-3 font-mono-data text-on-surface-variant text-right"></td>
                    <td rv-text="balance.hold"      class="px-md py-3 font-mono-data text-on-surface-variant text-right"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="balancesEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-balance="balances" class="px-md py-3">
                <div class="flex items-center justify-between mb-xs">
                  <span class="flex items-center gap-sm">
                    <span class="w-7 h-7 rounded bg-secondary/10 flex items-center justify-center">
                      <span class="material-symbols-outlined text-secondary text-[16px]">currency_bitcoin</span>
                    </span>
                    <span rv-text="balance.asset" class="font-label-md font-bold text-on-surface"></span>
                    <span rv-text="balance.chain" class="font-body-sm text-on-surface-variant"></span>
                  </span>
                </div>
                <div class="grid grid-cols-3 gap-sm mt-sm">
                  <div>
                    <p class="font-label-md text-on-surface-variant text-[10px] uppercase">Available</p>
                    <p rv-text="balance.available" class="font-mono-data text-on-surface text-[13px]"></p>
                  </div>
                  <div>
                    <p class="font-label-md text-on-surface-variant text-[10px] uppercase">Pending</p>
                    <p rv-text="balance.pending" class="font-mono-data text-on-surface-variant text-[13px]"></p>
                  </div>
                  <div>
                    <p class="font-label-md text-on-surface-variant text-[10px] uppercase">Hold</p>
                    <p rv-text="balance.hold" class="font-mono-data text-on-surface-variant text-[13px]"></p>
                  </div>
                </div>
              </div>
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
      title: 'Balances',
      breadcrumb: 'Customers > Balances',
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

    balances: [],
    balancesEmpty: true,

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

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const [customer, balancesData, profileData, contactData] = await Promise.all([
          api.getCustomer(id),
          api.getCustomerBalances(id),
          safeLoad(() => api.getCustomerProfile(id)),
          safeLoad(() => api.getCustomerContact(id)),
        ]);

        self.header.setCustomer(customer);
        self.header.setProfile(profileData);
        self.header.setContact(contactData);

        const list = Array.isArray(balancesData) ? balancesData : (balancesData?.balances || []);
        self.balances = list.map(normalizeBalance);
        self.balancesEmpty = self.balances.length === 0;

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

export const CustomerBalancesView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router, id: params.id });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
