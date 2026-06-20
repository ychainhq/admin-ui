/**
 * btc-test-ui proxy server — v3 compatible
 *
 * v3 changes:
 *  - Multi-BTC-node support: /rpc accepts nodeId to route to specific Bitcoin Core
 *  - /config returns all configured BTC nodes (for NodeListView)
 *  - /engine-health proxies health checks for all configured engine instances
 *  - /mining/* mining operations (mine blocks, list wallets) routed to miner node
 *
 * Env vars:
 *  BITCOIN_RPC_URL       — node-1 (default, miner in regtest)
 *  BITCOIN_RPC_USER      — shared or per node (default: bitcoin)
 *  BITCOIN_RPC_PASSWORD  — shared or per node
 *  BITCOIN_WALLET        — mining wallet name (default: btcminer)
 *  BITCOIN_RPC_URL_2     — optional node-2 (standby/sync verification)
 *  BITCOIN_RPC_USER_2    — optional, falls back to BITCOIN_RPC_USER
 *  BITCOIN_RPC_PASSWORD_2 — optional, falls back to BITCOIN_RPC_PASSWORD
 *  CHAIN_API_URL         — engine URL (v3: point to nginx :3009)
 *  CHAIN_API_ADMIN_KEY   — platform admin key
 *  CHAIN_API_KEY         — default tenant API key
 *  ENGINE_URL_2          — optional second engine (for health monitoring only)
 */

const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── BTC nodes configuration ──────────────────────────────────────────────────
// Node 1: primary / miner in regtest
const BTC_NODES = [
  {
    id:       'btc-node-1',
    label:    'Bitcoin Core Node 1',
    url:      process.env.BITCOIN_RPC_URL       || 'http://localhost:18443',
    user:     process.env.BITCOIN_RPC_USER      || 'bitcoin',
    password: process.env.BITCOIN_RPC_PASSWORD  || 'bitcoin',
    wallet:   process.env.BITCOIN_WALLET        || 'btcminer',
    isMiner:  true,
  },
];

// Node 2: optional (v3 standby/sync)
if (process.env.BITCOIN_RPC_URL_2) {
  BTC_NODES.push({
    id:       'btc-node-2',
    label:    'Bitcoin Core Node 2',
    url:      process.env.BITCOIN_RPC_URL_2,
    user:     process.env.BITCOIN_RPC_USER_2     || process.env.BITCOIN_RPC_USER     || 'bitcoin',
    password: process.env.BITCOIN_RPC_PASSWORD_2 || process.env.BITCOIN_RPC_PASSWORD  || 'bitcoin',
    wallet:   process.env.BITCOIN_WALLET_2       || process.env.BITCOIN_WALLET        || 'btcminer',
    isMiner:  false,
  });
}

function getNodeAuth(node) {
  return Buffer.from(`${node.user}:${node.password}`).toString('base64');
}

function getNodeById(nodeId) {
  return BTC_NODES.find(n => n.id === nodeId) || BTC_NODES[0];
}

// ─── TRON node configuration ──────────────────────────────────────────────────
const TRON_NODE_URL       = process.env.TRON_NODE_URL        || 'http://localhost:8090';
const TRON_DEV_PRIVATE_KEY = process.env.TRON_DEV_PRIVATE_KEY || '';
const TRON_DEV_ADDRESS    = process.env.TRON_DEV_ADDRESS     || '';
const TRON_USDT_CONTRACT  = process.env.TRON_USDT_CONTRACT   || '';

