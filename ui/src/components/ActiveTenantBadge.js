import { getActiveTenant } from '../activeTenant.js';

export const template = `
  <div class="h-8 w-px bg-white/10"></div>
  <div rv-show="activeTenant.isSet" class="flex items-center gap-sm px-3 py-1.5 rounded-lg bg-secondary-container/20 border border-secondary-container/30">
    <div class="flex items-center justify-center w-8 h-8 rounded bg-secondary-container/30 text-secondary shrink-0">
      <span class="material-symbols-outlined text-[20px]">hub</span>
    </div>
    <div class="flex flex-col min-w-0">
      <p rv-text="activeTenant.name" class="text-label-md font-bold text-secondary-fixed truncate max-w-[140px]"></p>
      <p rv-text="activeTenant.id" class="text-[10px] font-mono text-secondary/60 leading-none truncate max-w-[140px]"></p>
    </div>
  </div>
  <div rv-show="activeTenant.isEmpty" class="flex items-center gap-sm px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
    <span class="material-symbols-outlined text-[20px] text-on-surface-variant">hub</span>
    <span class="text-label-md text-on-surface-variant">No tenant selected</span>
  </div>
  <div class="h-8 w-px bg-white/10"></div>
`;

export function createActiveTenantController() {
  const tenant = getActiveTenant();
  return {
    isSet: !!tenant,
    isEmpty: !tenant,
    name: tenant?.name ?? '',
    id: tenant?.id ?? '',
  };
}
