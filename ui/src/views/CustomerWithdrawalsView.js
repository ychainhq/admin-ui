import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { template as paginationTpl, createPaginationController } from '../components/Pagination.js';
import { template as withdrawalHistorySearchTpl, createWithdrawalHistorySearchFormController } from '../components/WithdrawalHistorySearchForm.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { template as headerTpl, createCustomerDetailHeaderController } from '../components/CustomerDetailHeader.js';
import { getActiveTenantKey } from '../api.js';
import { getConfirmedBitcoinBalance } from '../balanceHelpers.js';

const ROUTE = '/customers';
const ACTIVE_TAB = 'withdrawals';

// P2WPKH estimate: 10 overhead + 41*inputs + 31*outputs (1 input assumed for small batches)
const ESTIMATED_VSIZE_1IN_2OUT = 10 + 41 * 1 + 31 * 2; // ~113 vB

async function safeLoad(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.message?.startsWith('HTTP 404') || e.message?.toLowerCase().includes('not found')) return null;
    throw e;
  }
}

function fmtDate(v) {
  if (!v) return '—';
  // backend returns unix timestamp (seconds)
  const ms = typeof v === 'number' ? v * 1000 : new Date(v).getTime();
  if (isNaN(ms)) return '—';
  try { return new Date(ms).toISOString().slice(0, 16).replace('T', ' '); } catch { return '—'; }
}

const WD_STATUS_BADGE = {
  queued:    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-on-surface-variant border border-white/20',
  batched:   'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  broadcast: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  confirmed: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/30',
  failed:    'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
  cancelled: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-on-surface-variant border border-white/10',
};

const WD_TYPE_BADGE_CLASS = 'inline-flex items-center gap-[3px] px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary/15 text-secondary border border-secondary/25';

function normalizeWithdrawal(w) {
  const status = w.status || '';
  const txHash = w.tx_hash || w.txHash || '';
  const isInternal = (w.withdrawal_type || 'external') === 'internal';
  const isFailed = status === 'failed';
  const errorCode = (isFailed && w.error) ? w.error : '';
  const toAddress = w.to_address || w.toAddress || '—';
  const wd = {
    id:           w.id || '—',
    statusLabel:  status.toUpperCase().replace(/_/g, ' '),
    statusBadgeClass: WD_STATUS_BADGE[status] || WD_STATUS_BADGE.queued,
    isFailed,
    errorCode,
    isInternal,
    typeBadgeClass: WD_TYPE_BADGE_CLASS,
    toAddress,
    toAddressShort: toAddress.slice(0, 12) + (toAddress.length > 12 ? '…' : ''),
    showFullAddress: false,
    // eslint-disable-next-line no-use-before-define
    toggleAddress: null,
    amountRaw:    w.amount_raw || w.amountRaw || '—',
    feeRaw:       w.fee_raw ?? w.feeRaw ?? '—',
    txHash,
    txHashShort:  txHash.length > 16 ? txHash.slice(0, 8) + '…' + txHash.slice(-6) : (txHash || '—'),
    createdAt:    fmtDate(w.created_at || w.createdAt),
  };
  wd.toggleAddress = (e) => { e?.preventDefault(); wd.showFullAddress = !wd.showFullAddress; };
  return wd;
}

