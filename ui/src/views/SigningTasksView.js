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

const STATUS_BADGE = {
  pending:  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/10 text-on-surface-variant border border-white/20',
  claimed:  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  signed:   'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  rejected: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
  expired:  'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-on-surface-variant border border-white/10',
};

function taskStatusBadge(status) {
  return STATUS_BADGE[status] || STATUS_BADGE.pending;
}

function normalizeTask(t) {
  const status = t.status || '';
  return {
    id:               t.id || '—',
    type:             (t.type || t.task_type || '—').toUpperCase().replace(/_/g, ' '),
    statusLabel:      status.toUpperCase(),
    statusBadgeClass: taskStatusBadge(status),
    signerName:       t.signer_name || t.signerName || t.external_signer_id || '—',
    createdAt:        fmtDate(t.created_at || t.createdAt),
    expiresAt:        fmtDate(t.expires_at || t.expiresAt),
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
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TASK ID</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TYPE</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">SIGNER</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CREATED</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">EXPIRES</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-task="tasks" class="hover:bg-white/[0.02]">
                    <td rv-text="task.id"           class="px-md py-3 font-mono-data text-on-surface text-[12px]"></td>
                    <td rv-text="task.type"         class="px-md py-3 font-body-sm text-on-surface-variant text-[12px]"></td>
                    <td class="px-md py-3">
                      <span rv-text="task.statusLabel" rv-attr-class="task.statusBadgeClass"></span>
                    </td>
                    <td rv-text="task.signerName"   class="px-md py-3 font-body-sm text-on-surface-variant text-[12px]"></td>
                    <td rv-text="task.createdAt"    class="px-md py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td rv-text="task.expiresAt"    class="px-md py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="tasksEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-task="tasks" class="px-md py-3">
                <div class="flex items-start justify-between mb-xs">
                  <div>
                    <p rv-text="task.id" class="font-mono-data text-on-surface text-[12px]"></p>
                    <p rv-text="task.type" class="font-body-sm text-on-surface-variant mt-xs"></p>
                  </div>
                  <span rv-text="task.statusLabel" rv-attr-class="task.statusBadgeClass"></span>
                </div>
                <p class="font-body-sm text-on-surface-variant text-[11px]">Signer: <span rv-text="task.signerName"></span></p>
                <div class="flex gap-md mt-xs">
                  <span class="font-mono-data text-on-surface-variant text-[11px]">Created: <span rv-text="task.createdAt"></span></span>
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
        self.tasks = (Array.isArray(items) ? items : []).map(normalizeTask);
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
