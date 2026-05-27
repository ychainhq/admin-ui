import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { template as paginationTpl, createPaginationController } from '../components/Pagination.js';
import { template as withdrawalBatchSearchTpl, createWithdrawalBatchSearchFormController } from '../components/WithdrawalBatchSearchForm.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/withdrawal-batches';

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 16).replace('T', ' '); } catch { return '—'; }
}

function shortId(v) {
  if (!v) return '—';
  return v.length > 20 ? v.slice(0, 10) + '…' + v.slice(-6) : v;
}

const STATUS_BADGE = {
  building:          'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-on-surface-variant border border-white/20',
  pending_approval:  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-on-surface-variant border border-white/20',
  pending_signature: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  broadcast:         'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  confirmed:         'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/30',
  failed:            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
  cancelled:         'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-on-surface-variant border border-white/10',
};

function batchStatusBadge(status) {
  return STATUS_BADGE[status] || STATUS_BADGE.pending_approval;
}

function normalizeBatch(b) {
  const status = b.status || '';
  const txHash = b.tx_hash || b.txHash || '';
  const feeRaw = b.fee_raw ?? b.feeRaw ?? null;
  const feeRate = b.fee_rate_sat_vb ?? b.feeRateSatVb ?? null;
  const signerId = b.signer_id || b.signerId || null;
  const replacedBy = b.replaced_by_batch_id || b.replacedByBatchId || null;
  const replacementOf = b.replacement_of_batch_id || b.replacementOfBatchId || null;

  return {
    id:                  b.id || '—',
    idShort:             shortId(b.id),
    statusLabel:         status.toUpperCase().replace(/_/g, ' '),
    statusBadgeClass:    batchStatusBadge(status),
    txHash,
    txHashShort:         txHash.length > 16 ? txHash.slice(0, 8) + '…' + txHash.slice(-6) : (txHash || '—'),
    outputsCount:        b.outputs_count ?? b.outputsCount ?? '—',
    totalOutputRaw:      b.total_output_raw ?? b.totalOutputRaw ?? '—',
    feeRaw:              feeRaw !== null ? feeRaw : '—',
    feeRateSatVb:        feeRate !== null ? feeRate : '—',
    decisionMode:        b.decision_mode || b.decisionMode || '—',
    approvedBy:          b.approved_by || b.approvedBy || '—',
    signerIdShort:       signerId ? shortId(signerId) : '—',
    signerId:            signerId || '',
    replacedByShort:     replacedBy ? shortId(replacedBy) : '—',
    replacedBy:          replacedBy || '',
    replacementOfShort:  replacementOf ? shortId(replacementOf) : '—',
    replacementOf:       replacementOf || '',
    lastError:           b.last_error || b.lastError || '',
    createdAt:           fmtDate(b.created_at || b.createdAt),
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

          ${withdrawalBatchSearchTpl}

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
              <table class="w-full text-left border-collapse" style="min-width:1100px">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">BATCH ID</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">OUTPUTS</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">TOTAL (sats)</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">FEE (sats)</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">RATE (sat/vB)</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">MODE</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">APPROVED BY</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">SIGNER</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TX HASH</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">REPLACES / REPLACED BY</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CREATED</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-batch="batches" class="hover:bg-white/[0.02]">
                    <td class="px-sm py-3">
                      <span rv-text="batch.idShort" rv-attr-title="batch.id" class="font-mono-data text-on-surface text-[12px] cursor-help"></span>
                    </td>
                    <td class="px-sm py-3">
                      <span rv-text="batch.statusLabel" rv-attr-class="batch.statusBadgeClass"></span>
                    </td>
                    <td rv-text="batch.outputsCount"   class="px-sm py-3 font-mono-data text-on-surface text-right text-[12px]"></td>
                    <td rv-text="batch.totalOutputRaw" class="px-sm py-3 font-mono-data text-on-surface-variant text-right text-[12px]"></td>
                    <td rv-text="batch.feeRaw"         class="px-sm py-3 font-mono-data text-on-surface text-right text-[12px]"></td>
                    <td rv-text="batch.feeRateSatVb"   class="px-sm py-3 font-mono-data text-on-surface-variant text-right text-[12px]"></td>
                    <td rv-text="batch.decisionMode"   class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td rv-text="batch.approvedBy"     class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td class="px-sm py-3">
                      <span rv-text="batch.signerIdShort" rv-attr-title="batch.signerId" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td class="px-sm py-3">
                      <span rv-text="batch.txHashShort" rv-attr-title="batch.txHash" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td class="px-sm py-3 text-[11px] text-on-surface-variant font-mono-data">
                      <span rv-show="batch.replacementOf"><span class="text-[9px] text-outline mr-1">replaces</span><span rv-text="batch.replacementOfShort" rv-attr-title="batch.replacementOf" class="cursor-help"></span></span>
                      <span rv-show="batch.replacedBy"><span class="text-[9px] text-outline mr-1">→</span><span rv-text="batch.replacedByShort" rv-attr-title="batch.replacedBy" class="cursor-help"></span></span>
                      <span rv-hide="batch.replacementOf" rv-hide="batch.replacedBy">—</span>
                    </td>
                    <td rv-text="batch.createdAt"      class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="batchesEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-batch="batches" class="px-md py-3">
                <div class="flex items-start justify-between mb-xs">
                  <p rv-text="batch.idShort" class="font-mono-data text-on-surface text-[12px]"></p>
                  <span rv-text="batch.statusLabel" rv-attr-class="batch.statusBadgeClass"></span>
                </div>
                <p class="font-mono-data text-on-surface-variant text-[11px] mb-xs"><span rv-text="batch.txHashShort"></span></p>
                <div class="grid grid-cols-2 gap-xs text-[11px]">
                  <span class="text-on-surface-variant">Outputs: <span rv-text="batch.outputsCount" class="font-mono-data text-on-surface"></span></span>
                  <span class="text-on-surface-variant">Total: <span rv-text="batch.totalOutputRaw" class="font-mono-data text-on-surface"></span> sats</span>
                  <span class="text-on-surface-variant">Fee: <span rv-text="batch.feeRaw" class="font-mono-data text-on-surface"></span> sats</span>
                  <span class="text-on-surface-variant">Rate: <span rv-text="batch.feeRateSatVb" class="font-mono-data text-on-surface"></span> sat/vB</span>
                  <span class="text-on-surface-variant">Mode: <span rv-text="batch.decisionMode" class="font-mono-data text-on-surface"></span></span>
                  <span class="text-on-surface-variant">Signer: <span rv-text="batch.signerIdShort" class="font-mono-data text-on-surface"></span></span>
                </div>
                <p rv-text="batch.createdAt" class="font-mono-data text-on-surface-variant text-[11px] mt-xs"></p>
              </div>
            </div>

            <!-- Pagination -->
            <div rv-show="pagination.hasPages" class="px-md py-sm border-t border-white/5">
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
    _activeFilters: {},
    _cursor: undefined,
    _prevCursors: [],
    _nextCursor: undefined,
    pagination: { visible: false },

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const res = await api.getWithdrawalBatches({
          limit: 20,
          cursor: self._cursor,
          ...self._activeFilters,
        });
        const items = res.data || res || [];
        self._nextCursor = res.pagination?.nextCursor || undefined;
        self.batches = (Array.isArray(items) ? items : []).map(normalizeBatch);
        self.batchesEmpty = self.batches.length === 0;
        const currentPage = self._prevCursors.length + 1;
        self.pagination = createPaginationController({
          page: currentPage,
          total: self._nextCursor
            ? currentPage * 20 + 1
            : (currentPage - 1) * 20 + self.batches.length,
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
      if (!self.noActiveTenant) self.load();
    },
  };

  self.withdrawalBatchSearchForm = createWithdrawalBatchSearchFormController({
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

export const WithdrawalBatchesView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