const FEE_COVERAGE_LABELS = {
  tenant_pays:    { label: 'Platform pays fee', icon: 'shield', desc: 'Network fee is covered by the platform. The recipient gets the full amount you specify.' },
  sender_pays:    { label: 'You pay fee', icon: 'account_balance_wallet', desc: 'Network fee is added on top of your withdrawal amount. Your balance will be debited amount + fee.' },
  recipient_pays: { label: 'Recipient pays fee', icon: 'call_received', desc: 'Network fee is deducted from the transferred amount. The recipient will receive amount − fee.' },
};

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomers" href="#" class="text-on-surface-variant hover:text-on-surface transition-colors">Customers</a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomer" href="#" rv-text="header.customerId" class="text-on-surface font-semibold hover:text-secondary transition-colors"></a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Withdrawals</span>
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

          <!-- New Withdrawal form -->
          <div class="glass-card rounded-xl overflow-hidden mb-md">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
              <span class="material-symbols-outlined text-on-surface-variant text-[18px]">arrow_upward</span>
              <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">New Withdrawal</span>
            </div>
            <div class="p-md space-y-sm">

              <div rv-show="form.error" class="flex items-center gap-sm text-error">
                <span class="material-symbols-outlined text-[16px]">error</span>
                <span rv-text="form.error" class="font-body-sm"></span>
              </div>
              <div rv-show="form.success" class="flex items-center gap-sm text-tertiary">
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                <span rv-text="form.success" class="font-body-sm font-semibold"></span>
              </div>

              <!-- Fee policy info banner -->
              <div class="flex items-start gap-sm p-sm rounded-lg bg-white/[0.04] border border-white/10">
                <span rv-text="feeCoverageIcon" class="material-symbols-outlined text-secondary text-[18px] shrink-0 mt-[1px]"></span>
                <div>
                  <p class="font-label-md text-secondary font-semibold text-[12px]" rv-text="feeCoverageLabel"></p>
                  <p class="font-body-sm text-on-surface-variant text-[11px] mt-[2px]" rv-text="feeCoverageDesc"></p>
                </div>
              </div>

              <div>
                <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Destination Address</label>
                <div class="relative">
                  <input rv-on-input="form.onAddressInput"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 pr-8 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
                    type="text" placeholder="bcrt1q…" autocomplete="off" />
                  <span rv-show="form.resolving"
                    class="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-secondary border-t-transparent animate-spin"></span>
                </div>
              </div>

              <!-- Internal transfer detection banner -->
              <div rv-show="form.isInternalAddress" class="rounded-xl border overflow-hidden">
                <!-- Header -->
                <div class="flex items-center gap-sm px-sm py-xs bg-secondary/10 border-b border-secondary/20">
                  <span class="material-symbols-outlined text-secondary text-[16px]">bolt</span>
                  <span class="font-label-md text-secondary text-[12px] font-semibold">Platform address detected — choose transfer mode</span>
                </div>
                <!-- Options -->
                <div class="grid grid-cols-2 divide-x divide-white/10">
                  <!-- Internal (default) -->
                  <button rv-on-click="form.setPreferExternalFalse"
                    class="flex flex-col items-center gap-xs px-sm py-sm transition-all"
                    rv-attr-class="form.internalBtnClass">
                    <span class="material-symbols-outlined text-[20px]">bolt</span>
                    <span class="font-label-md text-[11px] font-bold">Internal transfer</span>
                    <span class="font-body-sm text-[10px] text-center opacity-70">Instant · no fee · ledger only</span>
                  </button>
                  <!-- Blockchain -->
                  <button rv-on-click="form.setPreferExternalTrue"
                    class="flex flex-col items-center gap-xs px-sm py-sm transition-all"
                    rv-attr-class="form.externalBtnClass">
                    <span class="material-symbols-outlined text-[20px]">link</span>
                    <span class="font-label-md text-[11px] font-bold">On-chain transfer</span>
                    <span class="font-body-sm text-[10px] text-center opacity-70">Batched · network fee applies</span>
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-sm">
                <div>
                  <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Amount (satoshi)</label>
                  <input rv-on-input="form.onAmountInput"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
                    type="text" placeholder="90000" autocomplete="off" />
                </div>
                <div>
                  <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Balance</label>
                  <div class="w-full min-h-[38px] bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] flex items-center justify-between gap-xs">
                    <span rv-show="balance.loading" class="text-on-surface-variant">Loading...</span>
                    <span rv-hide="balance.loading" rv-text="balance.confirmedSatsLabel"></span>
                    <span class="material-symbols-outlined text-on-surface-variant text-[15px] shrink-0">verified</span>
                  </div>
                  <p rv-hide="balance.loading" rv-text="balance.confirmedBtcLabel" class="font-mono-data text-[10px] text-on-surface-variant mt-xs"></p>
                  <p rv-show="balance.error" rv-text="balance.error" class="font-body-sm text-[10px] text-error mt-xs"></p>
                </div>
                <div>
                  <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Note (optional)</label>
                  <input rv-on-input="form.onNoteInput"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-body-sm focus:ring-1 focus:ring-secondary transition-all outline-none"
                    type="text" placeholder="Test withdrawal" autocomplete="off" />
                </div>
              </div>

              <!-- Fee estimate panel -->
              <div rv-show="feeEstimate.visible" class="rounded-lg bg-white/[0.04] border border-white/10 p-sm text-[12px] space-y-xs">
                <div class="flex items-center justify-between">
                  <span class="text-on-surface-variant">Est. network fee</span>
                  <span rv-text="feeEstimate.feeSats" class="font-mono-data text-on-surface font-semibold"></span>
                </div>
                <div rv-show="feeEstimate.showDebit" class="flex items-center justify-between border-t border-white/5 pt-xs">
                  <span class="text-on-surface-variant" rv-text="feeEstimate.debitLabel"></span>
                  <span rv-text="feeEstimate.debitAmount" class="font-mono-data text-secondary font-semibold"></span>
                </div>
                <div rv-show="feeEstimate.showRecipient" class="flex items-center justify-between border-t border-white/5 pt-xs">
                  <span class="text-on-surface-variant">Recipient receives</span>
                  <span rv-text="feeEstimate.recipientAmount" class="font-mono-data text-tertiary font-semibold"></span>
                </div>
                <p class="text-on-surface-variant text-[10px] pt-xs border-t border-white/5">Rate: <span rv-text="feeEstimate.rateLabel" class="font-mono-data"></span> · Estimate only — actual fee set at batch time</p>
              </div>

              <button rv-on-click="form.submit" rv-attr-disabled="form.loading"
                class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
                <span rv-text="form.submitIcon" class="material-symbols-outlined text-[18px]"></span>
                <span rv-hide="form.loading" rv-text="form.submitLabel"></span>
                <span rv-show="form.loading">Submitting…</span>
              </button>
            </div>
          </div>

          <!-- Error state -->
          <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-error">error</span>
              <span rv-text="error" class="font-body-sm text-error"></span>
            </div>
          </div>

          <!-- Loading -->
          <div rv-show="loading" class="flex justify-center py-lg">
            <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
          </div>

          ${withdrawalHistorySearchTpl}

          <!-- Withdrawals list -->
          <div rv-hide="loading" class="glass-card rounded-xl overflow-hidden mb-md">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">receipt_long</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Withdrawal History</span>
              </div>
              <button rv-on-click="loadWithdrawals" class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                <span class="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div rv-show="withdrawalsEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">inbox</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No withdrawals yet</p>
              <p class="font-body-sm text-on-surface-variant mt-xs">Submitted withdrawals will appear here</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="withdrawalsEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TYPE</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TO ADDRESS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">AMOUNT (sats)</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider text-right">FEE (sats)</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TX HASH</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CREATED</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-wd="withdrawals" class="hover:bg-white/[0.02]">
                    <td class="px-md py-3">
                      <span rv-text="wd.statusLabel" rv-attr-class="wd.statusBadgeClass"></span>
                      <div rv-show="wd.isFailed" class="mt-[3px] flex items-center gap-[3px] text-error/70 text-[10px] font-mono-data">
                        <span class="material-symbols-outlined text-[11px]">report</span>
                        <span rv-text="wd.errorCode"></span>
                      </div>
                    </td>
                    <td class="px-md py-3">
                      <span rv-show="wd.isInternal" rv-attr-class="wd.typeBadgeClass">
                        <span class="material-symbols-outlined text-[11px]">bolt</span>
                        Internal
                      </span>
                      <span rv-hide="wd.isInternal" class="text-on-surface-variant text-[11px] font-mono-data">On-chain</span>
                    </td>
                    <td class="px-md py-3">
                      <button rv-on-click="wd.toggleAddress" class="text-left">
                        <span rv-hide="wd.showFullAddress" class="font-mono-data text-on-surface-variant text-[12px] underline decoration-dashed decoration-white/30 hover:text-on-surface transition-colors" rv-text="wd.toAddressShort"></span>
                        <span rv-show="wd.showFullAddress" class="font-mono-data text-on-surface text-[11px] break-all block max-w-[220px]" rv-text="wd.toAddress"></span>
                      </button>
                    </td>
                    <td rv-text="wd.amountRaw" class="px-md py-3 font-mono-data text-on-surface text-right text-[12px]"></td>
                    <td rv-text="wd.feeRaw"    class="px-md py-3 font-mono-data text-on-surface-variant text-right text-[12px]"></td>
                    <td class="px-md py-3">
                      <span rv-text="wd.txHashShort" rv-attr-title="wd.txHash" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td rv-text="wd.createdAt" class="px-md py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="withdrawalsEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-wd="withdrawals" class="px-md py-3">
                <div class="flex items-start justify-between mb-xs">
                  <button rv-on-click="wd.toggleAddress" class="text-left mr-sm">
                    <span rv-hide="wd.showFullAddress" class="font-mono-data text-on-surface text-[12px] underline decoration-dashed decoration-white/30" rv-text="wd.toAddressShort"></span>
                    <span rv-show="wd.showFullAddress" class="font-mono-data text-on-surface text-[11px] break-all block" rv-text="wd.toAddress"></span>
                  </button>
                  <div class="flex flex-col items-end gap-[2px]">
                    <span rv-text="wd.statusLabel" rv-attr-class="wd.statusBadgeClass"></span>
                    <div rv-show="wd.isFailed" class="flex items-center gap-[3px] text-error/70 text-[10px] font-mono-data">
                      <span class="material-symbols-outlined text-[11px]">report</span>
                      <span rv-text="wd.errorCode"></span>
                    </div>
                  </div>
                </div>
                <div class="flex gap-md mt-xs text-[11px]">
                  <span class="text-on-surface-variant">Amount: <span rv-text="wd.amountRaw" class="font-mono-data text-on-surface"></span> sats</span>
                  <span class="text-on-surface-variant">Fee: <span rv-text="wd.feeRaw" class="font-mono-data text-on-surface"></span></span>
                </div>
                <p rv-text="wd.createdAt" class="font-mono-data text-on-surface-variant text-[11px] mt-xs"></p>
              </div>
            </div>

            <!-- Pagination -->
            <div rv-hide="withdrawalsEmpty" class="border-t border-white/5">
              ${paginationTpl}
            </div>
          </div>

          <!-- Info: see batches (hidden for internal transfers) -->
          <div rv-hide="loading" rv-hide="lastWithdrawalWasInternal" class="glass-card rounded-xl p-md flex items-start gap-sm">
            <span class="material-symbols-outlined text-on-surface-variant shrink-0 mt-xs text-[18px]">info</span>
            <p class="font-body-sm text-on-surface-variant">
              After submitting, the withdrawal enters a batch (batcher runs every 30s).
              Track batch progress in
              <a rv-on-click="goToBatches" href="#" class="text-secondary underline hover:brightness-110">Withdrawal Batches</a>.
            </p>
          </div>

          <!-- Info: internal transfer completed -->
          <div rv-show="lastWithdrawalWasInternal" class="glass-card rounded-xl p-md flex items-start gap-sm bg-secondary/5 border border-secondary/20">
            <span class="material-symbols-outlined text-secondary shrink-0 mt-xs text-[18px]">bolt</span>
            <p class="font-body-sm text-on-surface-variant">
              Last transfer was <strong class="text-secondary">on-platform</strong> — settled instantly on the ledger.
              No blockchain transaction, no network fee.
            </p>
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
      title: 'Withdrawals',
      breadcrumb: 'Customers > Withdrawals',
      onBack: () => router.navigate('#/customers'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    error: null,
    lastWithdrawalWasInternal: false,

    // Fee coverage (loaded from tenant batch config)
    feeCoverageIcon:  'shield',
    feeCoverageLabel: 'Platform pays fee',
    feeCoverageDesc:  'Network fee is covered by the platform. The recipient gets the full amount you specify.',
    _feeCoverage:     'tenant_pays',
    _feeRateNormal:   2, // sat/vB fallback

    // Fee estimate panel
    feeEstimate: {
      visible:         false,
      feeSats:         '—',
      rateLabel:       '—',
      showDebit:       false,
      debitLabel:      'Total deducted from balance',
      debitAmount:     '—',
      showRecipient:   false,
      recipientAmount: '—',
    },

    balance: {
      loading: false,
      error: null,
      confirmedSats: null,
      confirmedSatsLabel: 'Unavailable',
      confirmedBtcLabel: '—',
    },

    // Withdrawals list
    withdrawals:     [],
    withdrawalsEmpty: true,
    pagination: createPaginationController({ page: 1, total: 0, perPage: 20, onPageChange: () => {} }),
    _activeFilters: {},
    _withdrawalCursor: undefined,
    _withdrawalPrevCursors: [],
    _withdrawalNextCursor: undefined,

    header: createCustomerDetailHeaderController({
      customerId: id,
      activeTab: ACTIVE_TAB,
      router,
      onDisable: () => self.disableCustomer(),
    }),

    form: {
      address: '',
      amount: '',
      note: '',
      loading: false,
      error: null,
      success: null,
      // Address resolution state
      resolving: false,
      isInternalAddress: false,
      preferExternal: false,
      submitLabel: 'Submit Withdrawal',
      submitIcon: 'send',
      internalBtnClass: '',
      externalBtnClass: '',
      _resolveTimer: null,
      _updateModeUI() {
        const isInt = self.form.isInternalAddress;
        const prefExt = self.form.preferExternal;
        const activeClass = 'flex flex-col items-center gap-xs px-sm py-sm transition-all bg-secondary/15 text-secondary';
        const inactiveClass = 'flex flex-col items-center gap-xs px-sm py-sm transition-all text-on-surface-variant hover:bg-white/5';
        self.form.internalBtnClass = (!prefExt) ? activeClass : inactiveClass;
        self.form.externalBtnClass = prefExt ? activeClass : inactiveClass;
        if (isInt && !prefExt) {
          self.form.submitLabel = 'Send Internal Transfer';
          self.form.submitIcon = 'bolt';
        } else if (isInt && prefExt) {
          self.form.submitLabel = 'Submit On-chain Withdrawal';
          self.form.submitIcon = 'send';
        } else {
          self.form.submitLabel = 'Submit Withdrawal';
          self.form.submitIcon = 'send';
        }
      },
      onAddressInput(e) {
        self.form.address = e.target.value;
        self.form.isInternalAddress = false;
        self.form.preferExternal = false;
        self.form._updateModeUI();
        clearTimeout(self.form._resolveTimer);
        const addr = e.target.value.trim();
        if (!addr) { self.form.resolving = false; return; }
        self.form.resolving = true;
        self.form._resolveTimer = setTimeout(async () => {
          try {
            const session = await api.createCustomerSession(id);
            const token = session.accessToken || session.token || session.sessionToken;
            if (!token) throw new Error('No session token');
            const result = await api.resolveAddressAsCustomer(token, addr);
            self.form.isInternalAddress = !!result.isInternal;
          } catch { self.form.isInternalAddress = false; }
          finally { self.form.resolving = false; }
          self.form._updateModeUI();
          self._updateFeeEstimate();
        }, 600);
      },
      setPreferExternalFalse(e) {
        e?.preventDefault();
        self.form.preferExternal = false;
        self.form._updateModeUI();
        self._updateFeeEstimate();
      },
      setPreferExternalTrue(e) {
        e?.preventDefault();
        self.form.preferExternal = true;
        self.form._updateModeUI();
        self._updateFeeEstimate();
      },
      onAmountInput(e) {
        self.form.amount = e.target.value;
        self._updateFeeEstimate();
      },
      onNoteInput(e) { self.form.note = e.target.value; },
      async submit() {
        self.form.error = null;
        self.form.success = null;

        const address = self.form.address.trim();
        const amountStr = self.form.amount.trim();

        if (!address) { self.form.error = 'Destination address is required'; return; }
        if (!amountStr) { self.form.error = 'Amount is required'; return; }
        try {
          if (BigInt(amountStr) <= 0n) throw new Error('Amount must be > 0');
        } catch {
          self.form.error = 'Amount must be a valid positive integer (satoshi)';
          return;
        }

        self.form.loading = true;
        try {
          const session = await api.createCustomerSession(id);
          const token = session.accessToken || session.token || session.sessionToken;
          if (!token) throw new Error('No session token returned');

          const forceExternal = self.form.isInternalAddress && self.form.preferExternal;
          const result = await api.createWithdrawalAsCustomer(token, {
            chain: 'bitcoin',
            assetId: 'bitcoin:BTC',
            amountSats: amountStr,
            toAddress: address,
            note: self.form.note.trim() || undefined,
            forceExternal: forceExternal || undefined,
          });

          const isInternal = (result.withdrawal_type || result.withdrawalType) === 'internal';
          self.form.success = isInternal
            ? `Internal transfer completed instantly — ${result.id || 'OK'} (no blockchain fee)`
            : `Withdrawal ${result.id || 'OK'} queued — enters batch in ~30s`;
          self.lastWithdrawalWasInternal = isInternal;
          self.form.address = '';
          self.form.amount = '';
          self.form.note = '';
          self.form.isInternalAddress = false;
          self.form.preferExternal = false;
          self.feeEstimate.visible = false;
          // Reload withdrawal list and confirmed balance.
          self.loadWithdrawals();
          await self.loadBalance(token);
        } catch (e) {
          self.form.error = e.message;
        } finally {
          self.form.loading = false;
        }
      },
    },

    _updateFeeEstimate() {
      const amountStr = self.form.amount.trim();
      let amount = 0n;
      try { amount = BigInt(amountStr); } catch { /* invalid input */ }

      const willBeInternal = self.form.isInternalAddress && !self.form.preferExternal;
      if (amount <= 0n || willBeInternal) {
        self.feeEstimate.visible = false;
        return;
      }

      const feeRate = self._feeRateNormal;
      const estimatedFee = BigInt(Math.ceil(ESTIMATED_VSIZE_1IN_2OUT * feeRate));

      self.feeEstimate.visible = true;
      self.feeEstimate.feeSats = estimatedFee.toString() + ' sats';
      self.feeEstimate.rateLabel = `~${feeRate} sat/vB (normal priority) · ~${ESTIMATED_VSIZE_1IN_2OUT} vB`;

      const coverage = self._feeCoverage;
      self.feeEstimate.showDebit = coverage === 'sender_pays';
      self.feeEstimate.showRecipient = coverage === 'recipient_pays';

      if (coverage === 'sender_pays') {
        self.feeEstimate.debitLabel = 'Total deducted from your balance';
        self.feeEstimate.debitAmount = (amount + estimatedFee).toString() + ' sats';
      } else if (coverage === 'recipient_pays') {
        const recipientGets = amount - estimatedFee;
        self.feeEstimate.recipientAmount = (recipientGets > 0n ? recipientGets : 0n).toString() + ' sats';
      }
    },

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },
    goToCustomers(e) { e?.preventDefault(); router.navigate('#/customers'); },
    goToCustomer(e) { e?.preventDefault(); router.navigate(`#/customers/${encodeURIComponent(id)}/profile`); },
    goToBatches(e) { e?.preventDefault(); router.navigate('#/withdrawal-batches'); },

    _applyBalanceData(balancesData) {
      const confirmed = getConfirmedBitcoinBalance(balancesData);
      self.balance.confirmedSats = confirmed.confirmedSats;
      self.balance.confirmedSatsLabel = confirmed.confirmedSatsLabel;
      self.balance.confirmedBtcLabel = confirmed.confirmedBtcLabel;
    },

    async loadBalance(sessionToken) {
      self.balance.loading = true;
      self.balance.error = null;
      try {
        let token = sessionToken;
        if (!token) {
          const session = await api.createCustomerSession(id);
          token = session.accessToken || session.token || session.sessionToken;
        }
        if (!token) throw new Error('No customer session token');
        const balancesData = await api.getCustomerBalances(token);
        self._applyBalanceData(balancesData);
      } catch {
        self.balance.confirmedSats = null;
        self.balance.confirmedSatsLabel = 'Unavailable';
        self.balance.confirmedBtcLabel = '—';
        self.balance.error = 'Balance unavailable';
      } finally {
        self.balance.loading = false;
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

    async loadWithdrawals() {
      try {
        const session = await api.createCustomerSession(id);
        const token = session.accessToken || session.token || session.sessionToken;
        if (!token) throw new Error('No customer session token');
        const res = await api.getCustomerWithdrawals(token, {
          limit: 20,
          cursor: self._withdrawalCursor,
          ...self._activeFilters,
        });
        const items = res.data || [];
        self._withdrawalNextCursor = res.pagination?.nextCursor || undefined;
        self.withdrawals = (Array.isArray(items) ? items : []).map(normalizeWithdrawal);
        self.withdrawalsEmpty = self.withdrawals.length === 0;
        const currentPage = self._withdrawalPrevCursors.length + 1;
        self.pagination = createPaginationController({
          page: currentPage,
          perPage: 20,
          total: self._withdrawalNextCursor
            ? currentPage * 20 + 1
            : (currentPage - 1) * 20 + self.withdrawals.length,
          onPageChange(p) {
            if (p > currentPage && self._withdrawalNextCursor) {
              self._withdrawalPrevCursors.push(self._withdrawalCursor);
              self._withdrawalCursor = self._withdrawalNextCursor;
              self.loadWithdrawals();
            } else if (p < currentPage && self._withdrawalPrevCursors.length > 0) {
              self._withdrawalCursor = self._withdrawalPrevCursors.pop();
              self.loadWithdrawals();
            }
          },
        });
      } catch (e) {
        // non-fatal — list stays empty
      }
    },

    async load() {
      self.loading = true;
      self.balance.loading = true;
      self.balance.error = null;
      self.error = null;
      try {
        const session = await api.createCustomerSession(id);
        const sessionToken = session.accessToken || session.token || session.sessionToken;
        const [customer, balancesData, profileData, contactData] = await Promise.all([
          api.getCustomer(id),                                  // tenant API — admin record
          api.getCustomerBalances(sessionToken).catch(() => null), // /customer/me/balances
          safeLoad(() => api.getMyProfile(sessionToken)),       // /customer/me/profile
          safeLoad(() => api.getMyContact(sessionToken)),       // /customer/me/contact
        ]);
        self.header.setCustomer(customer);
        self.header.setProfile(profileData);
        self.header.setContact(contactData);
        if (balancesData) {
          self._applyBalanceData(balancesData);
        } else {
          self.balance.confirmedSats = null;
          self.balance.confirmedSatsLabel = 'Unavailable';
          self.balance.confirmedBtcLabel = '—';
          self.balance.error = 'Balance unavailable';
        }
      } catch (e) {
        self.error = e.message;
      } finally {
        self.loading = false;
        self.balance.loading = false;
      }

      // Load fee config and fees in parallel, non-blocking
      Promise.all([
        safeLoad(() => api.getWithdrawalBatchConfig()),
        safeLoad(() => api.getBitcoinFees()),
      ]).then(([batchCfg, fees]) => {
        if (batchCfg?.withdrawal_fee_coverage) {
          self._feeCoverage = batchCfg.withdrawal_fee_coverage;
          const info = FEE_COVERAGE_LABELS[self._feeCoverage] || FEE_COVERAGE_LABELS['tenant_pays'];
          self.feeCoverageIcon = info.icon;
          self.feeCoverageLabel = info.label;
          self.feeCoverageDesc = info.desc;
        }
        if (fees?.data?.feeRates?.normal?.feeRate) {
          self._feeRateNormal = fees.data.feeRates.normal.feeRate;
        }
      }).catch(() => {});

      self.loadWithdrawals();
    },

    init() {
      self.form._updateModeUI();
      if (!self.noActiveTenant) self.load();
    },
  };

  self.withdrawalHistorySearchForm = createWithdrawalHistorySearchFormController({
    onSearch(filters) {
      self._activeFilters = filters;
      self._withdrawalCursor = undefined;
      self._withdrawalPrevCursors = [];
      self.loadWithdrawals();
    },
    onClear() {
      self._activeFilters = {};
      self._withdrawalCursor = undefined;
      self._withdrawalPrevCursors = [];
      self.loadWithdrawals();
    },
  });

  return self;
}

export const CustomerWithdrawalsView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router, id: params.id });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
