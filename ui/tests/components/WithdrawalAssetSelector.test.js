import { buildWithdrawableAssets, getAssetMeta, DEFAULT_META } from '../../src/components/WithdrawalAssetSelector.js';

const BTC  = { chainId: 'bitcoin', assetId: 'bitcoin:BTC', symbol: 'BTC',  label: 'Bitcoin (BTC)' };
const TRX  = { chainId: 'tron',    assetId: 'tron:TRX',    symbol: 'TRX',  label: 'TRON (TRX)' };
const USDT = { chainId: 'tron',    assetId: 'tron:USDT',   symbol: 'USDT', label: 'USDT (TRC-20)' };

describe('getAssetMeta', () => {
  test('returns correct meta for bitcoin:BTC', () => {
    const meta = getAssetMeta('bitcoin:BTC');
    expect(meta.decimals).toBe(8);
    expect(meta.inputMode).toBe('sats');
    expect(meta.unitLabel).toBe('satoshis');
    expect(meta.amountLabel).toContain('satoshi');
  });

  test('returns correct meta for tron:TRX', () => {
    const meta = getAssetMeta('tron:TRX');
    expect(meta.decimals).toBe(6);
    expect(meta.inputMode).toBe('float');
    expect(meta.unitLabel).toBe('TRX');
  });

  test('returns correct meta for tron:USDT', () => {
    const meta = getAssetMeta('tron:USDT');
    expect(meta.decimals).toBe(6);
    expect(meta.inputMode).toBe('float');
    expect(meta.unitLabel).toBe('USDT');
  });

  test('returns DEFAULT_META for unknown assetId', () => {
    const meta = getAssetMeta('solana:SOL');
    expect(meta.unitLabel).toBe('units');
    expect(meta.amountLabel).toBe('Amount');
  });

  test('DEFAULT_META export matches fallback', () => {
    expect(DEFAULT_META.unitLabel).toBe('units');
    expect(DEFAULT_META.decimals).toBe(8);
  });
});

describe('buildWithdrawableAssets — empty / no assets', () => {
  test('returns empty array for empty input', () => {
    expect(buildWithdrawableAssets([], 'bitcoin:BTC', jest.fn())).toEqual([]);
  });

  test('returns empty array for null input', () => {
    expect(buildWithdrawableAssets(null, 'bitcoin:BTC', jest.fn())).toEqual([]);
  });

  test('returns empty array for undefined input', () => {
    expect(buildWithdrawableAssets(undefined, 'bitcoin:BTC', jest.fn())).toEqual([]);
  });
});

describe('buildWithdrawableAssets — single asset', () => {
  test('returns array with one item', () => {
    const result = buildWithdrawableAssets([BTC], 'bitcoin:BTC', jest.fn());
    expect(result).toHaveLength(1);
  });

  test('active item has isActive=true and active btnClass', () => {
    const [btn] = buildWithdrawableAssets([BTC], 'bitcoin:BTC', jest.fn());
    expect(btn.isActive).toBe(true);
    expect(btn.btnClass).toContain('bg-secondary');
  });

  test('item is enriched with ASSET_META (decimals, inputMode, amountLabel)', () => {
    const [btn] = buildWithdrawableAssets([BTC], 'bitcoin:BTC', jest.fn());
    expect(btn.decimals).toBe(8);
    expect(btn.inputMode).toBe('sats');
    expect(btn.amountLabel).toContain('satoshi');
  });

  test('item preserves original fields (chainId, symbol, label)', () => {
    const [btn] = buildWithdrawableAssets([BTC], 'bitcoin:BTC', jest.fn());
    expect(btn.chainId).toBe('bitcoin');
    expect(btn.symbol).toBe('BTC');
    expect(btn.label).toBe('Bitcoin (BTC)');
  });

  test('unknown assetId uses DEFAULT_META without throwing', () => {
    const unknown = { chainId: 'solana', assetId: 'solana:SOL', symbol: 'SOL', label: 'Solana' };
    expect(() => buildWithdrawableAssets([unknown], 'solana:SOL', jest.fn())).not.toThrow();
    const [btn] = buildWithdrawableAssets([unknown], 'solana:SOL', jest.fn());
    expect(btn.unitLabel).toBe('units');
  });
});

