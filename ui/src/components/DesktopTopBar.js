import { template as activeTenantBadgeTpl } from './ActiveTenantBadge.js';

export function desktopTopBarHtml({ breadcrumbHtml, showSearch = false, searchPlaceholder = 'Search...' }) {
  const searchHtml = showSearch ? `
    <div class="relative">
      <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">search</span>
      <input rv-on-input="search.onInput" rv-attr-value="search.value"
        class="bg-surface-container-high border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-body-sm w-72 focus:ring-1 focus:ring-secondary focus:border-secondary transition-all text-on-surface outline-none"
        placeholder="${searchPlaceholder}" type="text">
    </div>
  ` : '';

  return `
<div class="hidden lg:flex fixed top-0 left-[280px] right-0 z-40 bg-surface-container-low/50 backdrop-blur-xl border-b border-white/10 items-center justify-between px-margin-desktop h-16">
  <nav class="flex items-center gap-2 text-label-md font-label-md">
    ${breadcrumbHtml}
  </nav>
  <div class="flex items-center gap-md">
    ${searchHtml}
    <div class="flex items-center gap-sm">
      <button class="p-2 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-full transition-colors active:scale-95">
        <span class="material-symbols-outlined">notifications</span>
      </button>
      <button class="p-2 text-on-surface-variant hover:text-on-surface hover:bg-white/5 rounded-full transition-colors active:scale-95">
        <span class="material-symbols-outlined">settings</span>
      </button>
    </div>
    ${activeTenantBadgeTpl}
    <div class="flex items-center gap-sm">
      <div class="text-right">
        <p class="text-label-md font-label-md text-on-surface">Admin Profile</p>
        <p class="text-[10px] text-on-surface-variant uppercase tracking-widest">Superuser</p>
      </div>
      <div class="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center border border-white/20">
        <span class="material-symbols-outlined text-secondary text-[18px]">admin_panel_settings</span>
      </div>
    </div>
  </div>
</div>
`;
}
