# btc-test-ui

Local test environment for [chain-api v2](../engine/) (multi-tenant Bitcoin custody API).

Runs Bitcoin Core in regtest mode with a browser UI that controls the chain **and** integrates with the chain-api engine — tenant context, customer management, deposit monitoring, payment requests, ledger, and webhooks.

## Stack

| Component | Tech |
|-----------|------|
| Bitcoin Core | `lncm/bitcoind:v25.0` (regtest, Docker) |
| UI proxy | Node.js + Express (port 3001) |
| UI | Rivets.js + Tailwind CSS (single-page) |
| chain-api engine | Node.js + Express + SQLite — runs **on host**, not in Docker |

---

## Quick Start

### 1. Start Bitcoin Core + UI proxy

```bash
cd btc-test-ui
docker compose up -d
bash scripts/init.sh        # create wallet, mine 101 blocks
```

### 2. Start chain-api engine

```bash
cp chain-api.env ../engine/.env
cd ../engine
npm install
npm run db:migrate
npm run db:seed             # prints API_KEY and ADMIN_KEY — copy them!
npm run dev                 # engine listens on http://localhost:3000
```

### 3. Configure UI proxy with engine keys

```bash
cd btc-test-ui
cp .env.example .env
# Edit .env — paste the cak_... and aak_... keys from the seed output:
#   CHAIN_API_KEY=cak_...
#   CHAIN_API_ADMIN_KEY=aak_...
docker compose restart ui   # pick up new .env
```

### 4. Bootstrap dev customer (optional)

```bash
bash scripts/setup-engine.sh    # verifies connectivity, creates dev-customer-1
```

### 5. Open the UI

```
http://localhost:3001
```

---

## Environment Files

| File | Purpose |
|------|---------|
| `chain-api.env` | Engine config — copy to `../engine/.env` |
| `.env.example` | UI proxy config template — copy to `.env` |
| `.env` | Your local UI proxy config (gitignored) |

`.env` (auto-loaded by Docker Compose):

```dotenv
CHAIN_API_URL=http://host.docker.internal:3000
CHAIN_API_KEY=cak_...        # from npm run db:seed
CHAIN_API_ADMIN_KEY=aak_...  # from npm run db:seed
```

---

## Scripts

| Script | What it does |
|--------|-------------|
| `scripts/init.sh` | Create Bitcoin Core wallet, mine 101 maturity blocks |
| `scripts/reset.sh` | Wipe blockchain data, restart containers, re-run init |
| `scripts/setup-engine.sh` | Verify engine connectivity, list tenants, create `dev-customer-1` |

---

## UI Tabs

### Bitcoin Core tabs (left group)

Control the regtest chain — independent of the engine.

| Tab | Features |
|-----|---------|
| **Overview** | Block height, difficulty, mempool stats, wallet balance, recent blocks, quick-mine buttons |
| **Addresses** | Generate wallet addresses, validate via Bitcoin Core |
| **Wallet** | Address balance (confirmed/unconfirmed), UTXOs, wallet transaction list |
| **Mining** | Mine N blocks to any address, preset shortcuts (1/6/10/101/144), test scenarios |
| **Send** | `sendtoaddress` with optional instant mine, quick-fill buttons |
| **Mempool** | Live mempool viewer, mine to clear |
| **RPC Console** | Raw JSON-RPC passthrough, shortcuts, history |

### chain-api tab (right, indigo)

Works in **tenant context** (set by `CHAIN_API_KEY`) and optionally in **customer context** (selected in the header dropdown or via "Set context" in Customers sub-tab).

| Sub-tab | Features |
|---------|---------|
| **Customers** | Create customers (reference + metadata), list, set as active context, disable |
| **Wallets** | Create wallets (type + role), list |
| **Payment Requests** | Create payment requests for current customer (address, amount, expiry, confirmations), list, cancel |
| **Deposits** | List deposits — auto-filtered by selected customer |
| **Ledger** | Ledger accounts and entries — auto-filtered by selected customer |
| **Webhooks** | Create webhooks (URL, events, HMAC secret), list, test delivery, retry failed deliveries |
| **Admin** | Tenant config (confirmation policy), all tenants (create/disable), API key management |

### Tenant & Customer context bar (header)

- **Tenant badge** — loaded from admin API on startup; shows name + active/suspended status
- **Customer selector** — dropdown with all customers; selecting one filters Deposits, Ledger, and Payment Requests automatically
- The `✕` button clears the customer filter back to "All"

---

## Test Scenarios

### Basic deposit flow (end-to-end)

1. **chain-api tab → Wallets** — create a wallet with role `customer_deposits`
2. **chain-api tab → Customers** — create a customer, set as active context
3. **Addresses tab** — generate a regtest address
4. **chain-api tab → Payment Requests** — create a payment request for that address (customer pre-selected)
5. **Send tab** — send 0.01 BTC to the address
6. **chain-api tab → Deposits** — observe `detected` deposit appear (auto-refresh)
7. **Mining tab → +1 block** — deposit moves to `confirmed`
8. **Mining tab → +6 blocks** — deposit moves to `finalized`

### One-click scenario (Mining tab)

The **"chain-api deposit flow"** scenario button (indigo, visible when engine connected) does steps 1–5 automatically using the current customer context and first available wallet.

---

## Proxy Architecture

```
Browser
  ├── GET/POST /rpc          → Bitcoin Core RPC (via Basic auth)
  ├── ANY      /api/*        → chain-api /v1/* (Authorization: Bearer CHAIN_API_KEY)
  └── ANY      /admin-api/*  → chain-api /admin/v1/* (X-Admin-Key: CHAIN_API_ADMIN_KEY)
```

Keys are never exposed to the browser — only the proxy server holds them.

---

## Ports

| Port | Service |
|------|---------|
| `3001` | UI + proxy (Bitcoin Core RPC + chain-api forwarding) |
| `3000` | chain-api engine (host, not Docker) |
| `18443` | Bitcoin Core RPC |
| `18444` | Bitcoin Core P2P |
| `28332` | ZMQ block notifications |
| `28333` | ZMQ tx notifications |

---

## Notes

- Coinbase outputs need **101 confirmations** before they are spendable. Always run `init.sh` (or mine 101 blocks) before sending.
- The engine runs on the **host**, not in Docker. Use `host.docker.internal:3000` as `CHAIN_API_URL` so the proxy container can reach it.
- `npm run db:seed` is idempotent — re-running it will not create duplicate tenants but will print the existing keys.
- To switch to a different tenant, update `CHAIN_API_KEY` in `.env` and restart the proxy: `docker compose restart ui`.
