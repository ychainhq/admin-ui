/* Bitcoin Regtest Control Panel + chain-api — app.js */
'use strict';

// ─── RPC Helper (Bitcoin Core) ────────────────────────────────────────────────

async function rpc(method, params = [], useWallet = false) {
  const res = await fetch('/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params, useWallet }),
  });
  return res.json();
}

// ─── chain-api Helpers ────────────────────────────────────────────────────────

async function api(method, path, body = null, query = null) {
  let url = '/api' + path;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    if (qs.toString()) url += '?' + qs.toString();
  }
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
  if (!res.ok) throw new Error(data.error?.message || data.message || `HTTP ${res.status}`);
  return data;
}

async function adminApi(method, path, body = null, query = null) {
  let url = '/admin-api' + path;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    );
    if (qs.toString()) url += '?' + qs.toString();
  }
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
  if (!res.ok) throw new Error(data.error?.message || data.message || `HTTP ${res.status}`);
  return data;
}

// ─── Rivets Formatters ───────────────────────────────────────────────────────

rivets.formatters.eq    = (a, b) => a === b;
rivets.formatters.neq   = (a, b) => a !== b;
rivets.formatters.not   = v => !v;
rivets.formatters.or    = (a, b) => a || b;
rivets.formatters.gt0   = v => Number(v) > 0;
rivets.formatters.eq0   = v => Number(v) === 0;
rivets.formatters.positive = v => Number(v) > 0;
rivets.formatters.negative = v => Number(v) < 0;
rivets.formatters.number = v => (v === null || v === undefined) ? '—' : Number(v).toLocaleString();
rivets.formatters.isEmpty = v => !v || (Array.isArray(v) && v.length === 0);
rivets.formatters.length  = v => Array.isArray(v) ? v.length : 0;
rivets.formatters.countStatus = (arr, status) =>
  Array.isArray(arr) ? arr.filter(x => x.status === status).length : 0;

rivets.formatters.btc8 = v => {
  if (v === null || v === undefined) return '0.00000000';
  return Number(v).toFixed(8);
};

rivets.formatters.satsFromRaw = v => {
  if (v === null || v === undefined) return '0';
  return Number(v).toLocaleString();
};

rivets.formatters.sats = v => {
  if (v === null || v === undefined) return '0';
  return Math.round(Number(v) * 1e8).toLocaleString();
};

