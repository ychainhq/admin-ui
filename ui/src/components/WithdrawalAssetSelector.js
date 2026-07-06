// UX display metadata per assetId — NOT the authority on which assets are available.
// Availability comes from availableAssets returned by GET /v1/me/tenant-config.
const ASSET_META = {
  'bitcoin:BTC': { decimals: 8, inputMode: 'sats',  unitLabel: 'satoshis', placeholder: 'np. 100000',  amountLabel: 'Amount (satoshi)' },
  'tron:TRX':   { decimals: 6, inputMode: 'float', unitLabel: 'TRX',      placeholder: 'np. 10.5',    amountLabel: 'Amount (TRX)' },
  'tron:USDT':  { decimals: 6, inputMode: 'float', unitLabel: 'USDT',     placeholder: 'np. 50.00',   amountLabel: 'Amount (USDT)' },
};

export const DEFAULT_META = { decimals: 8, inputMode: 'sats', unitLabel: 'units', placeholder: '0', amountLabel: 'Amount' };

const ACTIVE_CLASS  = 'bg-secondary/20 text-secondary border-secondary/40';
const DEFAULT_CLASS = 'bg-white/5 text-on-surface-variant border-white/10 hover:bg-white/10';

// Returns ASSET_META for the given assetId, or DEFAULT_META if unknown.
export function getAssetMeta(assetId) {
  return ASSET_META[assetId] || DEFAULT_META;
}

// Builds a flat array of asset button items suitable for Rivets rv-each binding.
// Rivets rule: rv-on-click inside rv-each must reference a method ON the iterated item.
// Each item exposes onClick as a closure so Rivets resolves it as `a.onClick`.
//
// onSelect({ chainId, assetId, asset }) is called when the user selects an asset.
// selectedAssetId controls which button renders as active.
export function buildWithdrawableAssets(availableAssets, selectedAssetId, onSelect) {
  return (availableAssets || []).map(a => {
    const meta = ASSET_META[a.assetId] || DEFAULT_META;
    const isActive = a.assetId === selectedAssetId;
    return {
      ...a,
      ...meta,
      isActive,
      btnClass: isActive ? ACTIVE_CLASS : DEFAULT_CLASS,
      onClick(e) {
        e?.preventDefault();
        onSelect?.({ chainId: a.chainId, assetId: a.assetId, asset: { ...a, ...meta } });
      },
    };
  });
}
