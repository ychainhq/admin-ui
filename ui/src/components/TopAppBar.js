export const template = `
<header class="lg:hidden fixed top-0 left-0 right-0 z-50 bg-surface-dim/80 backdrop-blur-xl border-b border-white/10 flex justify-between items-center px-margin-mobile h-16">
  <div class="flex items-center gap-sm">
    <button rv-on-click="topBar.onBack" class="material-symbols-outlined text-primary active:scale-95 transition-transform duration-150 p-xs">arrow_back</button>
    <div class="flex flex-col">
      <span rv-text="topBar.title" class="font-headline-sm text-headline-sm-mobile text-primary"></span>
      <span rv-text="topBar.breadcrumb" class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant -mt-1"></span>
    </div>
  </div>
  <button rv-on-click="topBar.onMenuOpen" class="material-symbols-outlined text-primary hover:bg-surface-container-highest/50 active:scale-95 transition-transform duration-150 p-sm rounded-full">account_circle</button>
</header>
`;

export function createTopBarController({ title, breadcrumb, onBack, onMenuOpen }) {
  return {
    title,
    breadcrumb,
    onBack: onBack || (() => window.history.back()),
    onMenuOpen: onMenuOpen || (() => {}),
  };
}
