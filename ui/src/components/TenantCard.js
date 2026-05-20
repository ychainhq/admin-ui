// Template for a single tenant card — used inside rv-each-tenant="tenants"
// Within rv-each, Rivets scope is the tenant item, so properties are accessed as tenant.name etc.
export const template = `
<div rv-each-tenant="tenants" rv-attr-class="tenant.cardClass">
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
    <button rv-on-click="tenant.workWith" rv-attr-class="tenant.workWithBtnClass">Work with</button>
  </div>
</div>
`;

const CARD_BASE = 'glass-card rounded-xl p-md flex flex-col gap-sm relative overflow-hidden';
const WORK_BTN_ACTIVE = 'bg-secondary text-on-secondary-fixed px-6 py-2 rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all';
const WORK_BTN_GHOST = 'border border-white/20 text-on-surface px-6 py-2 rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:bg-white/5';

export function createTenantViewModel(raw, { router }) {
  const isActive = raw.status === 'active';
  return {
    id:            raw.id,
    name:          raw.name,
    status:        raw.status,
    custodyMode:   raw.custody_mode || raw.custodyMode || '—',
    custodyIcon:   (raw.custody_mode === 'internal_hsm' || raw.custodyMode === 'internal_hsm') ? 'key' : 'security',
    createdAt:     (raw.created_at || raw.createdAt || '').slice(0, 10),
    isActive,
    cardClass:     isActive ? `${CARD_BASE} border-l-4 border-l-secondary` : CARD_BASE,
    workWithBtnClass: isActive ? WORK_BTN_ACTIVE : WORK_BTN_GHOST,
    viewConfig:    () => router.navigate(`#/tenants/${encodeURIComponent(raw.id)}/config`),
    workWith:      () => router.navigate(`#/tenants/${encodeURIComponent(raw.id)}/config`),
  };
}