rivets.formatters.filesize = v => {
  const n = Number(v) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

rivets.formatters.hashrate = v => {
  const n = Number(v) || 0;
  if (n < 1e3)  return n.toFixed(2) + ' H/s';
  if (n < 1e6)  return (n / 1e3).toFixed(2) + ' kH/s';
  if (n < 1e9)  return (n / 1e6).toFixed(2) + ' MH/s';
  if (n < 1e12) return (n / 1e9).toFixed(2) + ' GH/s';
  if (n < 1e15) return (n / 1e12).toFixed(2) + ' TH/s';
  return (n / 1e15).toFixed(2) + ' PH/s';
};

rivets.formatters.truncate16 = v => v ? String(v).slice(0, 16) + '…' : '—';
rivets.formatters.truncate20 = v => v ? String(v).slice(0, 20) + '…' : '—';
rivets.formatters.truncate24 = v => v ? String(v).slice(0, 24) + '…' : '—';
rivets.formatters.truncate32 = v => v ? String(v).slice(0, 32) + '…' : '—';
rivets.formatters.truncate40 = v => v ? String(v).slice(0, 40) + '…' : '—';
rivets.formatters.truncate64 = v => v ? String(v).slice(0, 64) : '—';

rivets.formatters.unixdate = v => {
  if (!v) return '—';
  return new Date(Number(v) * 1000).toLocaleString();
};

rivets.formatters.isodate = v => {
  if (!v) return '—';
  return new Date(v).toLocaleString();
};

rivets.formatters.secAgo = v => {
  if (!v) return '—';
  const sec = Math.floor(Date.now() / 1000) - Number(v);
  if (sec < 60) return sec + 's ago';
  if (sec < 3600) return Math.floor(sec / 60) + 'm ago';
  return Math.floor(sec / 3600) + 'h ago';
};

rivets.formatters.defaultStr = (v, fallback) =>
  (v !== null && v !== undefined && v !== '') ? v : fallback;

rivets.formatters.statusColor = v => {
  const m = {
    active:               'sp sp-active',
    suspended:            'sp sp-warning',
    disabled:             'sp sp-error',
    frozen:               'sp sp-error',
    detected:             'sp sp-warning',
    pending_confirmation: 'sp sp-pending',
    confirmed:            'sp sp-success',
    finalized:            'sp sp-success',
    created:              'sp sp-neutral',
    pending:              'sp sp-warning',
    paid:                 'sp sp-success',
    expired:              'sp sp-error',
    cancelled:            'sp sp-error',
  };
  return m[v] || 'sp sp-neutral';
};

rivets.formatters.statusLabel = v => {
  const m = {
    detected:             'Wykryto',
    pending_confirmation: 'Oczekuje',
    confirmed:            'Potwierdzone',
    finalized:            'Rozliczone',
    created:              'Otwarte',
    paid:                 'Zapłacone',
    expired:              'Wygasłe',
    cancelled:            'Anulowane',
    active:               'Aktywny',
    disabled:             'Wyłączony',
    suspended:            'Zawieszony',
  };
  return m[v] || v || '—';
};

rivets.formatters.btcFromRaw = v => {
  if (!v) return '0.00000000';
  return (Number(v) / 1e8).toFixed(8);
};

// ─── Model ───────────────────────────────────────────────────────────────────

const model = {
  // ── Navigation ──
  tab:        'deposits',   // business tabs: deposits | payments | ledger | customers | wallets | webhooks | admin | btc
  btcSubtab:  'overview',   // btc tech subtabs: overview | mining | send | mempool | addresses | wallet | console

  // ── Header dropdowns ──
  tenantMenuOpen:    false,
  customerCreateOpen: false,

  // ── Quick-create forms (header) ──
  quickTenantForm:   { name: '', loading: false },
  quickCustomerForm: { reference: '', loading: false },

  // ── Bitcoin Core ──
  connected: false,
  autoRefresh: true,

  chain:   { chain: 'regtest', blocks: 0, headers: 0, bestblockhash: '', difficulty: 0, mediantime: 0, size_on_disk: 0, pruned: false },
  mempool: { size: 0, bytes: 0, usage: 0, mempoolminfee: 0 },
  network: { subversion: '', connections: 0 },
  mining:  { blocks: 0, difficulty: 0, networkhashps: 0, pooledtx: 0, currentblocktx: 0 },

  walletBalance: '0.00000000',
  walletUnconfirmed: '0.00000000',
  walletAddresses: [],
  walletTxs: [],
  activeAddress: '',

  addrInfo: {},
  addrBalance: { confirmed: 0, unconfirmed: 0, total: 0 },
  utxos: [],

  recentBlocks: [],

  newAddress:    { label: '', type: 'bech32' },
  lastGeneratedAddress: '',
  validateAddr:  '',
  validateResult: '',

  quickMineCount: 1,
  quickMineAddr:  '',
  quickNewLabel:  '',

  mine: {
    address: '', count: 1, loading: false, result: false,
    blocksMinedCount: 0, recentHashes: [],
  },

  send: {
    to: '', amount: '', comment: '', loading: false, txid: '', error: '',
  },

  mempoolTxs: [],

  console: {
    method: '', params: '', useWallet: false, output: '', history: [],
  },

  consoleShortcuts: [
    { label: 'getblockchaininfo', method: 'getblockchaininfo', params: '', wallet: false },
    { label: 'getmininginfo',     method: 'getmininginfo',     params: '', wallet: false },
    { label: 'getnetworkinfo',    method: 'getnetworkinfo',    params: '', wallet: false },
    { label: 'getmempoolinfo',    method: 'getmempoolinfo',    params: '', wallet: false },
    { label: 'getrawmempool',     method: 'getrawmempool',     params: '[true]', wallet: false },
    { label: 'getbalance',        method: 'getbalance',        params: '', wallet: true },
    { label: 'getnewaddress',     method: 'getnewaddress',     params: '["test","bech32"]', wallet: true },
    { label: 'listunspent',       method: 'listunspent',       params: '[0]', wallet: true },
    { label: 'listtransactions',  method: 'listtransactions',  params: '["*",20]', wallet: true },
    { label: 'getblockcount',     method: 'getblockcount',     params: '', wallet: false },
    { label: 'listwallets',       method: 'listwallets',       params: '', wallet: false },
    { label: 'validateaddress',   method: 'validateaddress',   params: '["bcrt1q..."]', wallet: false },
  ],

  // ── chain-api ──
  chainApiConnected: false,

  // Tenant context (loaded from admin API)
  tenant: {
    id: '', name: '', status: '',
    config: { btcConfirmationsRequired: 1, btcFinalityConfirmations: 6, custodyMode: 'external_signer' },
    apiKeys: [],
  },

  // Customer context (selected for all customer-scoped views)
  customerId:   '',
  customerName: 'Wszyscy',

  // Resources
  customers:       [],
  wallets:         [],
  paymentRequests: [],
  deposits:        [],
  ledgerAccounts:  [],
  selectedLedgerAccountId: '',
  ledgerEntries:   [],
  webhooks:        [],
  webhookDeliveries: [],
  adminTenants:    [],   // annotated with .isCurrent

  // Forms
  customerForm: { reference: '', metadata: '' },

  walletForm: { name: '', type: 'watch_only', walletRole: 'customer_deposits' },

  payReqForm: {
    walletId: '', address: '', amount: '',
    reference: '', expiresMinutes: '60', confirmationsRequired: '1',
  },

  webhookForm: {
    url: '',
    events: 'deposit.detected,deposit.confirmed,deposit.finalized',
    secret: '',
  },

  tenantConfigForm: {
    btcConfirmationsRequired: '1',
    btcFinalityConfirmations: '6',
  },

  generateKeyForm: { name: 'dev-key' },
  newTenantForm:   { name: '' },

  toast: { visible: false, message: '', type: 'success' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

let toastTimer = null;
function toast(message, type = 'success') {
  model.toast.message = message;
  model.toast.type    = type;
  model.toast.visible = true;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { model.toast.visible = false; }, 3500);
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(
    () => toast('Skopiowano'),
    () => toast('Błąd kopiowania', 'error')
  );
}

async function getFirstWalletAddress() {
  if (model.walletAddresses && model.walletAddresses.length > 0) {
    return model.walletAddresses[0].address;
  }
  const r = await rpc('getnewaddress', ['auto', 'bech32'], true);
  return r.result;
}

function list(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

function amountBtc(raw) {
  if (raw === null || raw === undefined) return '—';
  return (Number(raw) / 1e8).toFixed(8);
}

// ─── Bitcoin Core Data Loaders ───────────────────────────────────────────────

async function loadChainInfo() {
  const [chainR, netR, mineR] = await Promise.all([
    rpc('getblockchaininfo'),
    rpc('getnetworkinfo'),
    rpc('getmininginfo'),
  ]);
  if (chainR.result) { Object.assign(model.chain, chainR.result); model.connected = true; }
  else               { model.connected = false; }
  if (netR.result)  Object.assign(model.network, netR.result);
  if (mineR.result) Object.assign(model.mining,  mineR.result);
}

async function loadMempoolInfo() {
  const r = await rpc('getmempoolinfo');
  if (r.result) Object.assign(model.mempool, r.result);
}

async function loadWalletBalance() {
  const [balR, unconfR] = await Promise.all([
    rpc('getbalance', [], true),
    rpc('getbalance', ['*', 0], true),
  ]);
  if (balR.result !== null && balR.result !== undefined) {
    model.walletBalance = Number(balR.result).toFixed(8);
  }
  if (unconfR.result !== null && unconfR.result !== undefined) {
    const unconf = Number(unconfR.result) - Number(balR.result || 0);
    model.walletUnconfirmed = Math.max(0, unconf).toFixed(8);
  }
}

async function loadWalletAddresses() {
  const r = await rpc('listreceivedbyaddress', [0, true, true], true);
  if (r.result) {
    model.walletAddresses = r.result.map(a => ({
      address: a.address, label: a.label || '', amount: a.amount || 0,
    }));
  }
}

async function loadWalletTxs() {
  const r = await rpc('listtransactions', ['*', 50, 0, true], true);
  if (r.result) {
    model.walletTxs = r.result.slice().reverse().map(tx => ({
      txid: tx.txid, category: tx.category, amount: tx.amount,
      confirmations: tx.confirmations, address: tx.address || '',
      time: tx.time || tx.timereceived || 0,
    }));
  }
}

async function loadRecentBlocks() {
  const countR = await rpc('getblockcount');
  if (!countR.result && countR.result !== 0) return;
  const height  = countR.result;
  const fetches = [];
  for (let i = height; i > Math.max(0, height - 10); i--) {
    fetches.push(rpc('getblockhash', [i]).then(r => r.result ? rpc('getblockheader', [r.result]) : null));
  }
  const results = await Promise.all(fetches);
  model.recentBlocks = results
    .filter(r => r && r.result)
    .map(r => ({
      height: r.result.height, hash: r.result.hash,
      nTx: r.result.nTx, size: r.result.size || 0, time: r.result.time,
    }));
}

async function loadMempool() {
  await loadMempoolInfo();
  const r = await rpc('getrawmempool', [true]);
  if (r.result) {
    const now = Math.floor(Date.now() / 1000);
    model.mempoolTxs = Object.entries(r.result).map(([txid, info]) => ({
      txid,
      vsize: info.vsize, weight: info.weight,
      fees: info.fees || { base: 0 },
      feeRate: info.vsize > 0
        ? ((info.fees?.base ? info.fees.base * 1e8 / info.vsize : 0)).toFixed(2)
        : '—',
      time: info.time || now,
    }));
  } else {
    model.mempoolTxs = [];
  }
}

async function loadAddressInfo() {
  const addr = model.activeAddress.trim();
  if (!addr) return;
  const [valR, unspentR] = await Promise.all([
    rpc('validateaddress', [addr]),
    rpc('listunspent', [0, 9999999, [addr]], true),
  ]);
  if (valR.result) model.addrInfo = valR.result;
  if (unspentR.result) {
    model.utxos = unspentR.result.map(u => ({
      txid: u.txid, vout: u.vout, amount: u.amount,
      confirmations: u.confirmations, spendable: u.spendable,
    }));
    const confirmed   = unspentR.result.filter(u => u.confirmations >= 1).reduce((s, u) => s + u.amount, 0);
    const total       = unspentR.result.reduce((s, u) => s + u.amount, 0);
    model.addrBalance = { confirmed, unconfirmed: Math.max(0, total - confirmed), total };
  }
}

async function loadUtxos() {
  const addr = model.activeAddress.trim();
  if (!addr) { toast('Wybierz adres', 'error'); return; }
  const r = await rpc('listunspent', [0, 9999999, [addr]], true);
  if (r.result) {
    model.utxos = r.result.map(u => ({
      txid: u.txid, vout: u.vout, amount: u.amount,
      confirmations: u.confirmations, spendable: u.spendable,
    }));
  }
}

async function refreshAll() {
  await Promise.all([loadChainInfo(), loadMempoolInfo(), loadWalletBalance()]);
}

// ─── chain-api Data Loaders ───────────────────────────────────────────────────

async function checkChainApiHealth() {
  try {
    const res = await fetch('/api/chains');
    model.chainApiConnected = res.status < 500;
  } catch {
    model.chainApiConnected = false;
  }
}

async function loadTenantInfo() {
  try {
    const data = await adminApi('GET', '/tenants');
    const tenants = list(data);
    if (tenants.length > 0) {
      const t = tenants[0];
      if (!model.tenant.id) {
        // First load — use first tenant from the list
        model.tenant.id     = t.id     || '';
        model.tenant.name   = t.name   || '';
        model.tenant.status = t.status || '';
      }
      _annotateAdminTenants(tenants);

      // Register the .env key for the initial tenant so switch-back works
      if (model.tenant.id) {
        fetch('/register-tenant-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId: model.tenant.id }),
        }).catch(() => {});
      }
    }
  } catch { /* admin key not configured — silent */ }

  if (model.tenant.id) {
    try {
      const resp = await adminApi('GET', `/tenants/${model.tenant.id}/config`);
      const cfg = resp?.data || resp || {};
      Object.assign(model.tenant.config, {
        btcConfirmationsRequired: cfg.btc_confirmations_required ?? 1,
        btcFinalityConfirmations: cfg.btc_finality_confirmations ?? 6,
        custodyMode:              cfg.custody_mode               ?? 'external_signer',
      });
      model.tenantConfigForm.btcConfirmationsRequired = String(cfg.btc_confirmations_required ?? 1);
      model.tenantConfigForm.btcFinalityConfirmations = String(cfg.btc_finality_confirmations ?? 6);
    } catch { /* optional */ }
  }
}

function _annotateAdminTenants(tenants) {
  model.adminTenants = tenants.map(t => ({
    ...t,
    isCurrent: t.id === model.tenant.id,
  }));
}

async function loadAdminTenants() {
  try {
    const data = await adminApi('GET', '/tenants');
    _annotateAdminTenants(list(data));
  } catch (e) {
    toast('Tenants: ' + e.message, 'error');
  }
}

async function loadCustomers() {
  try {
    const data = await api('GET', '/customers');
    model.customers = list(data);
  } catch (e) {
    toast('Customers: ' + e.message, 'error');
  }
}

async function loadWallets() {
  try {
    const data = await api('GET', '/wallets');
    model.wallets = list(data);
  } catch (e) {
    toast('Wallets: ' + e.message, 'error');
  }
}

async function loadPaymentRequests() {
  try {
    const q = model.customerId ? { customerId: model.customerId } : null;
    const data = await api('GET', '/payment-requests', null, q);
    model.paymentRequests = list(data).map(pr => ({
      ...pr,
      amountDisplay: pr.amount_display || pr.amountDisplay || amountBtc(pr.amount_raw || pr.amountRaw),
    }));
  } catch (e) {
    toast('Payment requests: ' + e.message, 'error');
  }
}

async function loadDeposits() {
  try {
    const q = model.customerId ? { customerId: model.customerId } : null;
    const data = await api('GET', '/deposits', null, q);
    model.deposits = list(data).map(d => ({
      ...d,
      amountDisplay: d.amount_display || d.amountDisplay || amountBtc(d.amount_raw || d.amountRaw),
      customerRef: model.customers.find(c => c.id === (d.customer_id || d.customerId))?.reference || '',
    }));
  } catch (e) {
    toast('Deposits: ' + e.message, 'error');
  }
}

async function loadLedgerAccounts() {
  try {
    const q = model.customerId ? { customerId: model.customerId } : null;
    const data = await api('GET', '/ledger/accounts', null, q);
    model.ledgerAccounts = list(data);
  } catch (e) {
    toast('Ledger: ' + e.message, 'error');
  }
}

async function loadLedgerEntries(accountId) {
  if (!accountId) return;
  try {
    const data = await api('GET', `/ledger/accounts/${accountId}/entries`);
    model.ledgerEntries = list(data).map(le => ({
      ...le,
      amountRaw:         le.amount_raw          || le.amountRaw         || '0',
      balanceSettledRaw: le.balance_settled_raw  || le.balanceSettledRaw || '0',
      createdAt:         le.created_at           || le.createdAt         || '',
    }));
  } catch (e) {
    toast('Ledger entries: ' + e.message, 'error');
  }
}

async function loadWebhooks() {
  try {
    const data = await api('GET', '/webhooks');
    model.webhooks = list(data);
  } catch (e) {
    toast('Webhooks: ' + e.message, 'error');
  }
}

async function loadWebhookDeliveries() {
  try {
    const data = await api('GET', '/webhook-deliveries');
    model.webhookDeliveries = list(data);
  } catch (e) {
    toast('Dostawy: ' + e.message, 'error');
  }
}

async function loadAdminApiKeys() {
  if (!model.tenant.id) return;
  try {
    const data = await adminApi('GET', `/tenants/${model.tenant.id}/api-keys`);
    model.tenant.apiKeys = list(data);
  } catch { /* optional */ }
}

// ─── Controller ──────────────────────────────────────────────────────────────

const ctrl = {

  // ── Tab routing ──

  setTab(e) {
    const tab = e.target.dataset.tab || e.currentTarget.dataset.tab;
    if (!tab) return;
    model.tab = tab;
    model.tenantMenuOpen    = false;
    model.customerCreateOpen = false;
    if (!model.chainApiConnected && tab !== 'btc') return;
    if (tab === 'deposits')  loadDeposits();
    if (tab === 'payments')  { loadPaymentRequests(); loadWallets(); }
    if (tab === 'ledger')    loadLedgerAccounts();
    if (tab === 'customers') loadCustomers();
    if (tab === 'wallets')   loadWallets();
    if (tab === 'webhooks')  { loadWebhooks(); loadWebhookDeliveries(); }
    if (tab === 'admin')     { loadTenantInfo(); loadAdminApiKeys(); }
    if (tab === 'btc')       ctrl._loadBtcSubtab();
  },

  setBtcSubtab(e) {
    const tab = e.target.dataset.tab || e.currentTarget.dataset.tab;
    if (!tab) return;
    model.btcSubtab = tab;
    ctrl._loadBtcSubtab();
  },

  _loadBtcSubtab() {
    const t = model.btcSubtab;
    if (t === 'overview')  loadRecentBlocks();
    if (t === 'addresses') loadWalletAddresses();
    if (t === 'wallet')    { loadWalletAddresses(); loadWalletTxs(); }
    if (t === 'mempool')   loadMempool();
  },

  toggleAutoRefresh() { model.autoRefresh = !model.autoRefresh; },

  // ── Tenant menu ──

  async toggleTenantMenu() {
    model.customerCreateOpen = false;
    model.tenantMenuOpen = !model.tenantMenuOpen;
    if (model.tenantMenuOpen) await loadAdminTenants();
  },

  closeTenantMenu() {
    model.tenantMenuOpen = false;
  },

  async switchTenant(e) {
    const el = e.target.closest('[data-id]') || e.currentTarget;
    const id   = el.dataset.id;
    const name = el.dataset.name;
    if (!id || id === model.tenant.id) { model.tenantMenuOpen = false; return; }

    try {
      const r = await fetch('/switch-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: id }),
      });
      const data = await r.json();
      if (data.error) throw new Error(data.error.message);

      model.tenant.id     = id;
      model.tenant.name   = name;
      model.tenant.status = '';
      model.tenant.apiKeys = [];
      model.tenantMenuOpen = false;
      model.customerId     = '';
      model.customerName   = 'Wszyscy';

      await Promise.all([loadTenantInfo(), loadCustomers(), loadWallets()]);
      _annotateAdminTenants(model.adminTenants);

      if (model.chainApiConnected) {
        if (model.tab === 'deposits')  await loadDeposits();
        if (model.tab === 'payments')  await loadPaymentRequests();
        if (model.tab === 'ledger')    await loadLedgerAccounts();
      }
      toast('Tenant: ' + name, 'info');
    } catch (err) {
      toast('Błąd zmiany tenanta: ' + err.message, 'error');
    }
  },

  async createTenantQuick() {
    const name = model.quickTenantForm.name.trim();
    if (!name) { toast('Podaj nazwę', 'error'); return; }
    model.quickTenantForm.loading = true;
    try {
      const data = await adminApi('POST', '/tenants', { name });
      const tenantId = data?.data?.id || data?.id;
      model.quickTenantForm.name = '';
      await loadAdminTenants();

      if (tenantId) {
        const r = await fetch('/switch-tenant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        });
        const switchData = await r.json();
        if (!switchData.error) {
          model.tenant.id   = tenantId;
          model.tenant.name = name;
          model.customerId   = '';
          model.customerName = 'Wszyscy';
          await Promise.all([loadTenantInfo(), loadCustomers(), loadWallets()]);
          _annotateAdminTenants(model.adminTenants);
        }
      }
      model.tenantMenuOpen = false;
      toast('Tenant "' + name + '" utworzony', 'success');
    } catch (e) { toast(e.message, 'error'); }
    model.quickTenantForm.loading = false;
  },

  // ── Customer context selector ──

  onCustomerChange() {
    const c = model.customers.find(c => c.id === model.customerId);
    model.customerName = c ? (c.reference || c.id) : 'Wszyscy';
    ctrl._reloadCurrentTab();
  },

  selectCustomer(e) {
    const id  = e.target.dataset.id  || e.currentTarget.dataset.id;
    const ref = e.target.dataset.ref || e.currentTarget.dataset.ref;
    model.customerId   = id  || '';
    model.customerName = ref || (id ? id.slice(0, 16) : 'Wszyscy');
    ctrl._reloadCurrentTab();
    toast('Klient: ' + model.customerName, 'info');
  },

  clearCustomer() {
    model.customerId    = '';
    model.customerName  = 'Wszyscy';
    model.customerCreateOpen = false;
    ctrl._reloadCurrentTab();
  },

  toggleCustomerCreate() {
    model.tenantMenuOpen = false;
    model.customerCreateOpen = !model.customerCreateOpen;
  },

  async createCustomerQuick() {
    const ref = model.quickCustomerForm.reference.trim();
    if (!ref) { toast('Podaj referencję', 'error'); return; }
    model.quickCustomerForm.loading = true;
    try {
      const data = await api('POST', '/customers', { reference: ref });
      const customerId = data?.data?.id || data?.id;
      model.quickCustomerForm.reference = '';
      model.customerCreateOpen = false;
      await loadCustomers();
      if (customerId) {
        model.customerId   = customerId;
        model.customerName = ref;
        ctrl._reloadCurrentTab();
      }
      toast('Klient "' + ref + '" utworzony', 'success');
    } catch (e) { toast(e.message, 'error'); }
    model.quickCustomerForm.loading = false;
  },

  _reloadCurrentTab() {
    const tab = model.tab;
    if (!model.chainApiConnected) return;
    if (tab === 'deposits')  loadDeposits();
    if (tab === 'payments')  loadPaymentRequests();
    if (tab === 'ledger')    loadLedgerAccounts();
    if (tab === 'customers') loadCustomers();
  },

  // ── Bitcoin Core: Addresses ──

  async generateAddress() {
    const label = (model.newAddress && model.newAddress.label) || model.quickNewLabel || '';
    const type  = (model.newAddress && model.newAddress.type)  || 'bech32';
    const r = await rpc('getnewaddress', label ? [label, type] : ['', type], true);
    if (r.result) {
      model.lastGeneratedAddress = r.result;
      model.quickNewLabel        = '';
      if (model.newAddress) model.newAddress.label = '';
      await loadWalletAddresses();
      toast('Adres: ' + r.result.slice(0, 20) + '…');
    } else {
      toast(r.error ? r.error.message : 'Błąd generowania adresu', 'error');
    }
  },

  copyLastAddress() { copyText(model.lastGeneratedAddress); },

  copyByAttr(e) {
    const val = e.target.dataset.address || e.currentTarget.dataset.address ||
                e.target.dataset.value   || e.currentTarget.dataset.value;
    if (val) copyText(val);
  },

  selectActiveAddress(e) {
    const addr = e.target.dataset.address || e.currentTarget.dataset.address;
    if (addr) { model.activeAddress = addr; toast('Adres aktywny: ' + addr.slice(0, 20) + '…', 'info'); }
  },

  goToWallet() { model.tab = 'btc'; model.btcSubtab = 'wallet'; loadWalletTxs(); loadAddressInfo(); },

  async validateAddress() {
    const addr = model.validateAddr.trim();
    if (!addr) return;
    const r = await rpc('validateaddress', [addr]);
    model.validateResult = r.result
      ? JSON.stringify(r.result, null, 2)
      : JSON.stringify(r.error, null, 2);
  },

  async loadAddressInfo()    { await loadAddressInfo(); },
  async loadUtxos()          { await loadUtxos(); },
  async loadWalletAddresses(){ await loadWalletAddresses(); },
  async loadWalletTxs()      { await loadWalletTxs(); },
  async loadRecentBlocks()   { await loadRecentBlocks(); },
  async loadMempool()        { await loadMempool(); },

  // ── Mining ──

  async _mine(count, address) {
    let addr = address || model.mine.address.trim() || model.quickMineAddr.trim();
    if (!addr) addr = await getFirstWalletAddress();
    if (!addr) { toast('Brak adresu', 'error'); return; }
    model.mine.loading = true;
    model.mine.result  = false;
    const r = await rpc('generatetoaddress', [count, addr]);
    model.mine.loading = false;
    if (r.result) {
      model.mine.blocksMinedCount = r.result.length;
      model.mine.recentHashes     = r.result.slice(-5);
      model.mine.result = true;
      await refreshAll();
      await loadRecentBlocks();
      if (model.tab === 'btc' && model.btcSubtab === 'mempool') await loadMempool();
      if (model.tab === 'btc' && model.btcSubtab === 'wallet') { await loadWalletTxs(); await loadAddressInfo(); }
      if (model.chainApiConnected) {
        if (model.tab === 'deposits') await loadDeposits();
        if (model.tab === 'payments') await loadPaymentRequests();
      }
      toast(`Wydobyto ${r.result.length} blok${r.result.length !== 1 ? 'ów' : ''}`);
    } else {
      toast(r.error ? r.error.message : 'Błąd wydobycia', 'error');
    }
  },

  mineToAddress() { ctrl._mine(Number(model.mine.count) || 1); },
  quickMine()     { ctrl._mine(Number(model.quickMineCount) || 1, model.quickMineAddr.trim()); },
  mine1()  { ctrl._mine(1); },   mine6()   { ctrl._mine(6); },
  mine10() { ctrl._mine(10); },  mine101() { ctrl._mine(101); },
  mine144(){ ctrl._mine(144); },

  // ── Send ──

  async sendBitcoin() {
    const to     = model.send.to.trim();
    const amount = parseFloat(model.send.amount);
    if (!to)                          { toast('Podaj adres odbiorcy', 'error'); return; }
    if (isNaN(amount) || amount <= 0) { toast('Podaj prawidłową kwotę', 'error'); return; }
    model.send.loading = true; model.send.txid = ''; model.send.error = '';
    const params = [to, amount];
    if (model.send.comment) params.push(model.send.comment);
    const r = await rpc('sendtoaddress', params, true);
    model.send.loading = false;
    if (r.result) {
      model.send.txid = r.result;
      await refreshAll(); await loadMempool();
      toast('Wysłano: ' + r.result.slice(0, 20) + '…');
    } else {
      model.send.error = r.error ? r.error.message : 'Błąd wysyłki';
      toast(model.send.error, 'error');
    }
  },

  async sendAndMine() {
    await ctrl.sendBitcoin();
    if (model.send.txid) await ctrl._mine(1);
  },

  _fillSend(amount) {
    model.send.to = model.activeAddress || '';
    model.send.amount = amount;
    if (!model.send.to) toast('Najpierw ustaw aktywny adres', 'info');
  },
  fillSend001()    { ctrl._fillSend('0.001'); },
  fillSend01()     { ctrl._fillSend('0.01'); },
  fillSend1()      { ctrl._fillSend('1.0'); },

  // ── Scenarios ──

  async scenarioSendUnconfirmed() {
    let addr = model.activeAddress;
    if (!addr) {
      const r = await rpc('getnewaddress', ['scenario', 'bech32'], true);
      if (!r.result) { toast('Błąd adresu', 'error'); return; }
      addr = r.result; model.activeAddress = addr;
      await loadWalletAddresses();
    }
    model.send.to = addr; model.send.amount = '0.01';
    await ctrl.sendBitcoin();
    model.tab = 'btc'; model.btcSubtab = 'mempool'; await loadMempool();
    toast('TX w mempool — sprawdź zakładkę Mempool', 'info');
  },

  async scenarioConfirmed() {
    await ctrl.scenarioSendUnconfirmed();
    await ctrl._mine(1); model.tab = 'btc'; model.btcSubtab = 'wallet'; await loadWalletTxs();
    toast('TX potwierdzony (1 blok)', 'success');
  },

  async scenarioFullySettled() {
    await ctrl.scenarioSendUnconfirmed();
    await ctrl._mine(6); model.tab = 'btc'; model.btcSubtab = 'wallet'; await loadWalletTxs();
    toast('TX rozliczony (6 bloków)', 'success');
  },

  async scenarioChainApiDeposit() {
    if (!model.chainApiConnected) { toast('chain-api nie podłączony', 'error'); return; }
    if (model.wallets.length === 0) await loadWallets();
    const wallet = model.wallets.find(w => w.walletRole === 'customer_deposits') || model.wallets[0];
    if (!wallet) { toast('Utwórz wallet (zakładka Wallets)', 'error'); return; }

    const r = await rpc('getnewaddress', ['chain-api-deposit', 'bech32'], true);
    if (!r.result) { toast('Błąd generowania adresu', 'error'); return; }
    const addr = r.result;

    try {
      await api('POST', '/monitors/addresses', {
        chain:      'bitcoin',
        address:    addr,
        label:      'auto-scenario',
        customerId: model.customerId || undefined,
        walletId:   wallet.id,
      });
    } catch (e) { toast('Monitor: ' + e.message, 'error'); return; }

    model.send.to = addr; model.send.amount = '0.01';
    await ctrl.sendBitcoin();
    model.tab = 'deposits';
    await loadDeposits();
    toast('Wysłano na monitorowany adres — wykopaj bloki żeby potwierdzić', 'info');
  },

  // ── RPC Console ──

  async executeConsole() {
    const method = model.console.method.trim();
    if (!method) { toast('Podaj metodę RPC', 'error'); return; }
    let params = [];
    if (model.console.params.trim()) {
      try { params = JSON.parse(model.console.params.trim()); }
      catch { toast('Params muszą być tablicą JSON', 'error'); return; }
    }
    const r = await rpc(method, params, model.console.useWallet);
    model.console.output = JSON.stringify(r.result !== undefined ? r.result : r, null, 2);
    const entry = { method, params: model.console.params.trim(), wallet: model.console.useWallet };
    model.console.history = [entry, ...model.console.history.filter(h => h.method !== method)].slice(0, 20);
  },

  clearConsole() { model.console.output = ''; },

  fillConsole(e) {
    const el = e.target.closest('[data-method]') || e.currentTarget;
    model.console.method    = el.dataset.method  || '';
    model.console.params    = el.dataset.params  || '';
    model.console.useWallet = el.dataset.wallet  === 'true';
  },

  fillFromHistory(e) {
    const el = e.currentTarget;
    model.console.method    = el.dataset.method || '';
    model.console.params    = el.dataset.params || '';
    model.console.useWallet = el.dataset.wallet === 'true';
  },

  // ── Customers ──

  async createCustomer() {
    const ref = model.customerForm.reference.trim();
    if (!ref) { toast('Referencja jest wymagana', 'error'); return; }
    let metadata = undefined;
    if (model.customerForm.metadata.trim()) {
      try { metadata = JSON.parse(model.customerForm.metadata.trim()); }
      catch { toast('Metadata musi być prawidłowym JSON', 'error'); return; }
    }
    try {
      await api('POST', '/customers', { reference: ref, metadata });
      model.customerForm.reference = '';
      model.customerForm.metadata  = '';
      await loadCustomers();
      toast('Klient utworzony');
    } catch (e) { toast(e.message, 'error'); }
  },

  async disableCustomer(e) {
    const id = e.target.dataset.id || e.currentTarget.dataset.id;
    if (!id) return;
    try {
      await api('POST', `/customers/${id}/disable`);
      await loadCustomers();
      toast('Klient wyłączony');
    } catch (e) { toast(e.message, 'error'); }
  },

  async loadCustomers() { await loadCustomers(); },

  // ── Wallets ──

  async createWallet() {
    const name = model.walletForm.name.trim();
    if (!name) { toast('Nazwa wymagana', 'error'); return; }
    try {
      await api('POST', '/wallets', {
        name,
        type:       model.walletForm.type,
        walletRole: model.walletForm.walletRole,
      });
      model.walletForm.name = '';
      await loadWallets();
      toast('Wallet utworzony');
    } catch (e) { toast(e.message, 'error'); }
  },

  async loadWallets() { await loadWallets(); },

  // ── Payment Requests ──

  async createPaymentRequest() {
    const addr   = model.payReqForm.address.trim();
    const amount = model.payReqForm.amount.trim();
    const wid    = model.payReqForm.walletId;
    if (!addr)   { toast('Adres wymagany', 'error'); return; }
    if (!amount) { toast('Kwota wymagana', 'error'); return; }
    if (!wid)    { toast('Wybierz wallet', 'error'); return; }
    const expiresAt  = model.payReqForm.expiresMinutes
      ? new Date(Date.now() + Number(model.payReqForm.expiresMinutes) * 60000).toISOString()
      : undefined;
    try {
      await api('POST', '/payment-requests', {
        chain:                 'bitcoin',
        asset:                 'BTC',
        walletId:              wid,
        address:               addr,
        amount:                amount,          // BTC display units, e.g. "0.001"
        reference:             model.payReqForm.reference || undefined,
        customerId:            model.customerId || undefined,
        expiresAt,
        confirmationsRequired: Number(model.payReqForm.confirmationsRequired) || 1,
      });
      model.payReqForm.address   = '';
      model.payReqForm.amount    = '';
      model.payReqForm.reference = '';
      await loadPaymentRequests();
      toast('Żądanie płatności utworzone');
    } catch (e) { toast(e.message, 'error'); }
  },

  async cancelPaymentRequest(e) {
    const id = e.target.dataset.id || e.currentTarget.dataset.id;
    if (!id) return;
    try {
      await api('POST', `/payment-requests/${id}/cancel`);
      await loadPaymentRequests();
      toast('Anulowano');
    } catch (e) { toast(e.message, 'error'); }
  },

  async loadPaymentRequests() { await loadPaymentRequests(); },
  async loadDeposits()        { await loadDeposits(); },
  async loadLedgerAccounts()  { await loadLedgerAccounts(); },

  async selectLedgerAccount(e) {
    const id = e.target.dataset.id || e.currentTarget.dataset.id;
    if (!id) return;
    model.selectedLedgerAccountId = id;
    await loadLedgerEntries(id);
  },

  async loadLedgerEntries() {
    await loadLedgerEntries(model.selectedLedgerAccountId);
  },

  // ── Webhooks ──

  async createWebhook() {
    const url = model.webhookForm.url.trim();
    if (!url) { toast('URL wymagany', 'error'); return; }
    const events = model.webhookForm.events.split(',').map(s => s.trim()).filter(Boolean);
    try {
      await api('POST', '/webhooks', {
        url,
        events,
        secret: model.webhookForm.secret || undefined,
      });
      model.webhookForm.url    = '';
      model.webhookForm.secret = '';
      await loadWebhooks();
      toast('Webhook utworzony');
    } catch (e) { toast(e.message, 'error'); }
  },

  async testWebhook(e) {
    const id = e.target.dataset.id || e.currentTarget.dataset.id;
    if (!id) return;
    try {
      await api('POST', `/webhooks/${id}/test`);
      await loadWebhookDeliveries();
      toast('Test wysłany');
    } catch (e) { toast(e.message, 'error'); }
  },

  async deleteWebhook(e) {
    const id = e.target.dataset.id || e.currentTarget.dataset.id;
    if (!id) return;
    try {
      await api('DELETE', `/webhooks/${id}`);
      await loadWebhooks();
      toast('Webhook usunięty');
    } catch (e) { toast(e.message, 'error'); }
  },

  async retryDelivery(e) {
    const id = e.target.dataset.id || e.currentTarget.dataset.id;
    if (!id) return;
    try {
      await api('POST', `/webhook-deliveries/${id}/retry`);
      await loadWebhookDeliveries();
      toast('Ponowna próba w kolejce');
    } catch (e) { toast(e.message, 'error'); }
  },

  async loadWebhooks()         { await loadWebhooks(); },
  async loadWebhookDeliveries(){ await loadWebhookDeliveries(); },

  // ── Admin ──

  async saveTenantConfig() {
    if (!model.tenant.id) { toast('Brak tenanta', 'error'); return; }
    try {
      await adminApi('PATCH', `/tenants/${model.tenant.id}/config`, {
        btcConfirmationsRequired: Number(model.tenantConfigForm.btcConfirmationsRequired),
        btcFinalityConfirmations: Number(model.tenantConfigForm.btcFinalityConfirmations),
      });
      await loadTenantInfo();
      toast('Konfiguracja zapisana');
    } catch (e) { toast(e.message, 'error'); }
  },

  async generateApiKey() {
    if (!model.tenant.id) { toast('Brak tenanta', 'error'); return; }
    const name = model.generateKeyForm.name.trim() || 'dev-key';
    try {
      const data = await adminApi('POST', `/tenants/${model.tenant.id}/api-keys`, { name });
      const key = data?.data?.apiKey || data?.data?.key || data?.apiKey || data?.key;
      toast('Nowy klucz API: ' + (key || JSON.stringify(data?.data || data)), 'info');
      await loadAdminApiKeys();
    } catch (e) { toast(e.message, 'error'); }
  },

  async createTenant() {
    const name = model.newTenantForm.name.trim();
    if (!name) { toast('Nazwa wymagana', 'error'); return; }
    try {
      await adminApi('POST', '/tenants', { name });
      model.newTenantForm.name = '';
      await loadAdminTenants();
      toast('Tenant utworzony');
    } catch (e) { toast(e.message, 'error'); }
  },

  async disableTenant(e) {
    const id = e.target.dataset.id || e.currentTarget.dataset.id;
    if (!id) return;
    try {
      await adminApi('PATCH', `/tenants/${id}`, { status: 'disabled' });
      await loadAdminTenants();
      toast('Tenant wyłączony');
    } catch (e) { toast(e.message, 'error'); }
  },

  async loadAdminTenants() { await loadAdminTenants(); },
};

// ─── Auto-refresh loop ───────────────────────────────────────────────────────

setInterval(async () => {
  if (!model.autoRefresh) return;
  await refreshAll();

  const wasConnected = model.chainApiConnected;
  await checkChainApiHealth();

  // On reconnect: load tenant info and current tab data
  if (!wasConnected && model.chainApiConnected) {
    await Promise.all([loadTenantInfo(), loadCustomers(), loadWallets()]);
  }

  if (model.tab === 'btc') {
    if (model.btcSubtab === 'mempool')   await loadMempool();
    if (model.btcSubtab === 'overview')  await loadRecentBlocks();
    if (model.btcSubtab === 'wallet')    await loadWalletTxs();
    if (model.btcSubtab === 'addresses') await loadWalletAddresses();
  }
  if (model.chainApiConnected) {
    if (model.tab === 'deposits') await loadDeposits();
    if (model.tab === 'payments') await loadPaymentRequests();
  }
}, 5000);

// ─── Init ────────────────────────────────────────────────────────────────────

rivets.bind(document.body, { model, ctrl });
document.body.removeAttribute('rv-cloak');

(async () => {
  await refreshAll();
  await loadWalletAddresses();
  await loadRecentBlocks();
  try {
    await checkChainApiHealth();
    if (model.chainApiConnected) {
      await Promise.all([loadTenantInfo(), loadCustomers(), loadWallets()]);
      await loadDeposits();
    }
  } catch { /* engine not running yet */ }
})();
