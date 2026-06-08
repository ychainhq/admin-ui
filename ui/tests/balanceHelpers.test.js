import {
  BTC_ASSET_ID,
  btcDecimalToSats,
  extractBalanceList,
  formatRawAmount,
  getConfirmedBitcoinBalance,
  normalizeBalance,
} from '../src/balanceHelpers.js';

describe('balanceHelpers', () => {
  test('formatRawAmount formats BTC satoshi values as BTC decimals', () => {
    expect(formatRawAmount('123456789', BTC_ASSET_ID)).toBe('1.23456789');
  });

  test('btcDecimalToSats converts BTC decimals without floating point math', () => {
    expect(btcDecimalToSats('0.05')).toBe('5000000');
    expect(btcDecimalToSats('1.00000001')).toBe('100000001');
  });

  test('btcDecimalToSats rejects values with more than 8 decimal places', () => {
    expect(btcDecimalToSats('0.000000001')).toBeNull();
  });

  test('extractBalanceList accepts array, wrapped balances, and wrapped data shapes', () => {
    const list = [{ asset_id: BTC_ASSET_ID, settled: '1' }];
    expect(extractBalanceList(list)).toBe(list);
    expect(extractBalanceList({ balances: list })).toBe(list);
    expect(extractBalanceList({ data: { balances: list } })).toBe(list);
  });

  test('normalizeBalance keeps existing display fields and formats raw BTC fields', () => {
    expect(normalizeBalance({
      asset_id: BTC_ASSET_ID,
      settled: '5000000',
      pending: '1000000',
      total: '6000000',
    })).toEqual({
      asset: 'BTC',
      chain: 'bitcoin',
      available: '0.05000000',
      pending: '0.01000000',
      hold: '0.00000000',
      total: '0.06000000',
    });
  });

  test('getConfirmedBitcoinBalance uses settled sats and ignores pending', () => {
    expect(getConfirmedBitcoinBalance({
      balances: [
        { asset_id: BTC_ASSET_ID, settled: '5000', pending: '9999' },
      ],
    })).toEqual({
      available: true,
      confirmedSats: '5000',
      confirmedSatsLabel: '5000 sats',
      confirmedBtcLabel: '0.00005000 BTC',
    });
  });

  test('getConfirmedBitcoinBalance falls back to available BTC decimal', () => {
    expect(getConfirmedBitcoinBalance({
      balances: [
        { asset: 'BTC', chain: 'bitcoin', available: '0.05', pending: '10' },
      ],
    }).confirmedSats).toBe('5000000');
  });

  test('getConfirmedBitcoinBalance returns unavailable when BTC balance is missing', () => {
    expect(getConfirmedBitcoinBalance({ balances: [] })).toEqual({
      available: false,
      confirmedSats: null,
      confirmedSatsLabel: 'Unavailable',
      confirmedBtcLabel: '—',
    });
  });
});
