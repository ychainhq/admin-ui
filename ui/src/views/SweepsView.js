import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { template as paginationTpl, createPaginationController } from '../components/Pagination.js';
import { template as sweepSearchTpl, createSweepSearchFormController } from '../components/SweepSearchForm.js';
import { template as chainSelectorTpl, createSweepChainSelectorController } from '../components/SweepChainSelector.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/sweeps';
const LIMIT = 20;

// ─── Amount formatting — chain-agnostic ──────────────────────────────────────

const ASSET_META = {
  'bitcoin:BTC': { decimals: 8, symbol: 'BTC',  subunit: 'sats' },
  'tron:TRX':   { decimals: 6, symbol: 'TRX',  subunit: 'sun' },
  'tron:USDT':  { decimals: 6, symbol: 'USDT', subunit: 'µUSDT' },
};

function formatAssetRaw(raw, assetId) {
  if (raw === null || raw === undefined || raw === '—') return '—';
  const meta = ASSET_META[assetId] ?? { decimals: 8, symbol: '?', subunit: 'units' };
  try {
    const n = BigInt(raw);
    const divisor = BigInt(10 ** meta.decimals);
    if (n >= divisor / 100n) {
      return (Number(n) / 10 ** meta.decimals).toFixed(4) + ' ' + meta.symbol;
    }
    return Number(n).toLocaleString() + ' ' + meta.subunit;
  } catch { return String(raw); }
}

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v * 1000).toISOString().slice(0, 16).replace('T', ' '); } catch { return '—'; }
}

function shortId(v) {
  if (!v) return '—';
  return v.length > 20 ? v.slice(0, 10) + '…' + v.slice(-6) : v;
}

const STATUS_BADGE = {
  pending_signature: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  broadcast:         'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  confirmed:         'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/30',
  failed:            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
};

function sweepStatusBadge(status) {
  return STATUS_BADGE[status] || 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-on-surface-variant border border-white/20';
}

function normalizeSweep(s) {
  const status = s.status || '';
  const txHash = s.tx_hash || s.txHash || '';
  const fromAddresses = Array.isArray(s.from_addresses) ? s.from_addresses : [];
  const assetId = s.asset_id ?? 'bitcoin:BTC';
  return {
    id:               s.id || '—',
    idShort:          shortId(s.id),
    statusLabel:      status.toUpperCase().replace(/_/g, ' '),
    statusBadgeClass: sweepStatusBadge(status),
    amountFmt:        formatAssetRaw(s.amount_raw ?? s.amountRaw, assetId),
    feeFmt:           formatAssetRaw(s.fee_raw ?? s.feeRaw, assetId),
    addressCount:     fromAddresses.length,
    chainId:          s.chain_id ?? 'bitcoin',
    assetId,
    chainLabel:       s.chain_id === 'tron' ? 'TRON' : 'BTC',
    txHash,
    txHashShort:      txHash.length > 16 ? txHash.slice(0, 8) + '…' + txHash.slice(-6) : (txHash || '—'),
    createdAt:        fmtDate(s.created_at ?? s.createdAt),
    error:            s.error || '',
  };
}

// ─── Summary normalization ────────────────────────────────────────────────────

