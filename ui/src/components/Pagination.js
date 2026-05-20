export const template = `
<div class="mt-lg flex flex-col items-center gap-sm">
  <span rv-text="pagination.showingText" class="font-label-md text-on-surface-variant"></span>
  <div class="flex gap-xs" rv-show="pagination.hasPages">
    <button rv-on-click="pagination.prevPage" rv-attr-disabled="pagination.prevDisabled"
      class="w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 text-on-surface-variant hover:bg-white/5 transition-colors disabled:opacity-30">
      <span class="material-symbols-outlined">chevron_left</span>
    </button>
    <button rv-each-pg="pagination.pages" rv-on-click="pg.go" rv-attr-class="pg.btnClass" rv-text="pg.label"></button>
    <button rv-on-click="pagination.nextPage" rv-attr-disabled="pagination.nextDisabled"
      class="w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 text-on-surface-variant hover:bg-white/5 transition-colors disabled:opacity-30">
      <span class="material-symbols-outlined">chevron_right</span>
    </button>
  </div>
</div>
`;

const PAGE_BTN_ACTIVE = 'w-10 h-10 rounded-lg flex items-center justify-center border border-secondary bg-secondary/10 text-secondary font-bold';
const PAGE_BTN_NORMAL = 'w-10 h-10 rounded-lg flex items-center justify-center border border-white/10 text-on-surface-variant hover:bg-white/5';
const DESKTOP_PAGE_BTN_ACTIVE = 'w-8 h-8 rounded bg-secondary text-on-secondary-fixed text-label-md font-bold';
const DESKTOP_PAGE_BTN_NORMAL = 'w-8 h-8 rounded hover:bg-white/5 text-on-surface-variant text-label-md transition-colors';

export function createPaginationController({ page, total, perPage = 10, onPageChange }) {
  const totalPages = Math.ceil(total / perPage);
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    const current = i;
    pages.push({
      label: String(i),
      btnClass: i === page ? PAGE_BTN_ACTIVE : PAGE_BTN_NORMAL,
      desktopBtnClass: i === page ? DESKTOP_PAGE_BTN_ACTIVE : DESKTOP_PAGE_BTN_NORMAL,
      go: () => onPageChange(current),
    });
  }

  return {
    showingText: total === 0 ? 'No results' : `Showing ${from} to ${to} of ${total} results`,
    from,
    to,
    totalCount: total,
    hasPages: totalPages > 1,
    prevDisabled: page <= 1 ? true : null,
    nextDisabled: page >= totalPages ? true : null,
    pages,
    prevPage: () => page > 1 && onPageChange(page - 1),
    nextPage: () => page < totalPages && onPageChange(page + 1),
  };
}
