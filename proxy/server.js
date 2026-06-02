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