function normalizeSummary(data) {
  if (!data) {
    return {
      hasThreshold: false, hasPending: false, hasGap: false, showUtxos: false,
      currentFmt: '—', thresholdFmt: '—', missingFmt: '—',
      progressPctLabel: '0%', progressStyle: 'width:0%;background:var(--color-secondary)',
      pendingSweepIdShort: '—',
      totalDepositAddresses: 0, addressesWithBalance: 0, totalUtxos: 0,
      hotWalletAddress: '—', hotWalletAddressFull: '',
    };
  }
  const assetId = data.asset_id ?? 'bitcoin:BTC';
  const hasThreshold = data.threshold_raw !== null && data.threshold_raw !== undefined;
  const progressPct = data.progress_pct ?? 0;
  const hasGap = hasThreshold && (data.missing_raw && data.missing_raw !== '0');
  const barColor = progressPct >= 100 ? 'var(--color-tertiary)' : 'var(--color-secondary)';
  const hotFull = data.hot_wallet_address ?? '';
  return {
    hasThreshold,
    hasPending: !!data.pending_sweep_id,
    hasGap,
    showUtxos: data.total_utxos !== null && data.total_utxos !== undefined,
    currentFmt:        formatAssetRaw(data.current_total_raw, assetId),
    thresholdFmt:      hasThreshold ? formatAssetRaw(data.threshold_raw, assetId) : '—',
    missingFmt:        data.missing_raw ? formatAssetRaw(data.missing_raw, assetId) : '—',
    progressPctLabel:  `${progressPct}%`,
    progressStyle:     `width:${Math.min(progressPct, 100)}%;background:${barColor}`,
    pendingSweepIdShort: data.pending_sweep_id ? shortId(data.pending_sweep_id) : '—',
    totalDepositAddresses: data.total_deposit_addresses ?? 0,
    addressesWithBalance:  data.addresses_with_balance ?? 0,
    totalUtxos:            data.total_utxos ?? 0,
    hotWalletAddress:      hotFull ? (hotFull.length > 20 ? hotFull.slice(0, 10) + '…' + hotFull.slice(-8) : hotFull) : '—',
    hotWalletAddressFull:  hotFull,
  };
}

// ─── Config normalization — per selected chain ────────────────────────────────

function normalizeConfig(cfg, selectedChain) {
  const defaults = { thresholdLabel: '—', xpub: '—', xpubShort: '—', chainLabel: 'Chain', nextDerivationIndex: '—' };
  if (!cfg || !selectedChain) return defaults;

  const truncateXpub = (xpub) => xpub
    ? (xpub.length > 20 ? xpub.slice(0, 10) + '…' + xpub.slice(-8) : xpub)
    : 'Not configured';

  if (selectedChain.chainId === 'bitcoin') {
    const xpub = cfg.btcXpub ?? cfg.btc_xpub ?? null;
    const threshold = cfg.btcSweepThresholdSats ?? cfg.btc_sweep_threshold_sats ?? null;
    const nextIdx = cfg.btcNextDerivationIndex ?? cfg.btc_next_derivation_index;
    return {
      chainLabel: 'Bitcoin / BTC',
      thresholdLabel: threshold ? formatAssetRaw(threshold, 'bitcoin:BTC') : 'Not configured',
      xpub: xpub ?? 'Not configured',
      xpubShort: truncateXpub(xpub),
      nextDerivationIndex: (nextIdx !== null && nextIdx !== undefined) ? String(nextIdx) : '—',
    };
  }

  if (selectedChain.chainId === 'tron') {
    const xpub = cfg.tronXpub ?? cfg.tron_xpub ?? null;
    const isUsdt = selectedChain.assetId === 'tron:USDT';
    const threshold = isUsdt
      ? null
      : (cfg.tronSweepThresholdSun ?? cfg.tron_sweep_threshold_sun ?? null);
    const nextIdx = cfg.tronNextDerivationIndex ?? cfg.tron_next_derivation_index;
    return {
      chainLabel: isUsdt ? 'TRON / USDT' : 'TRON / TRX',
      thresholdLabel: threshold ? formatAssetRaw(threshold, 'tron:TRX') : 'Not configured',
      xpub: xpub ?? 'Not configured',
      xpubShort: truncateXpub(xpub),
      nextDerivationIndex: (nextIdx !== null && nextIdx !== undefined) ? String(nextIdx) : '—',
    };
  }

  return defaults;
}

// ─── Available chains — derived from tenant config ────────────────────────────

function deriveAvailableChains(cfg) {
  if (!cfg) return [];
  const chains = [];
  const btcXpub = cfg.btcXpub ?? cfg.btc_xpub;
  const tronXpub = cfg.tronXpub ?? cfg.tron_xpub;
  if (btcXpub) {
    chains.push({ chainId: 'bitcoin', assetId: 'bitcoin:BTC', symbol: 'BTC', label: 'BTC' });
  }
  if (tronXpub) {
    chains.push({ chainId: 'tron', assetId: 'tron:TRX',   symbol: 'TRX',  label: 'TRX' });
    chains.push({ chainId: 'tron', assetId: 'tron:USDT',  symbol: 'USDT', label: 'USDT' });
  }
  return chains;
}

