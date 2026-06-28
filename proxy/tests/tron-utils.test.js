'use strict';

const {
  base58ToBytes,
  tronAddrToHex,
  tronAddrTo20Hex,
  decodeTronMessage,
  parseTriggerResponse,
} = require('../lib/tron-utils');

// ─── decodeTronMessage ────────────────────────────────────────────────────────

describe('decodeTronMessage', () => {
  test('returns null for null input', () => {
    expect(decodeTronMessage(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(decodeTronMessage(undefined)).toBeNull();
  });

  test('returns null for empty string', () => {
    expect(decodeTronMessage('')).toBeNull();
  });

  test('decodes hex-encoded ASCII to readable string', () => {
    // "insufficient balance" as hex
    const hex = Buffer.from('insufficient balance').toString('hex');
    expect(decodeTronMessage(hex)).toBe('insufficient balance');
  });

  test('decodes "Out of energy" hex message', () => {
    const hex = Buffer.from('Out of energy').toString('hex');
    expect(decodeTronMessage(hex)).toBe('Out of energy');
  });

  test('decodes "REVERT opcode executed" hex message', () => {
    const hex = Buffer.from('REVERT opcode executed').toString('hex');
    expect(decodeTronMessage(hex)).toBe('REVERT opcode executed');
  });

  test('returns null when hex decodes to non-printable bytes (allows caller fallback to code field)', () => {
    // Binary data that is not printable ASCII — returning null lets parseTriggerResponse
    // fall through to the more readable result.code field instead of showing raw hex.
    expect(decodeTronMessage('deadbeef00ff')).toBeNull();
  });

  test('returns null when input is not valid hex', () => {
    expect(decodeTronMessage('not-a-hex-string')).toBeNull();
  });
});

// ─── parseTriggerResponse ─────────────────────────────────────────────────────

describe('parseTriggerResponse', () => {
  const MOCK_TX = {
    txID: 'abc123def456',
    raw_data: { contract: [] },
    raw_data_hex: 'aabbcc',
  };

  // ── Success path ──────────────────────────────────────────────────────────

  test('returns transaction on success (result.result: true + transaction present)', () => {
    const res = {
      result: { result: true },
      energy_used: 1000,
      transaction: MOCK_TX,
    };
    expect(parseTriggerResponse(res)).toBe(MOCK_TX);
  });

  test('returned transaction object is the exact transaction from the response', () => {
    const tx = { txID: 'xyz', raw_data: {}, raw_data_hex: '' };
    const res = { result: { result: true }, transaction: tx };
    expect(parseTriggerResponse(res)).toBe(tx);
  });

  // ── Format A: top-level Error field ──────────────────────────────────────

  test('throws with TRON node error prefix when top-level Error field is present', () => {
    const res = {
      Error: 'class org.tron.core.exception.ContractValidateException: No resource',
      result: {},
    };
    expect(() => parseTriggerResponse(res))
      .toThrow('TRON node error: class org.tron.core.exception.ContractValidateException: No resource');
  });

  test('throws from top-level Error even when result.result is true', () => {
    const res = {
      Error: 'internal error',
      result: { result: true },
      transaction: MOCK_TX,
    };
    expect(() => parseTriggerResponse(res)).toThrow('TRON node error: internal error');
  });

  // ── Format B: explicit result.result: false ───────────────────────────────

  test('throws decoded message when result.result is false and message is hex-encoded ASCII', () => {
    const hexMsg = Buffer.from('insufficient balance').toString('hex');
    const res = {
      result: { result: false, code: 'CONTRACT_EXE_ERROR', message: hexMsg },
    };
    expect(() => parseTriggerResponse(res)).toThrow('insufficient balance');
  });

  test('falls back to code when message is non-printable hex', () => {
    const res = {
      result: { result: false, code: 'CONTRACT_VALIDATE_ERROR', message: 'deadbeef00ff' },
    };
    expect(() => parseTriggerResponse(res)).toThrow('CONTRACT_VALIDATE_ERROR');
  });

  test('falls back to generic message when code and message both absent', () => {
    const res = { result: { result: false } };
    expect(() => parseTriggerResponse(res)).toThrow('TRC-20 call failed');
  });

  // ── Format B2: result.result absent (bug that caused the original error) ──

  test('throws when result.result is absent (undefined) — the original bug', () => {
    // Java-Tron v4.7.x sometimes omits result.result instead of setting it to false
    const res = {
      result: { code: 'CONTRACT_VALIDATE_ERROR', message: '' },
    };
    // Previously, `=== false` passed because `undefined !== false`, then the fallback
    // `triggerRes?.transaction ?? triggerRes` substituted the error response itself,
    // and `!unsignedTx?.txID` threw "No transaction returned from triggersmartcontract"
    // which hid the actual TRON error. Now we throw the correct error.
    expect(() => parseTriggerResponse(res)).toThrow('CONTRACT_VALIDATE_ERROR');
  });

  test('throws when result.result is null', () => {
    const res = { result: { result: null, code: 'NULL_RESULT' } };
    expect(() => parseTriggerResponse(res)).toThrow('NULL_RESULT');
  });

  test('throws when result object itself is absent', () => {
    const res = { transaction: MOCK_TX };
    expect(() => parseTriggerResponse(res)).toThrow('TRC-20 call failed');
  });

  test('throws when entire response is empty object', () => {
    expect(() => parseTriggerResponse({})).toThrow('TRC-20 call failed');
  });

  test('decodes hex message when result.result is absent but message is set', () => {
    const hexMsg = Buffer.from('Out of energy').toString('hex');
    const res = { result: { code: 'CONTRACT_VALIDATE_ERROR', message: hexMsg } };
    expect(() => parseTriggerResponse(res)).toThrow('Out of energy');
  });

  // ── Format C: result.result: true but transaction missing ────────────────

  test('throws when result.result is true but transaction is absent', () => {
    const res = { result: { result: true } };
    expect(() => parseTriggerResponse(res)).toThrow('No transaction returned from triggersmartcontract');
  });

  test('throws when transaction object exists but txID is missing', () => {
    const res = {
      result: { result: true },
      transaction: { raw_data: {}, raw_data_hex: '' },
    };
    expect(() => parseTriggerResponse(res)).toThrow('No transaction returned from triggersmartcontract');
  });

  test('throws when transaction is null', () => {
    const res = { result: { result: true }, transaction: null };
    expect(() => parseTriggerResponse(res)).toThrow('No transaction returned from triggersmartcontract');
  });
});

// ─── tronAddrToHex ────────────────────────────────────────────────────────────

describe('tronAddrToHex', () => {
  // TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY — genesis account used in docker-compose.v3.yml
  const GENESIS_ADDR = 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY';
  // TArKPsSpkm59zhxz1e49JpVv27sGy8NYge — hot wallet address from user error report
  const HOT_WALLET_ADDR = 'TArKPsSpkm59zhxz1e49JpVv27sGy8NYge';

  test('returns 42-character hex string (21 bytes = 0x41 prefix + 20-byte address)', () => {
    expect(tronAddrToHex(GENESIS_ADDR)).toHaveLength(42);
    expect(tronAddrToHex(HOT_WALLET_ADDR)).toHaveLength(42);
  });

  test('output starts with "41" (TRON address prefix byte)', () => {
    expect(tronAddrToHex(GENESIS_ADDR)).toMatch(/^41/);
    expect(tronAddrToHex(HOT_WALLET_ADDR)).toMatch(/^41/);
  });

  test('output is valid lowercase hex', () => {
    expect(tronAddrToHex(GENESIS_ADDR)).toMatch(/^[0-9a-f]+$/);
    expect(tronAddrToHex(HOT_WALLET_ADDR)).toMatch(/^[0-9a-f]+$/);
  });

  test('two different addresses produce different hex values', () => {
    expect(tronAddrToHex(GENESIS_ADDR)).not.toBe(tronAddrToHex(HOT_WALLET_ADDR));
  });

  test('throws on invalid base58 character', () => {
    expect(() => tronAddrToHex('T0invalid')).toThrow('Invalid base58 char');
  });
});

// ─── tronAddrTo20Hex ──────────────────────────────────────────────────────────

describe('tronAddrTo20Hex', () => {
  const GENESIS_ADDR = 'TPL66VK2gCXNCD7EJg9pgJRfqcRazjhUZY';
  const HOT_WALLET_ADDR = 'TArKPsSpkm59zhxz1e49JpVv27sGy8NYge';

  test('returns 40-character hex string (20 bytes for ABI encoding)', () => {
    expect(tronAddrTo20Hex(GENESIS_ADDR)).toHaveLength(40);
    expect(tronAddrTo20Hex(HOT_WALLET_ADDR)).toHaveLength(40);
  });

  test('does NOT start with "41" (0x41 prefix is stripped)', () => {
    expect(tronAddrTo20Hex(GENESIS_ADDR)).not.toMatch(/^41/);
  });

  test('output is valid lowercase hex', () => {
    expect(tronAddrTo20Hex(GENESIS_ADDR)).toMatch(/^[0-9a-f]+$/);
  });

  test('tronAddrTo20Hex equals tronAddrToHex with leading "41" stripped', () => {
    const hex21 = tronAddrToHex(GENESIS_ADDR);
    const hex20 = tronAddrTo20Hex(GENESIS_ADDR);
    // 21-byte hex: '41' + 20-byte hex → strip first 2 chars
    expect(hex20).toBe(hex21.slice(2));
  });

  test('two different addresses produce different 20-byte hex', () => {
    expect(tronAddrTo20Hex(GENESIS_ADDR)).not.toBe(tronAddrTo20Hex(HOT_WALLET_ADDR));
  });
});

// ─── ABI parameter encoding (integration of tronAddrTo20Hex) ─────────────────

describe('ABI parameter encoding for transfer(address,uint256)', () => {
  test('parameter is 128 hex chars (2 × 32-byte ABI words)', () => {
    const addr = 'TArKPsSpkm59zhxz1e49JpVv27sGy8NYge';
    const amount = BigInt(1_000_000_000); // 1000 USDT in micro-USDT
    const addr20hex = tronAddrTo20Hex(addr);
    const parameter = addr20hex.padStart(64, '0') + amount.toString(16).padStart(64, '0');
    expect(parameter).toHaveLength(128);
  });

  test('address word is zero-padded to 64 chars (12 zero-bytes prefix + 20-byte addr)', () => {
    const addr = 'TArKPsSpkm59zhxz1e49JpVv27sGy8NYge';
    const addr20hex = tronAddrTo20Hex(addr);
    const addrWord = addr20hex.padStart(64, '0');
    expect(addrWord).toHaveLength(64);
    // First 24 chars = 12 zero bytes (padding)
    expect(addrWord.slice(0, 24)).toBe('000000000000000000000000');
    // Last 40 chars = the 20-byte address
    expect(addrWord.slice(24)).toBe(addr20hex);
  });

  test('amount 1000000000 encodes correctly as padded uint256', () => {
    const amount = BigInt(1_000_000_000);
    const amountWord = amount.toString(16).padStart(64, '0');
    expect(amountWord).toBe('000000000000000000000000000000000000000000000000000000003b9aca00');
  });
});
