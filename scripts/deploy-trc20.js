#!/usr/bin/env node
/**
 * deploy-trc20.js — Deploy the TRC-20 USDT simulation contract on the TRON private network.
 *
 * Required env vars (set by start.sh before calling this script):
 *   TRON_NODE_URL           e.g. http://localhost:8090
 *   TRON_GENESIS_PRIV_HEX  64-char hex private key of genesis/deployer account
 *   TRC20_BYTECODE          hex deployment bytecode (produced by step_compile_trc20 in start.sh)
 *   TRON_TOTAL_SUPPLY_SUN   optional, default 1_000_000_000_000_000 (1 billion USDT, 6 decimals)
 *
 * Outputs:
 *   CONTRACT_ADDRESS=<base58-check TRON address>  (to stdout, parsed by start.sh)
 *
 * Dependencies (all in engine/node_modules or Node.js builtins):
 *   tiny-secp256k1, bs58check  — via require() with explicit paths
 */

'use strict';

const path = require('path');
const ENGINE_MODULES = path.resolve(__dirname, '../../engine/node_modules');

const secp256k1 = require(path.join(ENGINE_MODULES, 'tiny-secp256k1'));
const bs58check = require(path.join(ENGINE_MODULES, 'bs58check'));

const TRON_NODE_URL   = (process.env.TRON_NODE_URL   || 'http://localhost:8090').replace(/\/$/, '');
const GENESIS_PRIV    = process.env.TRON_GENESIS_PRIV_HEX;
const BYTECODE        = process.env.TRC20_BYTECODE;
const TOTAL_SUPPLY    = process.env.TRON_TOTAL_SUPPLY_SUN || '1000000000000000'; // 1B USDT (6 decimals)
const FEE_LIMIT       = 1_000_000_000; // 1000 TRX in sun

