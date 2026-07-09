#!/usr/bin/env node
/**
 * fund-tron-hot-wallet.js — Activate + fund the TRON hot wallet from the genesis account.
 *
 * Required env vars (set by start.sh):
 *   TRON_NODE_URL               e.g. http://localhost:8090
 *   TRON_GENESIS_PRIV_HEX      64-char hex — genesis/deployer private key
 *   TRON_HOT_ADDRESS           base58check TRON address of the hot wallet
 *   TRON_USDT_CONTRACT_ADDRESS base58check address of the deployed TRC-20 USDT contract
 *
 * What it does:
 *   1. Sends TRX_AMOUNT_SUN TRX from genesis → hot wallet (activates the account)
 *   2. Sends USDT_AMOUNT (in sun, 6 decimals) USDT from genesis → hot wallet
 *
 * Dependencies: tiny-secp256k1, bs58check, @noble/hashes — all in engine/node_modules
 */

'use strict';

const path = require('path');
const ENGINE_MODULES = path.resolve(__dirname, '../../engine/node_modules');

const secp256k1 = require(path.join(ENGINE_MODULES, 'tiny-secp256k1'));
const bs58check  = require(path.join(ENGINE_MODULES, 'bs58check'));
const { keccak_256 } = require(path.join(ENGINE_MODULES, '@noble/hashes/sha3'));

const TRON_NODE_URL   = (process.env.TRON_NODE_URL   || 'http://localhost:8090').replace(/\/$/, '');
const GENESIS_PRIV    = process.env.TRON_GENESIS_PRIV_HEX;
const HOT_ADDRESS     = process.env.TRON_HOT_ADDRESS;
const USDT_CONTRACT   = process.env.TRON_USDT_CONTRACT_ADDRESS;

// 500 TRX (enough for many fee payments), 10M USDT (plenty for dev testing)
const TRX_AMOUNT_SUN  = BigInt(process.env.TRON_FUND_TRX_SUN  || '500000000');     // 500 TRX
const USDT_AMOUNT_SUN = BigInt(process.env.TRON_FUND_USDT_SUN || '10000000000000'); // 10M USDT (6 dec)

if (!GENESIS_PRIV || !HOT_ADDRESS || !USDT_CONTRACT) {
  console.error('[fund-tron-hot-wallet] Missing required env vars: TRON_GENESIS_PRIV_HEX, TRON_HOT_ADDRESS, TRON_USDT_CONTRACT_ADDRESS');
  process.exit(1);
}

// ── Address helpers ──────────────────────────────────────────────────────────

function privateKeyToAddress(privHex) {
  const privBytes = Buffer.from(privHex, 'hex');
  const pubKey    = secp256k1.pointFromScalar(privBytes, false); // uncompressed, 65 bytes
  const addrHash  = keccak_256(pubKey.slice(1));
  const addrBytes = addrHash.slice(-20);
  const payload   = Buffer.concat([Buffer.from([0x41]), Buffer.from(addrBytes)]);
  return bs58check.encode(payload);
}

function base58ToHex(addr) {
  return Buffer.from(bs58check.decode(addr)).toString('hex');
}

// ── ABI ─────────────────────────────────────────────────────────────────────

function abiUint256(n) {
  return BigInt(n).toString(16).padStart(64, '0');
}

function abiAddress(addr) {
  // strip the leading 41 prefix byte (1 byte) → 20-byte address → padded to 32 bytes
  return base58ToHex(addr).slice(2).padStart(64, '0');
}

// ── TRON HTTP helpers ────────────────────────────────────────────────────────

async function post(path_, body) {
  const res = await fetch(`${TRON_NODE_URL}${path_}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} at ${path_}`);
  return res.json();
}

function signTx(txData, privHex) {
  const txIdBytes = Buffer.from(txData.txID, 'hex');
  const privBytes  = Buffer.from(privHex, 'hex');
  const sigRaw     = secp256k1.sign(txIdBytes, privBytes);
  // sigRaw is 64 bytes (r + s). TRON needs 65 bytes with recovery ID appended.
  // Derive v by trying 0 and 1 against known public key.
  const pubKey = secp256k1.pointFromScalar(privBytes, true); // compressed
  for (let v = 0; v <= 1; v++) {
    try {
      const recovered = secp256k1.recover(txIdBytes, sigRaw, v, true);
      if (Buffer.from(recovered).equals(Buffer.from(pubKey))) {
        const sig65 = Buffer.concat([Buffer.from(sigRaw), Buffer.from([v])]);
        return sig65.toString('hex');
      }
    } catch {}
  }
  throw new Error('Could not determine recovery ID for TRON signature');
}

