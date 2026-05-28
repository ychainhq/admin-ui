import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { template as paginationTpl, createPaginationController } from '../components/Pagination.js';
import { template as auditLogSearchTpl, createAuditLogSearchFormController } from '../components/AuditLogSearchForm.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/audit-logs';
const LIMIT = 50;

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 19).replace('T', ' '); } catch { return '—'; }
}

function shortId(v) {
  if (!v) return '—';
  return v.length > 22 ? v.slice(0, 10) + '…' + v.slice(-6) : v;
}

const CATEGORY_COLOR = {
  wallet:          'bg-secondary/10 text-secondary border-secondary/20',
  address:         'bg-secondary/10 text-secondary border-secondary/20',
  payment_request: 'bg-white/10 text-on-surface-variant border-white/20',
  deposit:         'bg-tertiary/10 text-tertiary border-tertiary/20',
  withdrawal:      'bg-white/10 text-on-surface-variant border-white/20',
  withdrawal_batch:'bg-white/10 text-on-surface-variant border-white/20',
  sweep:           'bg-secondary/10 text-secondary border-secondary/20',
  webhook:         'bg-white/10 text-on-surface-variant border-white/20',
  customer:        'bg-tertiary/10 text-tertiary border-tertiary/20',
  ledger:          'bg-secondary/10 text-secondary border-secondary/20',
  signing_task:    'bg-white/10 text-on-surface-variant border-white/20',
  external_signer: 'bg-white/10 text-on-surface-variant border-white/20',
  platform:        'bg-error/10 text-error border-error/20',
  transaction:     'bg-secondary/10 text-secondary border-secondary/20',
};

function categoryBadgeClass(category) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border';
  const color = CATEGORY_COLOR[category] || 'bg-white/10 text-on-surface-variant border-white/20';
  return `${base} ${color}`;
}

function formatJson(v) {
  if (v === null || v === undefined) return null;
  try {
    const parsed = typeof v === 'string' ? JSON.parse(v) : v;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(v);
  }
}

