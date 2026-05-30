import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { getActiveTenantKey } from '../api.js';
import { template as paginationTpl, createPaginationController } from '../components/Pagination.js';
import { template as signingTaskSearchTpl, createSigningTaskSearchFormController } from '../components/SigningTaskSearchForm.js';

const ROUTE = '/signing-tasks';

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 16).replace('T', ' '); } catch { return '—'; }
}

const NEUTRAL = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-on-surface-variant border border-white/20';
const ACTIVE  = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20';
const DONE    = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20';
const ERROR   = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20';
const DIM     = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-on-surface-variant border border-white/10';

const STATUS_BADGE = {
  created:          NEUTRAL,
  pending_approval: ACTIVE,
  approved:         ACTIVE,
  available:        ACTIVE,
  claimed:          ACTIVE,
  signing:          ACTIVE,
  signed:           DONE,
  submitted:        DONE,
  rejected:         ERROR,
  failed:           ERROR,
  expired:          DIM,
  cancelled:        DIM,
};

function taskStatusBadge(status) {
  return STATUS_BADGE[status] || NEUTRAL;
}

function shortHash(h) {
  if (!h) return '—';
  return h.length > 20 ? h.slice(0, 8) + '…' + h.slice(-6) : h;
}

function fmtSats(v) {
  if (!v) return '—';
  try { return BigInt(v).toLocaleString() + ' sat'; } catch { return v + ' sat'; }
}

