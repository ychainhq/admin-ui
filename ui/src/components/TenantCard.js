// Template for a single tenant card — used inside rv-each-tenant="tenants" (mobile only)
const CARD_INNER = `
  <div class="flex justify-between items-start">
    <div class="min-w-0">
      <h3 rv-text="tenant.name" class="font-headline-sm text-headline-sm text-on-surface truncate"></h3>
      <p class="font-mono-data text-on-surface-variant flex items-center gap-xs mt-xs">
        <span class="material-symbols-outlined text-[14px]">fingerprint</span>
        <span rv-text="tenant.id" class="truncate"></span>
      </p>
    </div>
    <div rv-show="tenant.isActive" class="shrink-0 ml-sm bg-tertiary/10 px-2 py-0.5 rounded-full flex items-center gap-xs">
      <span class="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
      <span class="font-label-md text-tertiary text-[10px]">ACTIVE</span>
    </div>
    <div rv-hide="tenant.isActive" class="shrink-0 ml-sm bg-outline/10 px-2 py-0.5 rounded-full flex items-center gap-xs">
      <span class="w-1.5 h-1.5 rounded-full bg-outline"></span>
      <span class="font-label-md text-on-surface-variant text-[10px]">SUSPENDED</span>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-sm my-xs">
    <div class="flex flex-col">
      <span class="font-label-md text-on-surface-variant text-[10px] uppercase">Custody</span>
      <span class="font-mono-data text-on-surface flex items-center gap-xs">
        <span rv-text="tenant.custodyIcon" class="material-symbols-outlined text-[16px] text-secondary"></span>
        <span rv-text="tenant.custodyMode" class="truncate"></span>
      </span>
    </div>
    <div class="flex flex-col">
      <span class="font-label-md text-on-surface-variant text-[10px] uppercase">Created</span>
      <span class="font-mono-data text-on-surface flex items-center gap-xs">
        <span class="material-symbols-outlined text-[16px] text-secondary">calendar_today</span>
        <span rv-text="tenant.createdAt"></span>
      </span>
    </div>
  </div>

  <div class="flex items-center justify-between mt-sm pt-sm border-t border-white/5">
    <button rv-on-click="tenant.viewConfig" class="font-label-md text-on-surface-variant hover:text-white transition-colors flex items-center gap-xs active:scale-95">
      View Config
      <span class="material-symbols-outlined text-[14px]">open_in_new</span>
    </button>
    <button rv-show="tenant.isActive" rv-on-click="tenant.workWith" class="bg-secondary text-on-secondary-fixed px-6 py-2 rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all">Work with</button>
    <button rv-hide="tenant.isActive" rv-on-click="tenant.workWith" class="border border-white/20 text-on-surface px-6 py-2 rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:bg-white/5">Work with</button>
  </div>
`;

export const template = `
<div rv-each-tenant="tenants">
  <div rv-show="tenant.isActive" class="glass-card rounded-xl p-md flex flex-col gap-sm relative overflow-hidden border-l-4 border-l-secondary">
    ${CARD_INNER}
  </div>
  <div rv-hide="tenant.isActive" class="glass-card rounded-xl p-md flex flex-col gap-sm relative overflow-hidden">
    ${CARD_INNER}
  </div>
</div>
`;

const CARD_BASE = 'glass-card rounded-xl p-md flex flex-col gap-sm relative overflow-hidden';
const WORK_BTN_ACTIVE = 'bg-secondary text-on-secondary-fixed px-6 py-2 rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all';
const WORK_BTN_GHOST = 'border border-white/20 text-on-surface px-6 py-2 rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:bg-white/5';

const TABLE_BADGE_ACTIVE = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20';
const TABLE_BADGE_SUSPENDED = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20';
const TABLE_WORK_BTN_ACTIVE = 'px-4 py-2 rounded bg-secondary text-on-secondary-fixed text-label-md font-bold hover:brightness-110 active:scale-95 transition-all';
const TABLE_WORK_BTN_GHOST = 'px-4 py-2 rounded text-on-surface-variant text-label-md font-bold hover:bg-white/5 transition-all border border-white/10';

export function createTenantViewModel(raw, { router, api }) {
  const isActive = raw.status === 'active';
  const custodyMode = raw.config?.custody_mode || raw.custody_mode || raw.custodyMode || '—';
  return {
    id:            raw.id,
    name:          raw.name,
    status:        raw.status,
    custodyMode,
    custodyIcon:   custodyMode === 'internal_hsm' ? 'key' : 'security',
    createdAt:     (() => { const v = raw.created_at ?? raw.createdAt; if (!v) return '—'; try { const ms = v < 1e10 ? v * 1000 : v; return new Date(ms).toISOString().slice(0, 10); } catch (_) { return '—'; } })(),
    isActive,
    // mobile card
    cardClass:        isActive ? `${CARD_BASE} border-l-4 border-l-secondary` : CARD_BASE,
    workWithBtnClass: isActive ? WORK_BTN_ACTIVE : WORK_BTN_GHOST,
    // desktop table
    rowClass:         'hover:bg-white/[0.03] transition-colors group',
    tableBadgeClass:  isActive ? TABLE_BADGE_ACTIVE : TABLE_BADGE_SUSPENDED,
    statusLabel:      isActive ? 'ACTIVE' : 'SUSPENDED',
    tableWorkBtnClass: isActive ? TABLE_WORK_BTN_ACTIVE : TABLE_WORK_BTN_GHOST,
    // actions
    viewConfig: () => router.navigate(`#/tenants/${encodeURIComponent(raw.id)}/config`),
    workWith:   async () => { await api.switchTenant(raw.id); },
  };
}