function normalizeTickler(t) {
  const category = t.category || '';
  const subcategory = t.subcategory || '';
  const entityId = t.entity_id || '';
  const details = [t.field1, t.field2, t.field3].filter(Boolean).join(' · ') || '';
  const prevJson = formatJson(t.prev_value);
  const newJson  = formatJson(t.new_value);

  const entry = {
    id:                t.id || '',
    category,
    subcategory,
    categoryLabel:     category.replace(/_/g, ' '),
    subcategoryLabel:  subcategory.replace(/_/g, ' '),
    categoryBadgeClass: categoryBadgeClass(category),
    entityId,
    entityIdShort:     shortId(entityId),
    actorLogin:        t.actor_login || '—',
    details,
    occurredAt:        fmtDate(t.occurred_at),
    prevJson:          prevJson || '—',
    newJson:           newJson  || '—',
    hasPrev:           prevJson !== null,
    hasNew:            newJson  !== null,
    hasDiff:           prevJson !== null || newJson !== null,
    expanded:          false,
  };

  entry.toggleExpand = function(e) {
    e?.preventDefault();
    entry.expanded = !entry.expanded;
  };

  return entry;
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Audit</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Audit Logs</span>
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

          ${auditLogSearchTpl}

          <div rv-hide="loading" class="glass-card rounded-xl overflow-hidden">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">receipt_long</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Audit Logs</span>
              </div>
              <button rv-on-click="load" class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                <span class="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div rv-show="itemsEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">receipt_long</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No audit log entries found</p>
              <p class="font-body-sm text-on-surface-variant mt-xs">Audit events appear here when operations are performed</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="itemsEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse" style="min-width:940px">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="w-8 px-sm py-3"></th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">OCCURRED</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CATEGORY</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">SUBCATEGORY</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ENTITY ID</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ACTOR</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">DETAILS</th>
                  </tr>
                </thead>
                <tbody rv-each-entry="entries" class="border-b border-white/5">
                  <tr class="hover:bg-white/[0.02]">
                    <td class="pl-sm py-3 w-8">
                      <button rv-show="entry.hasDiff" rv-on-click="entry.toggleExpand"
                        class="text-on-surface-variant hover:text-secondary transition-colors">
                        <span rv-show="entry.expanded"  class="material-symbols-outlined text-[16px]">expand_less</span>
                        <span rv-hide="entry.expanded" class="material-symbols-outlined text-[16px]">expand_more</span>
                      </button>
                    </td>
                    <td rv-text="entry.occurredAt" class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px] whitespace-nowrap"></td>
                    <td class="px-sm py-3">
                      <span rv-text="entry.categoryLabel" rv-attr-class="entry.categoryBadgeClass"></span>
                    </td>
                    <td rv-text="entry.subcategoryLabel" class="px-sm py-3 font-mono-data text-on-surface text-[12px]"></td>
                    <td class="px-sm py-3">
                      <span rv-text="entry.entityIdShort" rv-attr-title="entry.entityId" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td rv-text="entry.actorLogin" class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td rv-text="entry.details"   class="px-sm py-3 font-mono-data text-on-surface-variant text-[11px] max-w-[200px] truncate"></td>
                  </tr>
                  <tr rv-show="entry.expanded" class="bg-black/20">
                    <td colspan="7" class="px-md py-sm">
                      <div class="grid grid-cols-2 gap-sm">
                        <div>
                          <p class="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-xs">Before</p>
                          <pre rv-show="entry.hasPrev" rv-text="entry.prevJson"
                            class="text-[11px] font-mono-data text-tertiary bg-black/30 rounded-lg p-sm overflow-x-auto max-h-[300px] whitespace-pre-wrap break-all"></pre>
                          <p rv-hide="entry.hasPrev" class="text-[11px] font-mono-data text-on-surface-variant/40 italic">no prev value</p>
                        </div>
                        <div>
                          <p class="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-xs">After</p>
                          <pre rv-show="entry.hasNew" rv-text="entry.newJson"
                            class="text-[11px] font-mono-data text-secondary bg-black/30 rounded-lg p-sm overflow-x-auto max-h-[300px] whitespace-pre-wrap break-all"></pre>
                          <p rv-hide="entry.hasNew" class="text-[11px] font-mono-data text-on-surface-variant/40 italic">no new value</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="itemsEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-entry="entries" class="px-md py-3">
                <div class="flex items-start justify-between mb-xs">
                  <span rv-text="entry.categoryLabel" rv-attr-class="entry.categoryBadgeClass"></span>
                  <div class="flex items-center gap-xs">
                    <span rv-text="entry.occurredAt" class="font-mono-data text-on-surface-variant text-[11px]"></span>
                    <button rv-show="entry.hasDiff" rv-on-click="entry.toggleExpand"
                      class="text-on-surface-variant hover:text-secondary transition-colors">
                      <span rv-show="entry.expanded"  class="material-symbols-outlined text-[16px]">expand_less</span>
                      <span rv-hide="entry.expanded" class="material-symbols-outlined text-[16px]">expand_more</span>
                    </button>
                  </div>
                </div>
                <p class="font-mono-data text-on-surface text-[12px] mb-xs">
                  <span rv-text="entry.subcategoryLabel"></span>
                </p>
                <p class="font-mono-data text-on-surface-variant text-[11px] mb-xs">
                  <span rv-text="entry.entityIdShort" rv-attr-title="entry.entityId" class="cursor-help"></span>
                </p>
                <div class="flex items-center justify-between text-[11px] text-on-surface-variant">
                  <span rv-text="entry.actorLogin" class="font-mono-data"></span>
                  <span rv-text="entry.details" class="font-mono-data truncate ml-sm max-w-[50%]"></span>
                </div>
                <div rv-show="entry.expanded" class="mt-sm space-y-sm">
                  <div rv-show="entry.hasPrev">
                    <p class="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-xs">Before</p>
                    <pre rv-text="entry.prevJson"
                      class="text-[11px] font-mono-data text-tertiary bg-black/30 rounded-lg p-sm overflow-x-auto max-h-[200px] whitespace-pre-wrap break-all"></pre>
                  </div>
                  <div rv-show="entry.hasNew">
                    <p class="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-xs">After</p>
                    <pre rv-text="entry.newJson"
                      class="text-[11px] font-mono-data text-secondary bg-black/30 rounded-lg p-sm overflow-x-auto max-h-[200px] whitespace-pre-wrap break-all"></pre>
                  </div>
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
      title: 'Audit Logs',
      breadcrumb: 'Audit Logs',
      onBack: () => router.navigate('#/tenants'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar:   createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    error: null,
    entries: [],
    itemsEmpty: true,
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
        const res = await api.getTicklers({
          limit: LIMIT,
          cursor: self._cursor,
          ...self._activeFilters,
        });
        const items = res.data || [];
        self._nextCursor = res.pagination?.nextCursor || undefined;
        self.entries = items.map(normalizeTickler);
        self.itemsEmpty = self.entries.length === 0;
        const currentPage = self._prevCursors.length + 1;
        self.pagination = createPaginationController({
          page: currentPage,
          total: self._nextCursor
            ? currentPage * LIMIT + 1
            : (currentPage - 1) * LIMIT + self.entries.length,
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

  self.auditLogSearchForm = createAuditLogSearchFormController({
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

export const AuditLogsView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