function normalizeTask(t) {
  const status = t.status || '';
  const fp = t.signer_fingerprint || '';
  return {
    id:                  t.id || '—',
    idShort:             shortHash(t.id),
    requestType:         (t.request_type || '—').replace(/_/g, ' ').toUpperCase(),
    statusLabel:         status.replace(/_/g, ' ').toUpperCase(),
    statusBadgeClass:    taskStatusBadge(status),
    decisionMode:        (t.decision_mode || '—').toUpperCase(),
    decisionReason:      t.decision_reason || '',
    amountSats:          fmtSats(t.amount_raw),
    feeSats:             fmtSats(t.fee_raw),
    feeRate:             t.fee_rate_sat_vb ? t.fee_rate_sat_vb + ' sat/vB' : '—',
    signerName:          t.signer_name || t.external_signer_id || '—',
    signerFp:            fp ? shortHash(fp) : '—',
    signerFpFull:        fp,
    txHash:              shortHash(t.tx_hash),
    txHashFull:          t.tx_hash || '',
    rejectionReason:     t.rejection_reason_message || '',
    failureMessage:      t.failure_message || '',
    createdAt:           fmtDate(t.created_at),
    expiresAt:           fmtDate(t.expires_at),
    claimedAt:           fmtDate(t.claimed_at),
    signedAt:            fmtDate(t.signed_at),
    submittedAt:         fmtDate(t.submitted_at),
    hasError:            !!(t.rejection_reason_message || t.failure_message),
    isPendingApproval:   status === 'pending_approval',
  };
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Signing Tasks</span>
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

          ${signingTaskSearchTpl}

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
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">task_alt</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Signing Tasks</span>
              </div>
              <button rv-on-click="load" class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                <span class="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div rv-show="tasksEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">task_alt</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No signing tasks</p>
              <p class="font-body-sm text-on-surface-variant mt-xs">Tasks are created when a withdrawal batch or sweep needs signing</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="tasksEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse" style="min-width:1100px">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TASK ID</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TYPE</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">DECISION</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">AMOUNT</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">SIGNER FP</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TX HASH</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CREATED</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody rv-each-task="tasks" class="divide-y divide-white/5">
                  <tr class="hover:bg-white/[0.02]">
                    <td class="px-sm py-3">
                      <span rv-text="task.idShort" rv-attr-title="task.id" class="font-mono-data text-on-surface text-[12px] cursor-help"></span>
                    </td>
                    <td rv-text="task.requestType"    class="px-sm py-3 font-body-sm text-on-surface-variant text-[12px] whitespace-nowrap"></td>
                    <td class="px-sm py-3">
                      <span rv-text="task.statusLabel" rv-attr-class="task.statusBadgeClass" class="whitespace-nowrap"></span>
                    </td>
                    <td class="px-sm py-3">
                      <span rv-text="task.decisionMode" class="font-mono-data text-on-surface-variant text-[11px]"></span>
                      <p rv-show="task.decisionReason" rv-text="task.decisionReason" class="font-body-sm text-on-surface-variant text-[10px] mt-0.5 opacity-60"></p>
                    </td>
                    <td rv-text="task.amountSats"      class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px] whitespace-nowrap"></td>
                    <td class="px-sm py-3">
                      <span rv-text="task.signerFp" rv-attr-title="task.signerFpFull" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td class="px-sm py-3">
                      <span rv-text="task.txHash" rv-attr-title="task.txHashFull" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td rv-text="task.createdAt"       class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px] whitespace-nowrap"></td>
                    <td class="px-sm py-3">
                      <div rv-show="task.isPendingApproval" class="flex gap-xs">
                        <button rv-on-click="task.confirmApprove" class="px-2 py-1 rounded text-[11px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/30 hover:bg-tertiary/30 transition-all whitespace-nowrap">✓ Approve</button>
                        <button rv-on-click="task.toggleReject"   class="px-2 py-1 rounded text-[11px] font-bold bg-error/20 text-error border border-error/30 hover:bg-error/30 transition-all whitespace-nowrap">✗ Reject</button>
                      </div>
                    </td>
                  </tr>
                  <tr rv-show="task.rejectExpanded" class="bg-error/5">
                    <td colspan="9" class="px-sm py-2">
                      <div class="flex items-start gap-sm">
                        <textarea rv-value="task.rejectReason" placeholder="Rejection reason (required)..." rows="2" class="flex-1 bg-surface-container-low border border-white/10 rounded px-sm py-xs text-[12px] font-mono-data text-on-surface resize-none focus:outline-none focus:border-error/50 placeholder:text-on-surface-variant/50"></textarea>
                        <div class="flex flex-col gap-xs shrink-0">
                          <button rv-on-click="task.confirmReject" class="px-sm py-1 rounded text-[11px] font-bold bg-error text-white hover:brightness-110 transition-all whitespace-nowrap">Confirm reject</button>
                          <button rv-on-click="task.toggleReject"  class="px-sm py-1 rounded text-[11px] font-bold bg-white/10 text-on-surface-variant hover:bg-white/20 transition-all whitespace-nowrap">Cancel</button>
                        </div>
                      </div>
                      <p rv-show="task.actionError" rv-text="task.actionError" class="font-mono-data text-error text-[11px] mt-xs"></p>
                    </td>
                  </tr>
                  <tr rv-show="task.hasError" class="bg-error/5">
                    <td colspan="9" class="px-sm pb-2 pt-0">
                      <p rv-show="task.rejectionReason" class="font-mono-data text-error text-[11px]">Rejection: <span rv-text="task.rejectionReason"></span></p>
                      <p rv-show="task.failureMessage"  class="font-mono-data text-error text-[11px]">Failure: <span rv-text="task.failureMessage"></span></p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="tasksEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-task="tasks" class="px-md py-3">
                <div class="flex items-start justify-between mb-xs">
                  <div>
                    <p rv-text="task.idShort" rv-attr-title="task.id" class="font-mono-data text-on-surface text-[12px] cursor-help"></p>
                    <p rv-text="task.requestType" class="font-body-sm text-on-surface-variant mt-xs text-[11px]"></p>
                  </div>
                  <span rv-text="task.statusLabel" rv-attr-class="task.statusBadgeClass"></span>
                </div>
                <div class="grid grid-cols-2 gap-xs text-[11px] mt-xs">
                  <span class="text-on-surface-variant">Decision: <span rv-text="task.decisionMode" class="font-mono-data text-on-surface"></span></span>
                  <span class="text-on-surface-variant">Amount: <span rv-text="task.amountSats" class="font-mono-data text-on-surface"></span></span>
                </div>
                <p rv-show="task.signerFpFull" class="font-mono-data text-on-surface-variant text-[11px] mt-xs">Signer: <span rv-text="task.signerFp" rv-attr-title="task.signerFpFull"></span></p>
                <p rv-show="task.txHashFull" class="font-mono-data text-on-surface-variant text-[11px] mt-xs">TX: <span rv-text="task.txHash" rv-attr-title="task.txHashFull"></span></p>
                <p class="font-mono-data text-on-surface-variant text-[11px] mt-xs">Created: <span rv-text="task.createdAt"></span></p>
                <p rv-show="task.rejectionReason" rv-text="task.rejectionReason" class="font-mono-data text-error text-[11px] mt-xs"></p>
                <p rv-show="task.failureMessage"  rv-text="task.failureMessage"  class="font-mono-data text-error text-[11px] mt-xs"></p>
                <div rv-show="task.isPendingApproval" class="flex gap-xs mt-sm">
                  <button rv-on-click="task.confirmApprove" class="flex-1 py-2 rounded text-[12px] font-bold bg-tertiary/20 text-tertiary border border-tertiary/30">✓ Approve</button>
                  <button rv-on-click="task.toggleReject"   class="flex-1 py-2 rounded text-[12px] font-bold bg-error/20 text-error border border-error/30">✗ Reject</button>
                </div>
                <div rv-show="task.rejectExpanded" class="mt-sm">
                  <textarea rv-value="task.rejectReason" placeholder="Rejection reason..." rows="2" class="w-full bg-surface-container-low border border-white/10 rounded px-sm py-xs text-[12px] font-mono-data text-on-surface resize-none focus:outline-none focus:border-error/50 mb-xs"></textarea>
                  <div class="flex gap-xs">
                    <button rv-on-click="task.confirmReject" class="flex-1 py-1 rounded text-[11px] font-bold bg-error text-white">Confirm</button>
                    <button rv-on-click="task.toggleReject"  class="flex-1 py-1 rounded text-[11px] font-bold bg-white/10 text-on-surface-variant">Cancel</button>
                  </div>
                  <p rv-show="task.actionError" rv-text="task.actionError" class="font-mono-data text-error text-[11px] mt-xs"></p>
                </div>
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
      title: 'Signing Tasks',
      breadcrumb: 'Signing Tasks',
      onBack: () => router.navigate('#/tenants'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    error: null,
    tasks: [],
    tasksEmpty: true,
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
        const res = await api.getSigningTasks({
          limit: 20,
          cursor: self._cursor,
          ...self._activeFilters,
        });
        const items = res.data || res || [];
        self._nextCursor = res.pagination?.nextCursor || undefined;
        self.tasks = (Array.isArray(items) ? items : []).map(raw => {
          const t = normalizeTask(raw);
          if (t.isPendingApproval) {
            t.rejectExpanded = false;
            t.rejectReason = '';
            t.actionError = '';
            t.confirmApprove = async (e) => {
              e?.preventDefault();
              try {
                await api.approveSigningTask(raw.id);
                self.load();
              } catch (err) {
                t.actionError = err.message;
              }
            };
            t.toggleReject = (e) => {
              e?.preventDefault();
              t.rejectExpanded = !t.rejectExpanded;
              t.actionError = '';
            };
            t.confirmReject = async (e) => {
              e?.preventDefault();
              const reason = (t.rejectReason || '').trim();
              if (!reason) { t.actionError = 'Reason is required'; return; }
              try {
                await api.rejectSigningTask(raw.id, reason);
                self.load();
              } catch (err) {
                t.actionError = err.message;
              }
            };
          }
          return t;
        });
        self.tasksEmpty = self.tasks.length === 0;
        const currentPage = self._prevCursors.length + 1;
        self.pagination = createPaginationController({
          page: currentPage,
          total: self._nextCursor
            ? currentPage * 20 + 1
            : (currentPage - 1) * 20 + self.tasks.length,
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

  self.signingTaskSearchForm = createSigningTaskSearchFormController({
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

export const SigningTasksView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
