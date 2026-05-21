export function opCardHtml({ icon, title, description, scopePrefix, bodyHtml }) {
  return `
<div class="glass-card rounded-xl overflow-hidden">
  <div class="flex items-center gap-sm px-md py-4 border-b border-white/10">
    <div class="w-9 h-9 rounded-lg bg-secondary/10 flex items-center justify-center border border-secondary/20 shrink-0">
      <span class="material-symbols-outlined text-secondary text-[18px]">${icon}</span>
    </div>
    <div class="flex-1">
      <p class="font-label-md text-on-surface font-bold">${title}</p>
      <p class="font-body-sm text-on-surface-variant text-[12px]">${description}</p>
    </div>
    <div rv-show="${scopePrefix}.loading" class="w-5 h-5 rounded-full border-2 border-secondary border-t-transparent animate-spin shrink-0"></div>
  </div>
  <div class="p-md space-y-sm">
    ${bodyHtml}
    <div rv-show="${scopePrefix}.error" class="flex items-center gap-xs p-sm rounded-lg bg-error/10 border border-error/30">
      <span class="material-symbols-outlined text-error text-[18px] shrink-0">error</span>
      <span rv-text="${scopePrefix}.error" class="font-body-sm text-error text-[12px]"></span>
    </div>
    <div rv-show="${scopePrefix}.result" class="flex items-center gap-xs p-sm rounded-lg bg-tertiary/10 border border-tertiary/30">
      <span class="material-symbols-outlined text-tertiary text-[18px] shrink-0">check_circle</span>
      <span rv-text="${scopePrefix}.result" class="font-body-sm text-tertiary font-mono text-[12px] break-all flex-1"></span>
      <button rv-on-click="${scopePrefix}.copy" class="shrink-0 p-1 rounded hover:bg-white/10 text-on-surface-variant hover:text-on-surface transition-colors ml-auto" title="Copy to clipboard">
        <span class="material-symbols-outlined text-[16px]">content_copy</span>
      </button>
    </div>
  </div>
</div>`;
}