describe('buildWithdrawableAssets — multiple assets, active state', () => {
  test('selected asset has isActive=true, others false', () => {
    const result = buildWithdrawableAssets([BTC, TRX, USDT], 'tron:TRX', jest.fn());
    const [btcBtn, trxBtn, usdtBtn] = result;
    expect(btcBtn.isActive).toBe(false);
    expect(trxBtn.isActive).toBe(true);
    expect(usdtBtn.isActive).toBe(false);
  });

  test('active item has active btnClass, inactive items do not', () => {
    const result = buildWithdrawableAssets([BTC, USDT], 'tron:USDT', jest.fn());
    expect(result[0].btnClass).not.toContain('bg-secondary');
    expect(result[1].btnClass).toContain('bg-secondary');
  });

  test('no asset matches selectedAssetId — all inactive', () => {
    const result = buildWithdrawableAssets([BTC, TRX], 'tron:USDT', jest.fn());
    expect(result.every(b => !b.isActive)).toBe(true);
  });
});

describe('buildWithdrawableAssets — onClick callback', () => {
  test('onClick calls onSelect with correct chainId, assetId, asset', () => {
    const onSelect = jest.fn();
    const [btcBtn] = buildWithdrawableAssets([BTC], 'bitcoin:BTC', onSelect);
    btcBtn.onClick(null);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
      chainId: 'bitcoin',
      assetId: 'bitcoin:BTC',
    }));
  });

  test('onClick prevents default when event provided', () => {
    const onSelect = jest.fn();
    const [btn] = buildWithdrawableAssets([TRX], 'tron:TRX', onSelect);
    const e = { preventDefault: jest.fn() };
    btn.onClick(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  test('onClick works when called without event (null)', () => {
    const onSelect = jest.fn();
    const [btn] = buildWithdrawableAssets([USDT], 'tron:USDT', onSelect);
    expect(() => btn.onClick(null)).not.toThrow();
    expect(onSelect).toHaveBeenCalled();
  });

  test('asset passed to onSelect is enriched with ASSET_META', () => {
    const onSelect = jest.fn();
    const [btn] = buildWithdrawableAssets([TRX], 'tron:TRX', onSelect);
    btn.onClick(null);
    const { asset } = onSelect.mock.calls[0][0];
    expect(asset.inputMode).toBe('float');
    expect(asset.amountLabel).toContain('TRX');
  });

  test('each item carries its own closure (correct assetId per item)', () => {
    const onSelect = jest.fn();
    const result = buildWithdrawableAssets([BTC, TRX, USDT], 'bitcoin:BTC', onSelect);
    result[2].onClick(null); // click USDT
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ assetId: 'tron:USDT' }));
  });
});

describe('buildWithdrawableAssets — rebuilding on selection change', () => {
  test('rebuilding with new selectedAssetId updates isActive correctly', () => {
    const onSelect = jest.fn();
    const assets = [BTC, TRX];
    const first = buildWithdrawableAssets(assets, 'bitcoin:BTC', onSelect);
    expect(first[0].isActive).toBe(true);
    expect(first[1].isActive).toBe(false);

    const rebuilt = buildWithdrawableAssets(assets, 'tron:TRX', onSelect);
    expect(rebuilt[0].isActive).toBe(false);
    expect(rebuilt[1].isActive).toBe(true);
  });

  test('onSelect not called during build — only on click', () => {
    const onSelect = jest.fn();
    buildWithdrawableAssets([BTC, TRX, USDT], 'bitcoin:BTC', onSelect);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