// POST to TRON FullNode HTTP API. Throws on non-200 response.
async function tronPost(tronPath, body) {
  const r = await fetch(`${TRON_NODE_URL}/${tronPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`TRON API ${r.status}: ${JSON.stringify(json)}`);
  return json;
}

// Minimal base58 decode for TRON addresses (no external deps)
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

// Returns 20-byte hex for ABI encoding (strips 0x41 prefix + 4-byte checksum)
function tronAddrTo20Hex(base58Addr) {
  const buf = base58ToBytes(base58Addr); // 25 bytes: prefix(1) + addr(20) + checksum(4)
  return buf.slice(1, 21).toString('hex');
}

// ─── Engine configuration ─────────────────────────────────────────────────────
const CHAIN_API_URL       = process.env.CHAIN_API_URL       || 'http://localhost:3000';
const CHAIN_API_ADMIN_KEY = process.env.CHAIN_API_ADMIN_KEY || '';

// v3: optional second engine URL for health display (routing via nginx, not here)
const ENGINE_URLS = [CHAIN_API_URL];
if (process.env.ENGINE_URL_2) ENGINE_URLS.push(process.env.ENGINE_URL_2);

let activeTenantKey = process.env.CHAIN_API_KEY || '';
const tenantKeyCache = {};

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'ui')));

// ─── Config endpoint ──────────────────────────────────────────────────────────
// Returns proxy configuration for the UI — including all BTC nodes.
app.get('/config', (req, res) => {
  res.json({
    // Legacy single-node fields (backward compat for default mode)
    wallet:      BTC_NODES[0].wallet,
    rpcUrl:      BTC_NODES[0].url,
    rpcUser:     BTC_NODES[0].user,
    chainApiUrl: CHAIN_API_URL,
    hasApiKey:   !!activeTenantKey,
    hasAdminKey: !!CHAIN_API_ADMIN_KEY,

    // v3: all configured BTC nodes
    btcNodes: BTC_NODES.map(n => ({
      id:      n.id,
      label:   n.label,
      url:     n.url,
      wallet:  n.wallet,
      isMiner: n.isMiner,
    })),

    // v3: engine URLs (for health monitoring display)
    engineUrls: ENGINE_URLS,
    isV3: BTC_NODES.length > 1 || ENGINE_URLS.length > 1,

    // TRON dev node settings
    tronNodeUrl:     TRON_NODE_URL,
    hasTronDevKey:   !!(TRON_DEV_PRIVATE_KEY && TRON_DEV_ADDRESS),
    tronDevAddress:  TRON_DEV_ADDRESS || null,
    tronUsdtContract: TRON_USDT_CONTRACT || null,
  });
});

// ─── Engine health check ──────────────────────────────────────────────────────
// GET /engine-health → checks all configured engine URLs
app.get('/engine-health', async (req, res) => {
  const results = await Promise.all(
    ENGINE_URLS.map(async (url) => {
      try {
        const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
        return { url, ok: r.ok, status: r.status };
      } catch (err) {
        return { url, ok: false, status: 0, error: err.message };
      }
    })
  );
  res.json({ engines: results });
});

// ─── Tenant switching ─────────────────────────────────────────────────────────
app.post('/switch-tenant', async (req, res) => {
  const { tenantId } = req.body;
  if (!tenantId)      return res.status(400).json({ error: { message: 'tenantId required' } });
  if (!CHAIN_API_ADMIN_KEY) return res.status(400).json({ error: { message: 'Admin key not configured' } });

  if (tenantKeyCache[tenantId]) return res.json({ key: tenantKeyCache[tenantId] });

  try {
    const r = await fetch(`${CHAIN_API_URL}/admin/v1/tenants/${tenantId}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': CHAIN_API_ADMIN_KEY },
      body: JSON.stringify({ name: 'ui-session' }),
    });
    const body = await r.json();
    if (!r.ok) throw new Error(body?.error?.message || body?.message || `Engine error ${r.status}`);
    const key = body.data?.apiKey || body.key;
    if (!key) throw new Error('API key not in response: ' + JSON.stringify(body));
    tenantKeyCache[tenantId] = key;
    res.json({ key });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

app.post('/register-tenant-key', (req, res) => {
  const { tenantId } = req.body;
  if (tenantId && activeTenantKey && !tenantKeyCache[tenantId]) {
    tenantKeyCache[tenantId] = activeTenantKey;
  }
  res.json({ success: true });
});

// ─── TRON FullNode HTTP proxy ─────────────────────────────────────────────────
// POST /tron-rpc { path, body }
// Forwards to TRON_NODE_URL/{path}. No auth by default (TRON private net).

