import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/withdrawal-batches';

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 16).replace('T', ' '); } catch { return '—'; }
}

const STATUS_BADGE = {
  pending_approval:  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-on-surface-variant border border-white/20',
  pending_signature: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  broadcast:         'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  confirmed:         'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/30',
  failed:            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
};

function batchStatusBadge(status) {
  return STATUS_BADGE[status] || STATUS_BADGE.pending_approval;
}

function normalizeBatch(b) {
  const status = b.status || '';
  const txHash = b.tx_hash || b.txHash || '';
  return {
    id:           b.id || '—',
    statusLabel:  status.toUpperCase().replace(/_/g, ' '),
    statusBadgeClass: batchStatusBadge(status),
    txHash,
    txHashShort:  txHash.length > 16 ? txHash.slice(0, 8) + '…' + txHash.slice(-6) : (txHash || '—'),
    fee:          b.fee_sats || b.feeSats || b.fee || '—',
    itemCount:    b.item_count || b.itemCount || (b.items?.length ?? '—'),
    createdAt:    fmtDate(b.created_at || b.createdAt),
  };
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Withdrawal Batches</span>
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
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">pending_actions</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Withdrawal Batches</span>
              </div>
              <button rv-on-click="load" class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                <span class="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div rv-show="batchesEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">pending_actions</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No withdrawal batches yet</p>
              <p class="font-body-sm text-on-surface-variant mt-xs">Batcher runs every 30s when withdrawals are pending</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="batchesEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">BATCH ID</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TX HASH</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">FEE (SATS)</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">ITEMS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CREATED</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-batch="batches" class="hover:bg-white/[0.02]">
                    <td rv-text="batch.id"         class="px-md py-3 font-mono-data text-on-surface text-[12px]"></td>
                    <td class="px-md py-3">
                      <span rv-text="batch.statusLabel" rv-attr-class="batch.statusBadgeClass"></span>
                    </td>
                    <td class="px-md py-3">
                      <span rv-text="batch.txHashShort" rv-attr-title="batch.txHash" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td rv-text="batch.fee"        class="px-md py-3 font-mono-data text-on-surface-variant text-right text-[12px]"></td>
                    <td rv-text="batch.itemCount"  class="px-md py-3 font-mono-data text-on-surface text-right text-[12px]"></td>
                    <td rv-text="batch.createdAt"  class="px-md py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="batchesEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-batch="batches" class="px-md py-3">
                <div class="flex items-start justify-between mb-xs">
                  <p rv-text="batch.id" class="font-mono-data text-on-surface text-[12px]"></p>
                  <span rv-text="batch.statusLabel" rv-attr-class="batch.statusBadgeClass"></span>
                </div>
                <p class="font-mono-data text-on-surface-variant text-[11px]"><span rv-text="batch.txHashShort"></span></p>
                <div class="flex gap-md mt-xs">
                  <span class="font-body-sm text-on-surface-variant text-[11px]">Fee: <span rv-text="batch.fee" class="font-mono-data text-on-surface"></span> sats</span>
                  <span class="font-body-sm text-on-surface-variant text-[11px]">Items: <span rv-text="batch.itemCount" class="font-mono-data text-on-surface"></span></span>
                </div>
                <p rv-text="batch.createdAt" class="font-mono-data text-on-surface-variant text-[11px] mt-xs"></p>
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
      title: 'Withdrawal Batches',
      breadcrumb: 'Withdrawal Batches',
      onBack: () => router.navigate('#/tenants'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    error: null,
    batches: [],
    batchesEmpty: true,

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const res = await api.getWithdrawalBatches();
        const items = res.data || res || [];
        self.batches = (Array.isArray(items) ? items : []).map(normalizeBatch);
        self.batchesEmpty = self.batches.length === 0;
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

export const WithdrawalBatchesView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
