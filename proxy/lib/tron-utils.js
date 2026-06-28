'use strict';

// ─── Base58 helpers ───────────────────────────────────────────────────────────

const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58ToBytes(str) {
  const bytes = [0];
  for (const c of str) {
    let carry = BASE58_CHARS.indexOf(c);
    if (carry < 0) throw new Error(`Invalid base58 char: ${c}`);
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let i = 0; str[i] === '1'; i++) bytes.push(0);
  return Buffer.from(bytes.reverse());
}

// Returns 21-byte hex with 0x41 prefix for TRON RPC calls (non-visible mode)
function tronAddrToHex(base58Addr) {
  const buf = base58ToBytes(base58Addr); // 25 bytes: prefix(1) + addr(20) + checksum(4)
  return buf.slice(0, 21).toString('hex'); // '41' + 20 bytes = 42 hex chars
}

// Returns 20-byte hex for ABI encoding (strips 0x41 prefix)
function tronAddrTo20Hex(base58Addr) {
  const buf = base58ToBytes(base58Addr); // 25 bytes: prefix(1) + addr(20) + checksum(4)
  return buf.slice(1, 21).toString('hex'); // 20 bytes = 40 hex chars
}

// ─── Error message decoder ────────────────────────────────────────────────────

/**
 * TRON FullNode encodes error messages as hex-encoded ASCII strings.
 * Returns the decoded string when the hex decodes to printable ASCII,
 * otherwise returns the original hex string unchanged.
 * Returns null when input is falsy.
 */
function decodeTronMessage(hexStr) {
  if (!hexStr) return null;
  try {
    const buf = Buffer.from(hexStr, 'hex');
    if (buf.length === 0) return null;
    const str = buf.toString('utf8');
    // Return decoded string only when all chars are printable ASCII / whitespace.
    // Return null otherwise so callers can fall through to a more readable code/label.
    return /^[\x20-\x7e\s]+$/.test(str.trim()) ? str.trim() : null;
  } catch {
    return null;
  }
}

// ─── triggersmartcontract response validator ──────────────────────────────────

/**
 * Validate the response from TRON FullNode `wallet/triggersmartcontract` and
 * return the transaction object on success.
 *
 * Java-Tron v4.7.x returns errors in three distinct formats:
 *   A) { "Error": "class ...", "result": {} }          — top-level Error field
 *   B) { "result": { "result": false, "code": "...", "message": "<hex>" } }
 *   B2) { "result": { "code": "...", "message": "<hex>" } }  — result.result absent
 *   C) { "result": { "result": true } }               — success but missing transaction
 *
 * The previous check `result?.result === false` only caught format B.
 * Formats A and B2 bypassed the check, causing a misleading
 * "No transaction returned from triggersmartcontract" error that hid the real cause.
 *
 * @param {object} triggerRes — raw JSON response from tronPost()
 * @returns {object} transaction — the unsigned transaction (has txID, raw_data, raw_data_hex)
 * @throws {Error} with a readable message on any failure
 */
function parseTriggerResponse(triggerRes) {
  // Format A: top-level Error field used by some Java-Tron internal error paths
  if (triggerRes?.Error) {
    throw new Error(`TRON node error: ${triggerRes.Error}`);
  }

  // Format B / B2: result.result is false, null, or absent — all signal failure.
  // Previous code used `=== false` which missed absent/null cases (B2).
  if (!triggerRes?.result?.result) {
    const decoded = decodeTronMessage(triggerRes?.result?.message);
    throw new Error(decoded || triggerRes?.result?.code || 'TRC-20 call failed');
  }

  // Format C: TRON returned result.result:true but no transaction (should not happen
  // in a healthy node, but guards against partial / malformed responses).
  if (!triggerRes?.transaction?.txID) {
    throw new Error('No transaction returned from triggersmartcontract');
  }

  return triggerRes.transaction;
}

module.exports = {
  BASE58_CHARS,
  base58ToBytes,
  tronAddrToHex,
  tronAddrTo20Hex,
  decodeTronMessage,
  parseTriggerResponse,
};