app.post('/tron-rpc', async (req, res) => {
  const { path: tronPath, body } = req.body;
  if (!tronPath) return res.status(400).json({ error: { message: 'path required' } });
  try {
    // Use tronPost but always respond with 200 (lenient — node may return 4xx for unknown addresses)
    const r = await fetch(`${TRON_NODE_URL}/${tronPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(10000),
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }
    res.status(200).json(json);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /tron-fund { toAddress, amount, asset: 'trx'|'usdt', contractAddress? }
// Funds a TRON address from the configured dev account (server-side signing via TRON node).
// Requires TRON_DEV_PRIVATE_KEY + TRON_DEV_ADDRESS env vars.

app.post('/tron-fund', async (req, res) => {
  if (!TRON_DEV_PRIVATE_KEY || !TRON_DEV_ADDRESS) {
    return res.status(400).json({ error: { message: 'Dev key not configured — set TRON_DEV_PRIVATE_KEY and TRON_DEV_ADDRESS in proxy env.' } });
  }
  const { toAddress, amount, asset = 'trx', contractAddress } = req.body;
  if (!toAddress) return res.status(400).json({ error: { message: 'toAddress required' } });
  if (!amount)    return res.status(400).json({ error: { message: 'amount required' } });

  try {
    let unsignedTx;

    if (asset === 'trx') {
      unsignedTx = await tronPost('wallet/createtransaction', {
        owner_address: TRON_DEV_ADDRESS,
        to_address:    toAddress,
        amount:        Number(amount),
        visible:       true,
      });
      if (unsignedTx?.Error || !unsignedTx?.txID) {
        throw new Error(unsignedTx?.Error || 'Failed to create TRX transaction');
      }
    } else {
      // TRC-20 transfer(address,uint256)
      const contract = contractAddress || TRON_USDT_CONTRACT;
      if (!contract) throw new Error('contractAddress required for TRC-20 transfer');
      const addr20hex = tronAddrTo20Hex(toAddress);
      const parameter = addr20hex.padStart(64, '0') + BigInt(amount).toString(16).padStart(64, '0');
      const triggerRes = await tronPost('wallet/triggersmartcontract', {
        owner_address:     TRON_DEV_ADDRESS,
        contract_address:  contract,
        function_selector: 'transfer(address,uint256)',
        parameter,
        fee_limit:         40000000,
        call_value:        0,
        visible:           true,
      });
      if (triggerRes?.result?.result === false) {
        throw new Error(triggerRes?.result?.message || 'TRC-20 transfer creation failed');
      }
      unsignedTx = triggerRes?.transaction ?? triggerRes;
      if (!unsignedTx?.txID) throw new Error('No transaction returned from triggersmartcontract');
    }

    // Sign on the TRON node (private key never leaves proxy)
    const signedTx = await tronPost('wallet/gettransactionsign', {
      transaction: unsignedTx,
      privateKey:  TRON_DEV_PRIVATE_KEY,
    });
    if (signedTx?.Error) throw new Error(signedTx.Error);
    if (!signedTx?.signature?.length) throw new Error('Signing failed — no signature returned');

    // Broadcast
    const broadcastRes = await tronPost('wallet/broadcasttransaction', signedTx);
    if (!broadcastRes.result) {
      throw new Error(broadcastRes?.message || broadcastRes?.code || 'Broadcast failed');
    }

    res.json({ txid: broadcastRes.txid || signedTx.txID, result: true });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── Bitcoin Core RPC proxy ───────────────────────────────────────────────────
// POST /rpc { method, params, nodeId?, wallet?, useWallet? }
// nodeId: 'btc-node-1' (default) or 'btc-node-2'
// Routes to the appropriate BTC node in v3.

app.post('/rpc', async (req, res) => {
  const { nodeId, useWallet, wallet, method, params } = req.body;
  const node = getNodeById(nodeId);
  const walletPath = wallet
    ? `/wallet/${encodeURIComponent(wallet)}`
    : (useWallet ? `/wallet/${node.wallet}` : '');
  const url = `${node.url}${walletPath}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${getNodeAuth(node)}`,
      },
      body: JSON.stringify({
        jsonrpc: '1.0',
        id:      'chain-api-test-ui',
        method:  method,
        params:  params || [],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      res.status(response.status).json(await response.json());
    } else {
      const text = await response.text();
      res.status(response.status).json({ error: { code: response.status, message: text } });
    }
  } catch (err) {
    res.status(500).json({ error: { code: -1, message: err.message, nodeId: node.id } });
  }
});

// ─── Mining operations ────────────────────────────────────────────────────────
// POST /mining/generate { blocks, address? }
// Mines blocks on the miner node (btc-node-1). Separate from /rpc so the UI
// doesn't need to know which node is the miner.

app.post('/mining/generate', async (req, res) => {
  const { blocks = 1, address } = req.body;
  const miner = BTC_NODES.find(n => n.isMiner) || BTC_NODES[0];

  try {
    // Get a fresh address if none provided
    let toAddress = address;
    if (!toAddress) {
      const addrRes = await fetch(`${miner.url}/wallet/${miner.wallet}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${getNodeAuth(miner)}` },
        body: JSON.stringify({ jsonrpc: '1.0', id: 'mine', method: 'getnewaddress', params: ['mine', 'bech32'] }),
        signal: AbortSignal.timeout(5000),
      });
      const addrBody = await addrRes.json();
      toAddress = addrBody.result;
    }

    const response = await fetch(`${miner.url}/wallet/${miner.wallet}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${getNodeAuth(miner)}` },
      body: JSON.stringify({
        jsonrpc: '1.0', id: 'mine',
        method: 'generatetoaddress',
        params: [blocks, toAddress],
      }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    res.status(response.status).json({
      ...body,
      minerNode: miner.id,
      toAddress,
    });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// ─── chain-api customer-session proxy  (/customer/* → engine /v1/*) ──────────

app.all('/customer/*', async (req, res) => {
  const subPath = req.path.slice('/customer'.length);
  let url = `${CHAIN_API_URL}/v1${subPath}`;
  const qs = new URLSearchParams(req.query).toString();
  if (qs) url += '?' + qs;

  const sessionToken = req.headers['x-session-token'];
  if (!sessionToken) return res.status(401).json({ error: { message: 'x-session-token header required' } });

  try {
    const opts = {
      method:  req.method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionToken}` },
    };
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      opts.body = JSON.stringify(req.body);
    }
    const response = await fetch(url, opts);
    const ct = response.headers.get('content-type') || '';
    res.status(response.status).json(
      ct.includes('application/json') ? await response.json() : { error: { message: await response.text() } }
    );
  } catch (err) {
    res.status(502).json({ error: { message: `Engine unreachable: ${err.message}` } });
  }
});

