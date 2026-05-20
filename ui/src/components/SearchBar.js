export const template = `
<div class="mb-gutter">
  <div class="relative group">
    <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-secondary transition-colors pointer-events-none">search</span>
    <input
      rv-on-input="search.onInput"
      rv-attr-value="search.value"
      class="w-full bg-surface-container-low border border-white/10 rounded-xl py-4 pl-12 pr-4 text-on-surface placeholder:text-on-surface-variant focus:ring-1 focus:ring-secondary focus:border-secondary transition-all font-body-md outline-none"
      type="text"
      placeholder="Search by Name or ID..."
    />
  </div>
</div>
`;

export function createSearchController({ value = '', onInput }) {
  let debounce = null;
  return {
    value,
    onInput(e) {
      clearTimeout(debounce);
      debounce = setTimeout(() => onInput(e.target.value), 300);
    },
  };
}