if (!GENESIS_PRIV) {
  console.error('[deploy-trc20] TRON_GENESIS_PRIV_HEX not set');
  process.exit(1);
}
if (!BYTECODE) {
  console.error('[deploy-trc20] TRC20_BYTECODE not set — compile the contract first (step_compile_trc20)');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Address helpers
// ---------------------------------------------------------------------------

const { keccak_256 } = require(path.join(ENGINE_MODULES, '@noble/hashes/sha3'));

function privateKeyToAddress(privHex) {
  const privBytes = Buffer.from(privHex, 'hex');
  const pubKey = secp256k1.pointFromScalar(privBytes, false); // uncompressed, 65 bytes
  // keccak256 of the uncompressed pubkey without the 0x04 prefix → last 20 bytes = ETH/TRON address
  const addrHash = keccak_256(pubKey.slice(1)); // 32 bytes
  const addrBytes = addrHash.slice(-20);  // last 20 bytes
  // TRON prefix byte: 0x41
  const payload = Buffer.concat([Buffer.from([0x41]), Buffer.from(addrBytes)]);
  return bs58check.encode(payload); // returns base58check string
}

function base58ToHex(addr) {
  const decoded = bs58check.decode(addr); // Buffer: 0x41 + 20 bytes
  return Buffer.from(decoded).toString('hex');
}

// ---------------------------------------------------------------------------
// ABI encoding helpers
// ---------------------------------------------------------------------------

function abiEncodeUint256(n) {
  return BigInt(n).toString(16).padStart(64, '0');
}

// ---------------------------------------------------------------------------
// TRON HTTP API helpers
// ---------------------------------------------------------------------------

async function post(path_, body) {
  const res = await fetch(`${TRON_NODE_URL}${path_}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`TRON HTTP ${res.status} for ${path_}: ${text}`);
  }
  return res.json();
}

function signTxId(txIdHex, privHex) {
  const txIdBytes = Buffer.from(txIdHex, 'hex');
  const privBytes = Buffer.from(privHex, 'hex');
  const { signature, recoveryId } = secp256k1.signRecoverable(txIdBytes, privBytes);
  return Buffer.concat([Buffer.from(signature), Buffer.from([recoveryId])]).toString('hex');
}

async function waitForConfirmation(txId, maxWaitMs = 60_000) {
  const poll = 3_000;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, poll));
    const info = await post('/wallet/gettransactioninfobyid', { value: txId });
    if (info && info.id) {
      if (info.receipt && info.receipt.result === 'FAILED') {
        throw new Error(`Transaction ${txId} failed: ${JSON.stringify(info.receipt)}`);
      }
      return info;
    }
  }
  throw new Error(`Transaction ${txId} not confirmed after ${maxWaitMs}ms`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.error('[deploy-trc20] Starting TRC-20 USDT deployment on private TRON network...');

  const ownerAddress58 = privateKeyToAddress(GENESIS_PRIV);
  const ownerAddressHex = base58ToHex(ownerAddress58);
  console.error(`[deploy-trc20] Deployer: ${ownerAddress58}`);

  // ABI-encoded constructor arg: uint256 supply
  const constructorParam = abiEncodeUint256(TOTAL_SUPPLY);

  // Build the CreateSmartContract transaction
  const deployBody = {
    owner_address: ownerAddressHex,
    fee_limit: FEE_LIMIT,
    call_value: 0,
    consume_user_resource_percent: 100,
    origin_energy_limit: 10_000_000,
    bytecode: BYTECODE,
    parameter: constructorParam,
    name: 'TetherToken',
    abi: JSON.stringify({
      entrys: [
        { name: 'Transfer',  type: 'Event',    inputs: [{ indexed: true, name: 'from', type: 'address' }, { indexed: true, name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }] },
        { name: 'Approval',  type: 'Event',    inputs: [{ indexed: true, name: 'owner', type: 'address' }, { indexed: true, name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }] },
        { name: '',          type: 'Constructor', inputs: [{ name: 'supply', type: 'uint256' }], stateMutability: 'nonpayable' },
        { name: 'totalSupply',   type: 'Function', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', inputs: [] },
        { name: 'balanceOf',     type: 'Function', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', inputs: [{ name: '', type: 'address' }] },
        { name: 'allowance',     type: 'Function', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', inputs: [{ name: '', type: 'address' }, { name: '', type: 'address' }] },
        { name: 'transfer',      type: 'Function', outputs: [{ name: '', type: 'bool' }],    stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }] },
        { name: 'approve',       type: 'Function', outputs: [{ name: '', type: 'bool' }],    stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }] },
        { name: 'transferFrom',  type: 'Function', outputs: [{ name: '', type: 'bool' }],    stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }] },
      ],
    }),
  };

  console.error('[deploy-trc20] Building CreateSmartContract transaction...');
  const unsignedTx = await post('/wallet/deploycontract', deployBody);

  if (!unsignedTx.txID) {
    throw new Error(`deploycontract returned no txID: ${JSON.stringify(unsignedTx)}`);
  }
  console.error(`[deploy-trc20] Unsigned txID: ${unsignedTx.txID}`);

  const sigHex = signTxId(unsignedTx.txID, GENESIS_PRIV);
  const signedTx = { ...unsignedTx, signature: [sigHex] };

  console.error('[deploy-trc20] Broadcasting signed transaction...');
  const broadcastResult = await post('/wallet/broadcasttransaction', signedTx);
  if (!broadcastResult.result) {
    throw new Error(`Broadcast failed: ${JSON.stringify(broadcastResult)}`);
  }
  console.error(`[deploy-trc20] Broadcast OK. Waiting for confirmation...`);

  const txInfo = await waitForConfirmation(unsignedTx.txID);

  // Contract address is in txInfo.contract_address (hex without 0x, prefixed with 41)
  const contractAddressHex = txInfo.contract_address;
  if (!contractAddressHex) {
    throw new Error(`No contract_address in txInfo: ${JSON.stringify(txInfo)}`);
  }

  // Convert hex address (41...) to Base58Check
  const contractBytes = Buffer.from(contractAddressHex, 'hex');
  const contractAddress58 = bs58check.encode(contractBytes);

  console.error(`[deploy-trc20] Contract deployed at: ${contractAddress58}`);

  // Output for start.sh to capture
  process.stdout.write(`CONTRACT_ADDRESS=${contractAddress58}\n`);
}

main().catch(err => {
  console.error(`[deploy-trc20] FATAL: ${err.message}`);
  process.exit(1);
});
