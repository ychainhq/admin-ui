const ACTIVE_CLASS  = 'px-sm py-1 rounded-lg border text-[12px] font-semibold bg-secondary/20 text-secondary border-secondary/40 transition-all';
const DEFAULT_CLASS = 'px-sm py-1 rounded-lg border text-[12px] font-semibold bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10 transition-all';

// Template consumed by SweepsView — must be imported as a named export.
export const template = `
<div rv-show="chainSelector.hasChains" class="flex flex-wrap gap-xs mb-md">
  <span class="font-body-sm text-on-surface-variant text-[12px] self-center mr-xs">Chain:</span>
  <button
    rv-each-chain="chainSelector.items"
    rv-on-click="chain.onClick"
    rv-attr-class="chain.btnClass"
  >
    <span rv-text="chain.label"></span>
  </button>
</div>
`;

/**
 * Factory for the chain/asset tab selector controller.
 *
 * @param {Object} opts
 * @param {Array<{chainId: string, assetId: string, symbol: string, label: string}>} opts.chains
 * @param {Function} opts.onSelect — called with (chainId, assetId) when user switches chain
 */
export function createSweepChainSelectorController({ chains = [], onSelect } = {}) {
  let _selectedChainId = null;
  let _selectedAssetId = null;

  function buildItems() {
    return chains.map(c => {
      const isActive = c.chainId === _selectedChainId && c.assetId === _selectedAssetId;
      return {
        ...c,
        isActive,
        btnClass: isActive ? ACTIVE_CLASS : DEFAULT_CLASS,
        onClick(e) {
          e?.preventDefault();
          self.select(c.chainId, c.assetId);
        },
      };
    });
  }

  const self = {
    get hasChains() { return chains.length > 0; },
    get items() { return buildItems(); },
    get selectedChainId() { return _selectedChainId; },
    get selectedAssetId() { return _selectedAssetId; },

    /**
     * Pre-select a chain/asset combination (called by the view after loading config).
     */
    init(chainId, assetId) {
      _selectedChainId = chainId;
      _selectedAssetId = assetId;
    },

    /**
     * Programmatic select — also used by the onClick closure on each item.
     */
    select(chainId, assetId) {
      _selectedChainId = chainId;
      _selectedAssetId = assetId;
      onSelect?.(chainId, assetId);
    },
  };

  return self;
}
