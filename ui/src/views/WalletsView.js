import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/wallets';

function formatSats(raw) {
  if (raw === null || raw === undefined || raw === '') return '0';
  try {
    const sats = BigInt(String(raw));
    const sign = sats < 0n ? '-' : '';
    const abs = sats < 0n ? -sats : sats;
    const whole = abs / 100000000n;
    const fraction = String(abs % 100000000n).padStart(8, '0');
    return `${sign}${whole}.${fraction} BTC`;
  } catch {
    return String(raw);
  }
}

const TYPE_BADGE = {
  hot:     'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  deposit: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-on-surface-variant border border-white/20',
  cold:    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
};

function typeBadge(type) {
  return TYPE_BADGE[type] || TYPE_BADGE.deposit;
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Wallets</span>
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
      <div class="mx-auto pt-gutter">

        <div rv-show="noActiveTenant" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 flex items-start gap-sm">
          <span class="material-symbols-outlined text-error shrink-0 mt-xs">hub</span>
          <div>
            <p class="font-body-md text-error font-semibold">No active tenant</p>
            <p class="font-body-sm text-on-surface-variant mt-xs">
              Go to <a rv-on-click="goToTenants" href="#" class="text-secondary underline">Tenants</a> and click <strong>Work with</strong> first.
            </p>
          </div>
        </div>

        <div rv-hide="noActiveTenant">

          <!-- Sweep result -->
          <div rv-show="sweepResult" class="glass-card rounded-xl p-md bg-tertiary/10 border border-tertiary/30 mb-md flex items-start gap-sm">
            <span class="material-symbols-outlined text-tertiary shrink-0 mt-xs">check_circle</span>
            <div>
              <p class="font-body-md text-tertiary font-semibold">Sweep created</p>
              <p rv-text="sweepResult" class="font-mono-data text-on-surface text-[12px] mt-xs break-all"></p>
            </div>
          </div>

          <div rv-show="sweepError" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-md flex items-center gap-sm">
            <span class="material-symbols-outlined text-error">error</span>
            <span rv-text="sweepError" class="font-body-sm text-error"></span>
          </div>

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
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">account_balance</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Wallets</span>
              </div>
              <button rv-on-click="load" class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                <span class="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div rv-show="walletsEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">account_balance</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No wallets found</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="walletsEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ID</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TYPE</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CHAIN</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">BALANCE</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-wallet="wallets" class="hover:bg-white/[0.02]">
                    <td rv-text="wallet.id"    class="px-md py-3 font-mono-data text-on-surface text-[12px]"></td>
                    <td class="px-md py-3">
                      <span rv-text="wallet.typeLabel" rv-attr-class="wallet.typeBadgeClass"></span>
                    </td>
                    <td rv-text="wallet.chain" class="px-md py-3 font-body-sm text-on-surface-variant"></td>
                    <td rv-text="wallet.balance" class="px-md py-3 font-mono-data text-on-surface text-right"></td>
                    <td class="px-md py-3">
                      <button rv-on-click="wallet.sweep" rv-attr-disabled="wallet.sweeping"
                        class="flex items-center gap-xs px-sm py-1 rounded-lg border border-secondary/30 text-secondary hover:bg-secondary/10 transition-all text-[12px] font-bold active:scale-95 disabled:opacity-50">
                        <span class="material-symbols-outlined text-[14px]">merge</span>
                        <span rv-hide="wallet.sweeping">Sweep</span>
                        <span rv-show="wallet.sweeping">…</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="walletsEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-wallet="wallets" class="px-md py-3">
                <div class="flex items-start justify-between mb-xs">
                  <div>
                    <p rv-text="wallet.id" class="font-mono-data text-on-surface text-[12px]"></p>
                    <div class="flex items-center gap-sm mt-xs">
                      <span rv-text="wallet.typeLabel" rv-attr-class="wallet.typeBadgeClass"></span>
                      <span rv-text="wallet.chain" class="font-body-sm text-on-surface-variant"></span>
                    </div>
                  </div>
                  <span rv-text="wallet.balance" class="font-mono-data text-on-surface text-[13px]"></span>
                </div>
                <button rv-on-click="wallet.sweep" rv-attr-disabled="wallet.sweeping"
                  class="mt-sm flex items-center gap-xs px-sm py-1 rounded-lg border border-secondary/30 text-secondary hover:bg-secondary/10 transition-all text-[12px] font-bold active:scale-95 disabled:opacity-50">
                  <span class="material-symbols-outlined text-[14px]">merge</span>
                  <span rv-hide="wallet.sweeping">Create Sweep</span>
                  <span rv-show="wallet.sweeping">Creating…</span>
                </button>
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

export function createController({ api, router }) {
  const self = {
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'Wallets',
      breadcrumb: 'Wallets',
      onBack: () => router.navigate('#/tenants'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    error: null,
    sweepResult: null,
    sweepError: null,
    wallets: [],
    walletsEmpty: true,

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },

    async load() {
      self.loading = true;
      self.error = null;
      self.sweepResult = null;
      self.sweepError = null;
      try {
        const res = await api.getWallets();
        const items = res.data || res || [];
        self.wallets = (Array.isArray(items) ? items : []).map(w => {
          const type = w.wallet_type || w.walletType || w.type || 'deposit';
          const balRaw = w.balance_sats || w.balanceSats || w.balance || '0';
          return {
            id:            w.id || '—',
            typeLabel:     type.toUpperCase(),
            typeBadgeClass: typeBadge(type),
            chain:         w.chain || '—',
            balance:       formatSats(balRaw),
            sweeping:      false,
            sweep() {
              const wallet = this;
              wallet.sweeping = true;
              self.sweepResult = null;
              self.sweepError = null;
              api.createSweep({ sourceWalletId: w.id, chain: w.chain || 'bitcoin', note: 'UI sweep' })
                .then(result => {
                  const taskId = result.signingTaskId || result.signing_task_id || result.id || JSON.stringify(result);
                  self.sweepResult = `Signing task created: ${taskId}`;
                })
                .catch(e => { self.sweepError = e.message; })
                .finally(() => { wallet.sweeping = false; });
            },
          };
        });
        self.walletsEmpty = self.wallets.length === 0;
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

export const WalletsView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
