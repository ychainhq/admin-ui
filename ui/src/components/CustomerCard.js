function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 10); } catch { return '—'; }
}

export const CUSTOMER_STATUS_BADGE = {
  active:   'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  disabled: 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20',
  frozen:   'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-outline/10 text-on-surface-variant border border-white/10',
};

export function customerStatusBadgeClass(status) {
  return CUSTOMER_STATUS_BADGE[status] || CUSTOMER_STATUS_BADGE.frozen;
}

const CARD_INNER = `
  <div class="flex justify-between items-start gap-sm">
    <div class="flex items-center gap-sm min-w-0">
      <div class="w-10 h-10 rounded-lg bg-tertiary/10 flex items-center justify-center border border-tertiary/20 shrink-0">
        <span class="material-symbols-outlined text-tertiary">person</span>
      </div>
      <div class="min-w-0">
        <p rv-text="customer.customerId" class="font-mono-data text-on-surface text-[13px] truncate"></p>
        <p rv-show="customer.hasReference" rv-text="customer.reference" class="font-body-sm text-on-surface-variant truncate mt-xs"></p>
        <p rv-hide="customer.hasReference" class="font-body-sm text-on-surface-variant italic opacity-50 mt-xs">No reference</p>
      </div>
    </div>
    <span rv-text="customer.statusLabel" rv-attr-class="customer.statusBadgeClass" class="shrink-0"></span>
  </div>
  <div class="flex items-center justify-between mt-sm pt-sm border-t border-white/5">
    <span class="font-body-sm text-on-surface-variant flex items-center gap-xs">
      <span class="material-symbols-outlined text-[14px]">calendar_today</span>
      <span rv-text="customer.createdAt"></span>
    </span>
    <button rv-on-click="customer.view"
      class="flex items-center gap-xs bg-secondary/10 text-secondary border border-secondary/20 px-4 py-1.5 rounded-lg font-label-md font-bold hover:bg-secondary/20 active:scale-95 transition-all">
      <span class="material-symbols-outlined text-[16px]">open_in_new</span>
      View
    </button>
  </div>
`;

export const template = `
<div rv-each-customer="customers" class="mb-4">
  <div class="glass-card rounded-xl p-md flex flex-col gap-sm">
    ${CARD_INNER}
  </div>
</div>
`;

export function createCustomerViewModel(raw, { router }) {
  const id = raw.customerId || raw.id || '—';
  return {
    customerId:       id,
    reference:        raw.reference || '',
    hasReference:     Boolean(raw.reference),
    statusLabel:      (raw.status || '').toUpperCase(),
    statusBadgeClass: customerStatusBadgeClass(raw.status),
    createdAt:        fmtDate(raw.createdAt || raw.created_at),
    view:             () => router.navigate(`#/customers/${encodeURIComponent(id)}/profile`),
  };
}
