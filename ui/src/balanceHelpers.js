export const BTC_ASSET_ID = 'bitcoin:BTC';
export const TRON_USDT_ASSET_ID = 'tron:USDT';
export const TRON_TRX_ASSET_ID = 'tron:TRX';

// 6 decimals for TRON assets (sun for TRX, micro-USDT for USDT)
const TRON_DIVISOR = 1_000_000n;

export function formatRawAmount(raw, assetId) {
  if (raw === null || raw === undefined || raw === '') return '0';
  const value = String(raw);
  if (assetId === BTC_ASSET_ID) {
    const sats = BigInt(value);
    const sign = sats < 0n ? '-' : '';
    const abs = sats < 0n ? -sats : sats;
    const whole = abs / 100_000_000n;
    const fraction = String(abs % 100_000_000n).padStart(8, '0');
    return `${sign}${whole}.${fraction}`;
  }
  if (assetId === TRON_USDT_ASSET_ID || assetId === TRON_TRX_ASSET_ID) {
    const units = BigInt(value);
    const sign = units < 0n ? '-' : '';
    const abs = units < 0n ? -units : units;
    const whole = abs / TRON_DIVISOR;
    const fraction = String(abs % TRON_DIVISOR).padStart(6, '0');
    return `${sign}${whole}.${fraction}`;
  }
  return value;
}

export function extractBalanceList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.balances)) return data.balances;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.balances)) return data.data.balances;
  return [];
}

export function normalizeBalance(raw) {
  const assetId = raw.asset_id || raw.assetId || '';
  const [chainFromAsset, assetFromAsset] = assetId.includes(':') ? assetId.split(':') : ['', ''];

  return {
    asset: raw.asset || assetFromAsset || '—',
    chain: raw.chain || chainFromAsset || '—',
    available: raw.available ?? formatRawAmount(raw.settled, assetId),
    pending: raw.pending_display || raw.pendingDisplay || formatRawAmount(raw.pending, assetId),
    hold: raw.hold ?? formatRawAmount(raw.hold_raw || raw.holdRaw || '0', assetId),
    total: raw.total_display || raw.totalDisplay || formatRawAmount(raw.total, assetId),
  };
}

export function btcDecimalToSats(value) {
  if (value === null || value === undefined || value === '') return '0';
  const text = String(value).trim();
  const match = text.match(/^(-?)(\d+)(?:\.(\d{0,8}))?$/);
  if (!match) return null;

  const [, sign, whole, fraction = ''] = match;
  const sats = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
  const signed = sign === '-' ? -sats : sats;
  return signed.toString();
}

function isBitcoinBalance(raw) {
  const assetId = raw.asset_id || raw.assetId || '';
  const asset = raw.asset || '';
  const chain = raw.chain || '';
  return assetId === BTC_ASSET_ID || (asset === 'BTC' && chain === 'bitcoin');
}

export function findBitcoinBalance(data) {
  return extractBalanceList(data).find(isBitcoinBalance) || null;
}

export function getConfirmedBitcoinBalance(data) {
  const balance = findBitcoinBalance(data);
  if (!balance) {
    return {
      available: false,
      confirmedSats: null,
      confirmedSatsLabel: 'Unavailable',
      confirmedBtcLabel: '—',
    };
  }

  const rawSats =
    balance.settled ??
    balance.settled_raw ??
    balance.settledRaw ??
    balance.available_raw ??
    balance.availableRaw;
  const confirmedSats = rawSats !== undefined && rawSats !== null && rawSats !== ''
    ? String(rawSats)
    : btcDecimalToSats(balance.available);

  if (confirmedSats === null) {
    return {
      available: false,
      confirmedSats: null,
      confirmedSatsLabel: 'Unavailable',
      confirmedBtcLabel: '—',
    };
  }

  return {
    available: true,
    confirmedSats,
    confirmedSatsLabel: `${confirmedSats} sats`,
    confirmedBtcLabel: `${formatRawAmount(confirmedSats, BTC_ASSET_ID)} BTC`,
  };
}

/**
 * Format a sun amount (string or number) as a human-readable TRX value.
 * "0" → "0 TRX", "27300000" → "27.3 TRX"
 */
export function formatSunAsTrx(sunStr) {
  if (sunStr === null || sunStr === undefined || sunStr === '') return '0 TRX';
  const n = Number(sunStr);
  if (isNaN(n)) return '— TRX';
  if (n === 0) return '0 TRX';
  const trx = n / 1_000_000;
  // Trim trailing zeros but keep at least 1 decimal if fractional
  const formatted = trx % 1 === 0 ? trx.toFixed(0) : trx.toFixed(6).replace(/\.?0+$/, '');
  return `${formatted} TRX`;
}

/**
 * Chain-aware fee display: TRON in TRX, Bitcoin in sats.
 */
export function formatFeeDisplay(feeRaw, chainId) {
  if (!feeRaw || feeRaw === '—') return '—';
  if (chainId === 'tron') return formatSunAsTrx(feeRaw);
  return `${feeRaw} sats`;
}

export function tronDecimalToSun(value) {
  if (value === null || value === undefined || value === '') return '0';
  const text = String(value).trim();
  const match = text.match(/^(-?)(\d+)(?:\.(\d{0,6}))?$/);
  if (!match) return null;
  const [, sign, whole, fraction = ''] = match;
  const units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
  return (sign === '-' ? -units : units).toString();
}

function findTronBalance(data, assetId) {
  return extractBalanceList(data).find((raw) => {
    const id = raw.asset_id || raw.assetId || '';
    return id === assetId;
  }) || null;
}

export function getTronUsdtBalance(data) {
  return _getTronBalance(data, TRON_USDT_ASSET_ID, 'USDT');
}

export function getTronTrxBalance(data) {
  return _getTronBalance(data, TRON_TRX_ASSET_ID, 'TRX');
}

function _getTronBalance(data, assetId, ticker) {
  const balance = findTronBalance(data, assetId);
  if (!balance) {
    return { available: false, rawUnits: null, label: 'Unavailable' };
  }
  const rawUnits =
    balance.settled ??
    balance.settled_raw ??
    balance.settledRaw ??
    balance.available_raw ??
    balance.availableRaw ??
    '0';
  return {
    available: true,
    rawUnits: String(rawUnits),
    label: `${formatRawAmount(String(rawUnits), assetId)} ${ticker}`,
  };
}
