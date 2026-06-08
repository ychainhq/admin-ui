export const BTC_ASSET_ID = 'bitcoin:BTC';

export function formatRawAmount(raw, assetId) {
  if (raw === null || raw === undefined || raw === '') return '0';
  const value = String(raw);
  if (assetId === BTC_ASSET_ID) {
    const sats = BigInt(value);
    const sign = sats < 0n ? '-' : '';
    const abs = sats < 0n ? -sats : sats;
    const whole = abs / 100000000n;
    const fraction = String(abs % 100000000n).padStart(8, '0');
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