// ─── chain-api tenant proxy  (/api/* → engine /v1/*) ─────────────────────────

app.all('/api/*', async (req, res) => {
  const subPath = req.path.slice('/api'.length);
  let url = `${CHAIN_API_URL}/v1${subPath}`;
  const qs = new URLSearchParams(req.query).toString();
  if (qs) url += '?' + qs;

  const tenantKey = req.headers['x-tenant-key'] || activeTenantKey;

  try {
    const opts = {
      method:  req.method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tenantKey}` },
    };
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      opts.body = JSON.stringify(req.body);
    }
    const response = await fetch(url, opts);
    const ct = response.headers.get('content-type') || '';
    res.status(response.status).json(
      ct.includes('application/json') ? await response.json() : { error: { message: await response.text() } }
    );
  } catch (err) {
    res.status(502).json({ error: { message: `Engine unreachable: ${err.message}` } });
  }
});

// ─── chain-api admin proxy  (/admin-api/* → engine /admin/v1/*) ──────────────

app.all('/admin-api/*', async (req, res) => {
  const subPath = req.path.slice('/admin-api'.length);
  let url = `${CHAIN_API_URL}/admin/v1${subPath}`;
  const qs = new URLSearchParams(req.query).toString();
  if (qs) url += '?' + qs;

  try {
    const opts = {
      method:  req.method,
      headers: { 'Content-Type': 'application/json', 'X-Admin-Key': CHAIN_API_ADMIN_KEY },
    };
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      opts.body = JSON.stringify(req.body);
    }
    const response = await fetch(url, opts);
    const ct = response.headers.get('content-type') || '';
    res.status(response.status).json(
      ct.includes('application/json') ? await response.json() : { error: { message: await response.text() } }
    );
  } catch (err) {
    res.status(502).json({ error: { message: `Engine unreachable: ${err.message}` } });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Bitcoin Regtest UI  →  http://localhost:${PORT}`);
  console.log(`  BTC nodes (${BTC_NODES.length}):`);
  BTC_NODES.forEach(n => console.log(`    ${n.id} → ${n.url}${n.isMiner ? ' (miner)' : ''}`));
  console.log(`  Engine(s) (${ENGINE_URLS.length}):`);
  ENGINE_URLS.forEach(u => console.log(`    → ${u}`));
  console.log(`  API key set    →  ${activeTenantKey ? 'yes' : 'NO — set CHAIN_API_KEY'}`);
  console.log(`  Admin key set  →  ${CHAIN_API_ADMIN_KEY ? 'yes' : 'NO — set CHAIN_API_ADMIN_KEY'}\n`);
});