// ─── Template ─────────────────────────────────────────────────────────────────

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Sweeps</span>
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

        <!-- No active tenant banner -->
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

          <!-- Chain selector -->
          ${chainSelectorTpl}

          <!-- ── Top row: Config + Current State ── -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-md mb-md">

            <!-- Config card -->
            <div class="glass-card rounded-xl overflow-hidden">
              <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">settings</span>
                <span rv-text="config.chainLabel" class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]"></span>
              </div>
              <div rv-show="configLoading" class="flex justify-center py-lg">
                <div class="w-6 h-6 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
              </div>
              <div rv-hide="configLoading" class="px-md py-sm space-y-sm">
                <div class="flex justify-between items-center py-xs border-b border-white/5">
                  <span class="font-body-sm text-on-surface-variant">Threshold</span>
                  <span rv-text="config.thresholdLabel" class="font-mono-data text-on-surface text-[13px]"></span>
                </div>
                <div class="flex justify-between items-center py-xs">
                  <span class="font-body-sm text-on-surface-variant">xPub</span>
                  <span rv-text="config.xpubShort" rv-attr-title="config.xpub" class="font-mono-data text-on-surface-variant text-[11px] cursor-help"></span>
                </div>
              </div>
            </div>

            <!-- Current state card -->
            <div class="glass-card rounded-xl overflow-hidden">
              <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                <div class="flex items-center gap-sm">
                  <span class="material-symbols-outlined text-on-surface-variant text-[18px]">speed</span>
                  <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Current Sweep State</span>
                </div>
                <button rv-on-click="loadSummary" class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                  <span class="material-symbols-outlined text-[14px]">refresh</span>
                  Refresh
                </button>
              </div>

              <div rv-show="summaryLoading" class="flex justify-center py-lg">
                <div class="w-6 h-6 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
              </div>

              <div rv-hide="summaryLoading" class="px-md py-sm">

                <!-- Pending sweep alert -->
                <div rv-show="summary.hasPending" class="flex items-center gap-sm px-sm py-xs rounded-lg bg-secondary/10 border border-secondary/30 mb-sm">
                  <span class="material-symbols-outlined text-secondary text-[16px]">pending</span>
                  <div>
                    <p class="font-label-md text-secondary text-[12px] font-bold">Awaiting signature</p>
                    <p rv-text="summary.pendingSweepIdShort" class="font-mono-data text-on-surface-variant text-[11px]"></p>
                  </div>
                </div>

                <!-- Progress bar (shown only when threshold is configured) -->
                <div rv-show="summary.hasThreshold" class="mb-sm">
                  <div class="flex justify-between items-end mb-xs">
                    <span class="font-body-sm text-on-surface-variant text-[12px]">Collected</span>
                    <span class="font-mono-data text-on-surface text-[13px] font-bold"><span rv-text="summary.currentFmt"></span> / <span rv-text="summary.thresholdFmt"></span></span>
                  </div>
                  <div class="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div rv-attr-style="summary.progressStyle" class="h-2 rounded-full transition-all duration-500"></div>
                  </div>
                  <div class="flex justify-between items-center mt-xs">
                    <span rv-text="summary.progressPctLabel" class="font-body-sm text-on-surface-variant text-[11px]"></span>
                    <span rv-show="summary.hasGap" class="font-body-sm text-on-surface-variant text-[11px]"><span rv-text="summary.missingFmt"></span> to go</span>
                    <span rv-hide="summary.hasGap" class="font-body-sm text-tertiary text-[11px] font-bold">Threshold reached ✓</span>
                  </div>
                </div>

                <!-- No threshold notice -->
                <div rv-hide="summary.hasThreshold" class="flex items-center gap-sm px-sm py-xs rounded-lg bg-white/5 border border-white/10 mb-sm">
                  <span class="material-symbols-outlined text-on-surface-variant text-[16px]">info</span>
                  <p class="font-body-sm text-on-surface-variant text-[12px]">No sweep threshold configured — go to Tenant Config to set one.</p>
                </div>

                <!-- Stats row -->
                <div class="grid gap-sm mt-sm" rv-attr-class="summary.statsGridClass">
                  <div class="text-center p-sm rounded-lg bg-white/[0.03] border border-white/5">
                    <p rv-text="summary.totalDepositAddresses" class="font-mono-data text-on-surface text-[18px] font-bold"></p>
                    <p class="font-body-sm text-on-surface-variant text-[10px] mt-xs">deposit addresses</p>
                  </div>
                  <div class="text-center p-sm rounded-lg bg-white/[0.03] border border-white/5">
                    <p rv-text="summary.addressesWithBalance" class="font-mono-data text-secondary text-[18px] font-bold"></p>
                    <p class="font-body-sm text-on-surface-variant text-[10px] mt-xs">with balance</p>
                  </div>
                  <div rv-show="summary.showUtxos" class="text-center p-sm rounded-lg bg-white/[0.03] border border-white/5">
                    <p rv-text="summary.totalUtxos" class="font-mono-data text-on-surface text-[18px] font-bold"></p>
                    <p class="font-body-sm text-on-surface-variant text-[10px] mt-xs">UTXOs ready</p>
                  </div>
                </div>

                <!-- Hot wallet destination -->
                <div class="flex justify-between items-center mt-sm pt-sm border-t border-white/5">
                  <span class="font-body-sm text-on-surface-variant text-[11px]">Destination (hot wallet)</span>
                  <span rv-text="summary.hotWalletAddress" rv-attr-title="summary.hotWalletAddressFull" class="font-mono-data text-on-surface-variant text-[11px] cursor-help"></span>
                </div>

              </div>
            </div>

          </div>

          <!-- ── Sweep History ── -->
          <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-error">error</span>
              <span rv-text="error" class="font-body-sm text-error"></span>
            </div>
          </div>

          <div rv-show="loading" class="flex justify-center py-lg">
            <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
          </div>

          ${sweepSearchTpl}

          <div rv-hide="loading" class="glass-card rounded-xl overflow-hidden">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">swap_vert</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Sweep History</span>
              </div>
              <button rv-on-click="load" class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                <span class="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div rv-show="sweepsEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">swap_vert</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No sweeps yet</p>
              <p class="font-body-sm text-on-surface-variant mt-xs">Sweep worker runs automatically when threshold is reached</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="sweepsEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse" style="min-width:960px">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">SWEEP ID</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CHAIN</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">AMOUNT</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">FEE</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">ADDRESSES</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TX HASH</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CREATED</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-sweep="sweeps" class="hover:bg-white/[0.02]">
                    <td class="px-sm py-3">
                      <span rv-text="sweep.idShort" rv-attr-title="sweep.id" class="font-mono-data text-on-surface text-[12px] cursor-help"></span>
                    </td>
                    <td class="px-sm py-3">
                      <span rv-text="sweep.chainLabel" class="font-mono-data text-on-surface-variant text-[11px]"></span>
                    </td>
                    <td class="px-sm py-3">
                      <span rv-text="sweep.statusLabel" rv-attr-class="sweep.statusBadgeClass"></span>
                    </td>
                    <td rv-text="sweep.amountFmt"   class="px-sm py-3 font-mono-data text-on-surface text-right text-[12px]"></td>
                    <td rv-text="sweep.feeFmt"      class="px-sm py-3 font-mono-data text-on-surface-variant text-right text-[12px]"></td>
                    <td rv-text="sweep.addressCount" class="px-sm py-3 font-mono-data text-on-surface-variant text-right text-[12px]"></td>
                    <td class="px-sm py-3">
                      <span rv-text="sweep.txHashShort" rv-attr-title="sweep.txHash" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td rv-text="sweep.createdAt"  class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="sweepsEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-sweep="sweeps" class="px-md py-3">
                <div class="flex items-start justify-between mb-xs">
                  <div>
                    <p rv-text="sweep.idShort" class="font-mono-data text-on-surface text-[12px]"></p>
                    <p rv-text="sweep.chainLabel" class="font-mono-data text-on-surface-variant text-[10px]"></p>
                  </div>
                  <span rv-text="sweep.statusLabel" rv-attr-class="sweep.statusBadgeClass"></span>
                </div>
                <p class="font-mono-data text-on-surface-variant text-[11px] mb-xs"><span rv-text="sweep.txHashShort"></span></p>
                <div class="grid grid-cols-2 gap-xs text-[11px]">
                  <span class="text-on-surface-variant">Amount: <span rv-text="sweep.amountFmt" class="font-mono-data text-on-surface"></span></span>
                  <span class="text-on-surface-variant">Fee: <span rv-text="sweep.feeFmt" class="font-mono-data text-on-surface"></span></span>
                  <span class="text-on-surface-variant">Addresses: <span rv-text="sweep.addressCount" class="font-mono-data text-on-surface"></span></span>
                </div>
                <p rv-text="sweep.createdAt" class="font-mono-data text-on-surface-variant text-[11px] mt-xs"></p>
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

