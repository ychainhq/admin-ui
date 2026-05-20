const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

const BITCOIN_RPC_URL      = process.env.BITCOIN_RPC_URL      || 'http://localhost:18443';
const BITCOIN_RPC_USER     = process.env.BITCOIN_RPC_USER     || 'bitcoin';
const BITCOIN_RPC_PASSWORD = process.env.BITCOIN_RPC_PASSWORD || 'bitcoin';
const BITCOIN_WALLET       = process.env.BITCOIN_WALLET       || 'btcminer';

const CHAIN_API_URL       = process.env.CHAIN_API_URL       || 'http://localhost:3000';
const CHAIN_API_ADMIN_KEY = process.env.CHAIN_API_ADMIN_KEY || '';

const RPC_AUTH = Buffer.from(`${BITCOIN_RPC_USER}:${BITCOIN_RPC_PASSWORD}`).toString('base64');

// Active tenant API key — starts from .env, can be switched at runtime via /switch-tenant
let activeTenantKey = process.env.CHAIN_API_KEY || '';
const tenantKeyCache = {}; // tenantId → apiKey (in-memory, lost on restart)

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'ui')));

// ─── Config endpoint ─────────────────────────────────────────────────────────

app.get('/config', (req, res) => {
  res.json({
    wallet:      BITCOIN_WALLET,
    rpcUrl:      BITCOIN_RPC_URL,
    rpcUser:     BITCOIN_RPC_USER,
    chainApiUrl: CHAIN_API_URL,
    hasApiKey:   !!activeTenantKey,
    hasAdminKey: !!CHAIN_API_ADMIN_KEY,
  });
});

// ─── Tenant switching ─────────────────────────────────────────────────────────

// POST /switch-tenant { tenantId }
// Generates (and caches) an API key for the target tenant, then makes it active.
app.post('/switch-tenant', async (req, res) => {
  const { tenantId } = req.body;
  if (!tenantId) return res.status(400).json({ error: { message: 'tenantId required' } });
  if (!CHAIN_API_ADMIN_KEY) return res.status(400).json({ error: { message: 'Admin key not configured' } });

  if (tenantKeyCache[tenantId]) {
    return res.json({ key: tenantKeyCache[tenantId] });
  }

  try {
    const r = await fetch(`${CHAIN_API_URL}/admin/v1/tenants/${tenantId}/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key':  CHAIN_API_ADMIN_KEY,
      },
      body: JSON.stringify({ name: 'ui-session' }),
    });
    const data = await r.json();
    const key = data.data?.apiKey;
    if (!key) throw new Error('API key not in response: ' + JSON.stringify(data));
    tenantKeyCache[tenantId] = key;
    res.json({ key });
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /register-tenant-key { tenantId }
// Tells proxy which tenant owns the currently-active key (used once on startup for the .env key).
app.post('/register-tenant-key', (req, res) => {
  const { tenantId } = req.body;
  if (tenantId && activeTenantKey && !tenantKeyCache[tenantId]) {
    tenantKeyCache[tenantId] = activeTenantKey;
  }
  res.json({ success: true });
});

// ─── Bitcoin Core RPC proxy ───────────────────────────────────────────────────

app.post('/rpc', async (req, res) => {
  const { useWallet, ...rpcBody } = req.body;
  const walletPath = useWallet ? `/wallet/${BITCOIN_WALLET}` : '';
  const url = `${BITCOIN_RPC_URL}${walletPath}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${RPC_AUTH}`,
      },
      body: JSON.stringify({
        jsonrpc: '1.0',
        id:      'chain-api-test-ui',
        method:  rpcBody.method,
        params:  rpcBody.params || [],
      }),
    });
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      res.status(response.status).json(await response.json());
    } else {
      const text = await response.text();
      res.status(response.status).json({ error: { code: response.status, message: text } });
    }
  } catch (err) {
    res.status(500).json({ error: { code: -1, message: err.message } });
  }
});

// ─── chain-api tenant proxy  (/api/* → engine /v1/*) ─────────────────────────

app.all('/api/*', async (req, res) => {
  const subPath = req.path.slice('/api'.length);
  let url = `${CHAIN_API_URL}/v1${subPath}`;
  const qs = new URLSearchParams(req.query).toString();
  if (qs) url += '?' + qs;

  // UI passes the active tenant key via X-Tenant-Key header (set after switch-tenant).
  // Fall back to the env-configured key for backward compatibility.
  const tenantKey = req.headers['x-tenant-key'] || activeTenantKey;

  try {
    const opts = {
      method:  req.method,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${tenantKey}`,
      },
    };
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      opts.body = JSON.stringify(req.body);
    }
    const response = await fetch(url, opts);
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      res.status(response.status).json(await response.json());
    } else {
      const text = await response.text();
      res.status(response.status).json({ error: { message: text || `HTTP ${response.status}` } });
    }
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
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key':  CHAIN_API_ADMIN_KEY,
      },
    };
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      opts.body = JSON.stringify(req.body);
    }
    const response = await fetch(url, opts);
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      res.status(response.status).json(await response.json());
    } else {
      const text = await response.text();
      res.status(response.status).json({ error: { message: text || `HTTP ${response.status}` } });
    }
  } catch (err) {
    res.status(502).json({ error: { message: `Engine unreachable: ${err.message}` } });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  Bitcoin Regtest UI  ->  http://localhost:${PORT}`);
  console.log(`  Bitcoin Core RPC    ->  ${BITCOIN_RPC_URL}`);
  console.log(`  chain-api engine    ->  ${CHAIN_API_URL}`);
  console.log(`  API key set         ->  ${activeTenantKey ? 'yes' : 'NO — set CHAIN_API_KEY'}`);
  console.log(`  Admin key set       ->  ${CHAIN_API_ADMIN_KEY ? 'yes' : 'NO — set CHAIN_API_ADMIN_KEY'}\n`);
});