async function broadcastTx(txData, privHex) {
  const signature = signTx(txData, privHex);
  const signed = { ...txData, signature: [signature] };
  const res = await post('/wallet/broadcasttransaction', signed);
  if (!res.result) {
    const code = res.code || 'unknown';
    const msg  = res.message ? Buffer.from(res.message, 'hex').toString('utf8') : JSON.stringify(res);
    throw new Error(`Broadcast failed: ${code}: ${msg}`);
  }
  return res;
}

async function waitForTx(txId, maxWaitMs = 30_000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const info = await post('/wallet/gettransactioninfobyid', { value: txId });
    if (info && info.id) return info;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Transaction ${txId} not confirmed after ${maxWaitMs / 1000}s`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const genesisAddr = privateKeyToAddress(GENESIS_PRIV);
  process.stderr.write(`[fund-tron-hot-wallet] Genesis address: ${genesisAddr}\n`);
  process.stderr.write(`[fund-tron-hot-wallet] Hot wallet:      ${HOT_ADDRESS}\n`);
  process.stderr.write(`[fund-tron-hot-wallet] USDT contract:   ${USDT_CONTRACT}\n`);

  // ── Check if hot wallet already has TRX (idempotency) ────────────────────
  const acctInfo = await post('/wallet/getaccount', { address: HOT_ADDRESS, visible: true });
  const existingTrx = BigInt(acctInfo.balance || 0);
  if (existingTrx >= TRX_AMOUNT_SUN) {
    process.stderr.write(`[fund-tron-hot-wallet] Hot wallet already has ${existingTrx} sun TRX — skipping TRX transfer\n`);
  } else {
    // ── Step 1: TRX transfer (activates the account) ──────────────────────
    process.stderr.write(`[fund-tron-hot-wallet] Sending ${TRX_AMOUNT_SUN} sun TRX to hot wallet...\n`);
    const trxTx = await post('/wallet/createtransaction', {
      owner_address: genesisAddr,
      to_address:    HOT_ADDRESS,
      amount:        Number(TRX_AMOUNT_SUN),
      visible:       true,
    });
    if (!trxTx.txID) throw new Error(`createtransaction failed: ${JSON.stringify(trxTx)}`);
    await broadcastTx(trxTx, GENESIS_PRIV);
    process.stderr.write(`[fund-tron-hot-wallet] TRX sent: txID=${trxTx.txID} — waiting for confirmation...\n`);
    await waitForTx(trxTx.txID);
    process.stderr.write(`[fund-tron-hot-wallet] TRX confirmed ✓\n`);
  }

  // ── Step 2: USDT TRC-20 transfer (idempotent) ────────────────────────────
  const balanceRes = await post('/wallet/triggerconstantcontract', {
    owner_address:     genesisAddr,
    contract_address:  USDT_CONTRACT,
    function_selector: 'balanceOf(address)',
    parameter:         abiAddress(HOT_ADDRESS),
    visible:           true,
  });
  const balanceHex = (balanceRes.constant_result || [])[0] || '0'.repeat(64);
  const existingUsdt = BigInt(`0x${balanceHex}`);
  if (existingUsdt >= USDT_AMOUNT_SUN) {
    process.stderr.write(`[fund-tron-hot-wallet] Hot wallet already has ${existingUsdt} sun USDT — skipping USDT transfer\n`);
    process.stdout.write(`FUNDED hot_address=${HOT_ADDRESS} trx_sun=${TRX_AMOUNT_SUN} usdt_sun=0 (already funded)\n`);
    return;
  }
  process.stderr.write(`[fund-tron-hot-wallet] Sending ${USDT_AMOUNT_SUN} sun USDT to hot wallet...\n`);

  // ABI encode: transfer(address,uint256)
  const usdtTx = await post('/wallet/triggersmartcontract', {
    owner_address:     genesisAddr,
    contract_address:  USDT_CONTRACT,
    function_selector: 'transfer(address,uint256)',
    parameter:         abiAddress(HOT_ADDRESS) + abiUint256(USDT_AMOUNT_SUN),
    fee_limit:         50_000_000, // 50 TRX
    call_value:        0,
    visible:           true,
  });

  if (!usdtTx.transaction || !usdtTx.transaction.txID) {
    throw new Error(`triggersmartcontract failed: ${JSON.stringify(usdtTx)}`);
  }

  await broadcastTx(usdtTx.transaction, GENESIS_PRIV);
  process.stderr.write(`[fund-tron-hot-wallet] USDT sent: txID=${usdtTx.transaction.txID} — waiting for confirmation...\n`);
  await waitForTx(usdtTx.transaction.txID);
  process.stderr.write(`[fund-tron-hot-wallet] USDT confirmed ✓\n`);

  process.stdout.write(`FUNDED hot_address=${HOT_ADDRESS} trx_sun=${TRX_AMOUNT_SUN} usdt_sun=${USDT_AMOUNT_SUN}\n`);
})().catch(err => {
  console.error('[fund-tron-hot-wallet] FATAL:', err.message);
  process.exit(1);
});