// ─── Controller ───────────────────────────────────────────────────────────────

export function createController({ api, router }) {
  const self = {
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'Sweeps',
      breadcrumb: 'Sweeps',
      onBack: () => router.navigate('#/tenants'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    summaryLoading: false,
    configLoading: false,
    error: null,

    sweeps: [],
    sweepsEmpty: true,
    summary: normalizeSummary(null),
    config: normalizeConfig(null, null),

    _selectedChainId: 'bitcoin',
    _selectedAssetId: 'bitcoin:BTC',
    _availableChains: [],

    chainSelector: createSweepChainSelectorController({
      chains: [],
      onSelect(chainId, assetId) {
        self._selectedChainId = chainId;
        self._selectedAssetId = assetId;
        self._cursor = undefined;
        self._prevCursors = [];
        self.loadSummary();
        self.load();
      },
    }),

    _activeFilters: {},
    _cursor: undefined,
    _prevCursors: [],
    _nextCursor: undefined,
    pagination: createPaginationController({ page: 1, total: 0, onPageChange: () => {} }),

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },

    async loadSummary() {
      self.summaryLoading = true;
      try {
        const data = await api.getSweepsSummary(self._selectedChainId, self._selectedAssetId);
        self.summary = normalizeSummary(data);
      } catch (_e) {
        // non-fatal — summary card stays in default state
      } finally {
        self.summaryLoading = false;
      }
    },

    async loadConfig() {
      self.configLoading = true;
      try {
        const cfg = await api.getActiveTenantConfig();
        self._availableChains = deriveAvailableChains(cfg);

        self.chainSelector = createSweepChainSelectorController({
          chains: self._availableChains,
          onSelect(chainId, assetId) {
            self._selectedChainId = chainId;
            self._selectedAssetId = assetId;
            self._cursor = undefined;
            self._prevCursors = [];
            self.loadSummary();
            self.load();
          },
        });

        const first = self._availableChains[0];
        if (first) {
          self.chainSelector.init(first.chainId, first.assetId);
          self._selectedChainId = first.chainId;
          self._selectedAssetId = first.assetId;
        }

        const selectedChain = self._availableChains.find(
          c => c.chainId === self._selectedChainId && c.assetId === self._selectedAssetId
        ) ?? (self._availableChains[0] ?? null);

        self.config = normalizeConfig(cfg, selectedChain);
      } catch (_e) {
        self.config = normalizeConfig(null, null);
      } finally {
        self.configLoading = false;
      }
    },

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const res = await api.getSweeps({
          limit: LIMIT,
          cursor: self._cursor,
          chainId: self._selectedChainId,
          assetId: self._selectedAssetId,
          ...self._activeFilters,
        });
        const items = res.data || res || [];
        self._nextCursor = res.pagination?.nextCursor || undefined;
        self.sweeps = (Array.isArray(items) ? items : []).map(normalizeSweep);
        self.sweepsEmpty = self.sweeps.length === 0;
        const currentPage = self._prevCursors.length + 1;
        self.pagination = createPaginationController({
          page: currentPage,
          total: self._nextCursor
            ? currentPage * LIMIT + 1
            : (currentPage - 1) * LIMIT + self.sweeps.length,
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
      if (!self.noActiveTenant) {
        self.loadConfig().then(() => {
          self.loadSummary();
          self.load();
        });
      }
    },
  };

  self.sweepSearchForm = createSweepSearchFormController({
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

export const SweepsView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
