#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — chain-api development environment launcher
#
# ARCHITECTURE
# ────────────
#   btc-node-1    — Bitcoin Core regtest (active, mines blocks in dev)
#   btc-node-2    — Bitcoin Core regtest (active, equivalent to node-1; syncs via P2P in dev)
#   postgres      — PostgreSQL 16 (shared DB for both engines)
#   engine-1      — chain-api (active, cluster leader candidate)
#   engine-2      — chain-api (active-active, SKIP LOCKED for work distribution)
#   btc-indexer-1 — scans btc-node-1 blocks → chain_events
#   btc-indexer-2 — scans btc-node-2 blocks → chain_events (dedup via UNIQUE)
#   ui            — test proxy (http://localhost:3002)
#
#   Signers (optional, via --signer):
#   signer-oss        — OSS signer daemon (Docker, polls nginx:3009)
#   signer-enterprise — Enterprise signer daemon (Docker, polls nginx:3009)
#
# USAGE
# ──────
#   ./start.sh                            start (full stack)
#   ./start.sh --signer oss               start + OSS signer
#   ./start.sh --signer enterprise        start + Enterprise signer
#   ./start.sh --signer both              start + both signers
#   ./start.sh --debug                    start with Node.js inspector on all services
#   ./start.sh reset                      wipe + restart fresh
#   ./start.sh reset --signer oss         wipe + restart with OSS signer
#   ./start.sh stop                       stop everything
#
# ENDPOINTS
# ─────────
#   engine-1:       http://localhost:3000
#   engine-2:       http://localhost:3001
#   nginx LB:       http://localhost:3009  (stable endpoint for clients/signers)
#   Vault dev:      http://localhost:8200  (enterprise signer only; token: dev-root-token)
#   Elastic SIEM:   http://localhost:9200  (enterprise signer audit indices)
#   Kibana:         http://localhost:5601  (browse signer audit events)
#   btc-node-1 RPC: http://localhost:18443
#   btc-node-2 RPC: http://localhost:18453
#   PostgreSQL:     localhost:5433  (user: chainapi, db: chainapi)
#   Test UI:        http://localhost:3002
#
# DEBUG PORTS (used with --debug)
# ──────────────────────────────
#   engine-1 (Docker):          9229 → "Attach: Engine-1 (Docker)"
#   engine-2 (Docker):          9232 → "Attach: Engine-2 (Docker)"
#   signer-oss (Docker):        9230 → "Attach: OSS Signer (Docker)"
#   signer-enterprise (Docker): 9231 → "Attach: Enterprise Signer (Docker)"
#   btc-indexer-1 (Docker):     9233 → "Attach: btc-indexer-1 (Docker)"
#   btc-indexer-2 (Docker):     9234 → "Attach: btc-indexer-2 (Docker)"
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENGINE_DIR="$ROOT_DIR/engine"
SIGNER_OSS_DIR="$ROOT_DIR/signer-oss"
SIGNER_ENT_DIR="$ROOT_DIR/signer"

UI_ENV="$SCRIPT_DIR/.env"
ENGINE_ENV="$ENGINE_DIR/.env"
MINING_WALLET="btcminer"

# Stable/dev fingerprints for signer enrollment. Enterprise is replaced at runtime
# with the fingerprint derived from Vault Transit public key.
SIGNER_OSS_FINGERPRINT="btc:regtest:dev_oss"
SIGNER_ENT_FINGERPRINT="btc:regtest:dev_enterprise"
SIGNER_ENT_HD_FINGERPRINT="btc_hd:regtest:dev_enterprise_hd"
SIGNER_ENT_RESPONSE_KEY_HEX=""

# Enterprise Vault dev constants
VAULT_DEV_ROOT_TOKEN="dev-root-token"
VAULT_DEV_SIGNER_TOKEN="dev-signer-token"
VAULT_TRANSIT_BTC_KEY="btc-hot-wallet"
VAULT_TRANSIT_EVM_KEY="evm-wallet"
VAULT_KV_SIGNER_PATH="chain-api/signer/dev-enterprise"
VAULT_SECRET_PATH="secret/data/${VAULT_KV_SIGNER_PATH}"
VAULT_KV_HOT_WIF_PATH="btc-hot-wallet-wif"
VAULT_KV_SWEEP_XPRV_PATH="btc-sweep-xprv"
VAULT_KV_POLICY_PATH="policy"
BTC_SIGNING_BACKEND="transit"

# Enterprise SIEM dev constants. Elastic is the implemented SIEM sink.
ENTERPRISE_PROVIDER="vault"
SIEM_PROVIDER="elastic"
ELASTIC_URL_INTERNAL="http://elasticsearch:9200"
ELASTIC_URL_HOST="http://localhost:9200"
KIBANA_URL_HOST="http://localhost:5601"
ELASTIC_INDEX_PREFIX="chain-api-signer"

# Debug ports (Docker containers for engines, local for signers)
ENGINE1_DOCKER_DEBUG_PORT=9229
ENGINE2_DOCKER_DEBUG_PORT=9232
SIGNER_OSS_DEBUG_PORT=9230
SIGNER_ENT_DEBUG_PORT=9231

# Compose files
V3_COMPOSE="$SCRIPT_DIR/docker-compose.v3.yml"
V3_COMPOSE_DEBUG="$SCRIPT_DIR/docker-compose.v3.debug.yml"
# V3_COMPOSE_CMD finalized after arg parsing (may add debug overlay)

# ─── Colors ──────────────────────────────────────────────────────────────────
C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'; C_CYAN='\033[0;36m'
C_RED='\033[0;31m';   C_BOLD='\033[1m';       C_RESET='\033[0m'
C_MAGENTA='\033[0;35m'; C_BLUE='\033[0;34m'

ok()     { echo -e "${C_GREEN}  ✓  $*${C_RESET}"; }
info()   { echo -e "${C_CYAN}  ▶  $*${C_RESET}"; }
warn()   { echo -e "${C_YELLOW}  ⚠  $*${C_RESET}"; }
err()    { echo -e "${C_RED}  ✗  $*${C_RESET}" >&2; }
header() { echo -e "\n${C_BOLD}━━━  $*  ━━━${C_RESET}\n"; }
die()    { err "$*"; exit 1; }
detail() { echo -e "     ${C_BLUE}$*${C_RESET}"; }

# ─── Argument parsing ─────────────────────────────────────────────────────────
CMD="start"
SIGNER_MODE="none"
DEBUG_MODE=false
START_SCRIPT_NAME="${CHAINAPI_START_SCRIPT_NAME:-$(basename "$0")}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    start|reset|stop|-h|--help|help) CMD="$1"; shift ;;
    --signer)
      [[ $# -ge 2 ]] || die "--signer requires an argument: oss|enterprise|both"
      SIGNER_MODE="$2"; shift 2 ;;
    --enterprise-provider)
      [[ $# -ge 2 ]] || die "--enterprise-provider requires an argument: vault|aws|azure|gcp"
      ENTERPRISE_PROVIDER="$2"; shift 2 ;;
    --debug) DEBUG_MODE=true; shift ;;
    *)
      err "Unknown argument: $1"
      echo "  Run '$(basename "$0") --help' for usage."
      exit 1 ;;
  esac
done

[[ "$SIGNER_MODE" =~ ^(none|oss|enterprise|both)$ ]] || \
  die "Invalid --signer value: '$SIGNER_MODE'. Use: oss, enterprise, both"
[[ "$ENTERPRISE_PROVIDER" =~ ^(vault|aws|azure|gcp)$ ]] || \
  die "Invalid --enterprise-provider value: '$ENTERPRISE_PROVIDER'. Use: vault, aws, azure, gcp"

# Finalize V3_COMPOSE_CMD — optional image overlay + debug overlay.
V3_COMPOSE_CMD="docker compose -f $V3_COMPOSE"
if [ -n "${CHAINAPI_COMPOSE_OVERLAY:-}" ]; then
  [ -f "$CHAINAPI_COMPOSE_OVERLAY" ] || die "Compose overlay not found: $CHAINAPI_COMPOSE_OVERLAY"
  V3_COMPOSE_CMD="$V3_COMPOSE_CMD -f $CHAINAPI_COMPOSE_OVERLAY"
fi
if [[ "$DEBUG_MODE" == "true" ]]; then
  V3_COMPOSE_CMD="$V3_COMPOSE_CMD -f $V3_COMPOSE_DEBUG"
fi

COMPOSE_UP_FLAGS="${CHAINAPI_COMPOSE_UP_FLAGS:-}"
if [[ "${CHAINAPI_SKIP_LOCAL_BUILD:-false}" == "true" && -z "$COMPOSE_UP_FLAGS" ]]; then
  COMPOSE_UP_FLAGS="--no-build --pull always"
fi

# ─── Bitcoin CLI wrappers ─────────────────────────────────────────────────────
BTC1() {
  $V3_COMPOSE_CMD exec -T btc-node-1 \
    bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin "$@"
}

BTC2() {
  $V3_COMPOSE_CMD exec -T btc-node-2 \
    bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin "$@"
}

VAULT() {
  $V3_COMPOSE_CMD exec -T \
    -e VAULT_ADDR=http://127.0.0.1:8200 \
    -e VAULT_TOKEN="$VAULT_DEV_ROOT_TOKEN" \
    vault vault "$@"
}

# ─── .env helpers ─────────────────────────────────────────────────────────────
env_get() {
  grep -E "^${2}=" "${1}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' \t' || true
}

env_get_dev_secret() {
  local file="$1" key="$2" value
  value=$(env_get "$file" "$key")
  if [ -n "$value" ]; then
    printf '%s' "$value"
    return
  fi

  # Some checked-in/dev .env templates keep BTC_DEV_XPRV commented out.
  # For the local btc-test-ui launcher this is still usable dev material, and
  # normalizing it avoids forcing a full DB reset just to start the signer.
  grep -E "^#[[:space:]]*${key}=" "$file" 2>/dev/null \
    | head -1 \
    | sed -E "s/^#[[:space:]]*${key}=//" \
    | tr -d ' \t' || true
}

env_set() {
  local file="$1" key="$2" val="$3"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$val" >> "$file"
  fi
}

# ─── stop (also used as trap target in step_tail) ─────────────────────────────
cmd_stop() {
  header "Stop"
  $V3_COMPOSE_CMD --profile signer-all down
  docker compose -f "$V3_COMPOSE" --profile signer-all rm -sf 2>/dev/null || true
  ok "All services stopped"
}

# ─── reset ────────────────────────────────────────────────────────────────────
cmd_reset() {
  header "Reset"
  echo -e "  ${C_YELLOW}This will destroy:${C_RESET}"
  echo    "    • PostgreSQL data volume"
  echo    "    • Both Bitcoin Core blockchain volumes (btc_node_1, btc_node_2)"
  if [[ "${CHAINAPI_SKIP_LOCAL_BUILD:-false}" == "true" ]]; then
    echo    "    • Local containers using Docker Hub images (images will be pulled again if missing)"
  else
    echo    "    • Local Docker build cache (images may be rebuilt)"
  fi
  echo    "    • All unused Docker images, containers, networks, build cache"
  [[ "$SIGNER_MODE" != "none" ]] && \
    echo "    • Signer .env file(s)"
  echo ""
  read -r -p "  Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 0; }
  echo ""

  $V3_COMPOSE_CMD --profile signer-all down -v 2>/dev/null || true
  ok "Containers stopped and volumes removed"

  # Prune build cache (biggest hog, easily rebuilt) + stopped containers.
  # Do NOT prune images — avoids re-pulling from Docker Hub on every reset.
  info "Pruning Docker build cache and stopped containers..."
  docker builder prune -af 2>&1 | tail -1
  docker container prune -f  2>&1 | tail -1
  ok "Docker build cache and stopped containers pruned"

  docker system df 2>/dev/null | grep -v "^TYPE" | sed 's/^/     /' || true

  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]] && [ -f "$SIGNER_OSS_DIR/.env" ]; then
    rm -f "$SIGNER_OSS_DIR/.env"
    ok "signer-oss/.env removed"
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && [ -f "$SIGNER_ENT_DIR/.env" ]; then
    rm -f "$SIGNER_ENT_DIR/.env"
    ok "signer/.env removed"
  fi
}

# ─── Step 1: Build Docker images ──────────────────────────────────────────────
step_build() {
  if [[ "${CHAINAPI_SKIP_LOCAL_BUILD:-false}" == "true" ]]; then
    header "Step 1 — Pull Docker Hub images"
    info "Pulling engine, btc-indexer, and ui images..."
    $V3_COMPOSE_CMD pull engine-1 engine-2 btc-indexer-1 btc-indexer-2 ui
    ok "Docker Hub images pulled"
    return
  fi

  header "Step 1 — Build Docker images"
  info "Building engine, btc-indexer, and ui images..."
  # reset uses --no-cache (guarantees fresh build after code changes, e.g. migrate.ts).
  # start uses normal cache (faster for iterative runs — Docker detects file changes).
  local cache_flag=""
  [[ "$CMD" == "reset" ]] && cache_flag="--no-cache"
  $V3_COMPOSE_CMD build $cache_flag engine-1 engine-2 btc-indexer-1 btc-indexer-2 ui
  ok "All images built"
}

# ─── Step 2: Start infrastructure ─────────────────────────────────────────────
step_infra() {
  header "Step 2 — Start PostgreSQL + Bitcoin Core nodes"

  info "Starting postgres + btc-node-1 + btc-node-2..."
  if ! $V3_COMPOSE_CMD up $COMPOSE_UP_FLAGS -d postgres btc-node-1 btc-node-2; then
    echo ""
    err "Failed to start infrastructure containers."
    echo ""
    warn "Common causes:"
    echo "    1. No disk space in Docker VM → run: docker system prune -af"
    echo "       Current Docker disk usage:"
    docker system df 2>/dev/null | sed 's/^/       /'
    echo ""
    echo "    2. Port already in use:"
    lsof -i :18443 -i :18444 -i :5432 2>/dev/null | grep -v "^COMMAND" | head -5 | sed 's/^/       /' || true
    echo ""
    warn "btc-node-1 logs:"
    docker logs chainapi-btc-node-1 2>/dev/null | tail -10 | sed 's/^/    /' || true
    die "Infrastructure startup failed"
  fi

  info "Waiting for PostgreSQL..."
  local tries=0
  until $V3_COMPOSE_CMD exec -T postgres pg_isready -U chainapi -d chainapi > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries+1))
    [ "$tries" -le 30 ] || die "PostgreSQL did not become ready after 60s"
  done
  echo " OK"
  ok "PostgreSQL ready on localhost:5433"

  info "Waiting for btc-node-1 RPC..."
  tries=0
  until BTC1 getblockchaininfo > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries+1))
    [ "$tries" -le 30 ] || die "btc-node-1 did not respond after 60s"
  done
  echo " OK"
  ok "btc-node-1 ready on localhost:18443"

  info "Waiting for btc-node-2 RPC..."
  tries=0
  until BTC2 getblockchaininfo > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries+1))
    [ "$tries" -le 45 ] || die "btc-node-2 did not respond after 90s (it syncs from node-1)"
  done
  echo " OK"
  ok "btc-node-2 ready on localhost:18453"

  local node2_peers
  node2_peers=$(BTC2 getpeerinfo 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")
  if [ "$node2_peers" -gt "0" ]; then
    ok "btc-node-2 peered with btc-node-1 ($node2_peers peer(s))"
  else
    warn "btc-node-2 has no peers yet — blocks may take a moment to propagate"
  fi
}

# ─── Step 3: Genesis blocks ────────────────────────────────────────────────────
step_genesis() {
  header "Step 3 — Genesis blocks (btc-node-1)"

  info "Ensuring mining wallet '$MINING_WALLET' on btc-node-1..."
  BTC1 createwallet "$MINING_WALLET" false false "" false true false > /dev/null 2>&1 \
    || BTC1 loadwallet "$MINING_WALLET" > /dev/null 2>&1 \
    || true  # already loaded

  local height
  height=$(BTC1 getblockcount 2>/dev/null || echo "0")

  if [ "$height" -lt 101 ]; then
    info "Mining 101 genesis blocks on btc-node-1 (current height: $height)..."
    local addr
    addr=$(BTC1 -rpcwallet="$MINING_WALLET" getnewaddress "genesis" "bech32")
    BTC1 -rpcwallet="$MINING_WALLET" generatetoaddress 101 "$addr" > /dev/null
    ok "Genesis blocks mined → height: $(BTC1 getblockcount)"
  else
    ok "Chain at height $height — genesis mining not needed"
  fi

  info "Waiting for btc-node-2 to sync genesis blocks..."
  local tries=0
  until [ "$(BTC2 getblockcount 2>/dev/null || echo 0)" -ge "$(BTC1 getblockcount 2>/dev/null || echo 101)" ]; do
    printf "."
    sleep 2
    tries=$((tries+1))
    [ "$tries" -le 30 ] || { echo ""; warn "btc-node-2 sync is slow — continuing anyway"; break; }
  done
  echo ""
  local h1 h2
  h1=$(BTC1 getblockcount 2>/dev/null || echo "?")
  h2=$(BTC2 getblockcount 2>/dev/null || echo "?")
  ok "Block sync: btc-node-1=$h1 btc-node-2=$h2"
}

# ─── Step 4: Engine environment ───────────────────────────────────────────────
step_engine_env() {
  header "Step 4 — Engine environment"

  [ -d "$ENGINE_DIR" ] || die "Engine directory not found: $ENGINE_DIR"

  if [ ! -f "$ENGINE_ENV" ]; then
    if [ -f "$ENGINE_DIR/.env.example" ]; then
      cp "$ENGINE_DIR/.env.example" "$ENGINE_ENV"
      info "Created engine/.env from .env.example"
    else
      cat > "$ENGINE_ENV" <<'ENVEOF'
# chain-api engine — dev environment
DB_TYPE=postgres
DATABASE_URL=postgres://chainapi:chainapi_dev@localhost:5433/chainapi
BITCOIN_RPC_URL=http://localhost:18443
BITCOIN_RPC_USER=bitcoin
BITCOIN_RPC_PASSWORD=bitcoin
BITCOIN_NETWORK=regtest
BITCOIN_CORE_PROVISIONING_ENABLED=false
PORT=3000
LOG_LEVEL=info
WORKERS_ENABLED=true
CLUSTER_ENABLED=false
API_KEY=
ADMIN_KEY=
CUSTOMER_SESSION_SECRET=change-me-in-production-min-32-chars!!
ENVEOF
      info "Created engine/.env (defaults)"
    fi
  fi

  env_set "$ENGINE_ENV" "DB_TYPE" "postgres"
  env_set "$ENGINE_ENV" "DATABASE_URL" "postgres://chainapi:chainapi_dev@localhost:5433/chainapi"
  env_set "$ENGINE_ENV" "BITCOIN_NETWORK" "regtest"
  env_set "$ENGINE_ENV" "BITCOIN_CORE_PROVISIONING_ENABLED" "false"
  ok "engine/.env configured (PostgreSQL)"
}

# ─── Step 5: DB migrations + seed ─────────────────────────────────────────────
step_seed() {
  header "Step 5 — DB migrations + seed"

  info "Running migrations on PostgreSQL..."
  local seed_out
  seed_out=$(cd "$ENGINE_DIR" && DB_TYPE=postgres DATABASE_URL="postgres://chainapi:chainapi_dev@localhost:5433/chainapi" \
    npm run db:seed 2>&1) || {
    echo "$seed_out"
    die "Seed failed — see output above"
  }

  local new_api new_admin new_xpub new_xprv
  new_api=$(echo "$seed_out"   | grep -oE 'API_KEY=cak_[a-f0-9]+'       | head -1 | cut -d= -f2 || true)
  new_admin=$(echo "$seed_out" | grep -oE 'ADMIN_KEY=aak_[a-f0-9]+'     | head -1 | cut -d= -f2 || true)
  new_xpub=$(echo "$seed_out"  | grep -oE 'BTC_DEV_XPUB=[A-Za-z0-9]+'  | head -1 | cut -d= -f2 || true)
  new_xprv=$(echo "$seed_out"  | grep -oE 'BTC_DEV_XPRV=[A-Za-z0-9]+'  | head -1 | cut -d= -f2 || true)

  local engine_api_key engine_admin_key
  engine_api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  engine_admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")

  [ -n "$new_api"   ] && { env_set "$ENGINE_ENV" "API_KEY"     "$new_api";   engine_api_key="$new_api"; }
  [ -n "$new_admin" ] && { env_set "$ENGINE_ENV" "ADMIN_KEY"   "$new_admin"; engine_admin_key="$new_admin"; }
  [ -n "$new_xpub"  ] && env_set "$ENGINE_ENV" "BTC_DEV_XPUB" "$new_xpub"
  [ -n "$new_xprv"  ] && env_set "$ENGINE_ENV" "BTC_DEV_XPRV" "$new_xprv"

  [ -z "$engine_api_key"   ] && engine_api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  [ -z "$engine_admin_key" ] && engine_admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")

  [ -n "$engine_api_key" ] && [ -n "$engine_admin_key" ] || \
    die "Seed ran but API keys not found — check engine/.env"

  ok "Migrations + seed complete"
  echo ""
  echo -e "  ${C_CYAN}API key${C_RESET}    ${engine_api_key}"
  echo -e "  ${C_CYAN}Admin key${C_RESET}  ${engine_admin_key}"
  [ -n "$new_xpub" ] && echo -e "  ${C_CYAN}BTC xpub${C_RESET}   ${new_xpub}"

  # Export for downstream steps
  V3_API_KEY="$engine_api_key"
  V3_ADMIN_KEY="$engine_admin_key"
}

# ─── Step 6: Start engines ─────────────────────────────────────────────────────
step_engines() {
  header "Step 6 — Start engine-1 and engine-2"

  local api_key admin_key
  api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")

  export API_KEY="$api_key"
  export ADMIN_KEY="$admin_key"
  export CUSTOMER_SESSION_SECRET=$(env_get "$ENGINE_ENV" "CUSTOMER_SESSION_SECRET" || echo "change-me-in-production-min-32-chars!!")

  if [[ "$DEBUG_MODE" == "true" ]]; then
    echo -e "  ${C_YELLOW}Debug mode — engines start with Node.js inspector (--inspect)${C_RESET}"
    echo -e "  ${C_CYAN}engine-1 inspector${C_RESET}  →  localhost:${ENGINE1_DOCKER_DEBUG_PORT}  (VSCode: \"Attach: Engine-1 (v3 Docker)\")"
    echo -e "  ${C_CYAN}engine-2 inspector${C_RESET}  →  localhost:${ENGINE2_DOCKER_DEBUG_PORT}  (VSCode: \"Attach: Engine-2 (v3 Docker)\")"
    echo -e "  ${C_YELLOW}Note: engines start immediately — attach debugger after health check${C_RESET}"
    echo ""
  fi

  info "Starting engine-1 (cluster leader candidate)..."
  # --force-recreate ensures the container is created from the freshly built image,
  # not restarted from a stale running container that predates our build.
  $V3_COMPOSE_CMD up $COMPOSE_UP_FLAGS -d --force-recreate engine-1

  info "Waiting for engine-1 /health..."
  local tries=0
  local max_tries=45  # 90s total — extra time for migrations on first run
  until curl -sf "http://localhost:3000/health" > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries+1))
    if [ "$tries" -ge "$max_tries" ]; then
      echo ""
      err "engine-1 did not respond after $((max_tries * 2))s"
      echo ""
      warn "Last 30 lines of engine-1 logs:"
      $V3_COMPOSE_CMD logs --tail 30 engine-1 2>/dev/null || true
      die "engine-1 failed to start — see logs above"
    fi
  done
  echo " OK"
  if [[ "$DEBUG_MODE" == "true" ]]; then
    ok "engine-1 healthy → http://localhost:3000  [inspector: localhost:${ENGINE1_DOCKER_DEBUG_PORT}]"
  else
    ok "engine-1 healthy → http://localhost:3000"
  fi

  info "Starting engine-2 (active-active standby)..."
  $V3_COMPOSE_CMD up $COMPOSE_UP_FLAGS -d --force-recreate engine-2

  info "Waiting for engine-2 /health..."
  tries=0
  until curl -sf "http://localhost:3001/health" > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries+1))
    if [ "$tries" -ge "$max_tries" ]; then
      echo ""
      err "engine-2 did not respond after $((max_tries * 2))s"
      echo ""
      warn "Last 30 lines of engine-2 logs:"
      $V3_COMPOSE_CMD logs --tail 30 engine-2 2>/dev/null || true
      die "engine-2 failed to start — see logs above"
    fi
  done
  echo " OK"
  if [[ "$DEBUG_MODE" == "true" ]]; then
    ok "engine-2 healthy → http://localhost:3001  [inspector: localhost:${ENGINE2_DOCKER_DEBUG_PORT}]"
  else
    ok "engine-2 healthy → http://localhost:3001"
  fi
}

# ─── Step 7: Register chain nodes ─────────────────────────────────────────────
step_register_nodes() {
  header "Step 7 — Register chain nodes"

  local admin_key base
  admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")
  base="http://localhost:3000"

  _register_node() {
    local label="$1" role="$2" priority="$3" rpc_url="$4" pwd_ref="$5"

    # Idempotency: skip if a node with this rpcUrl already exists
    local existing_id
    existing_id=$(curl -sf "${base}/admin/v1/chain-nodes?chainId=bitcoin" \
      -H "X-Admin-Key: $admin_key" 2>/dev/null \
      | python3 -c "
import sys, json
data = json.load(sys.stdin).get('data', [])
for n in data:
    if n.get('rpcUrl') == '$rpc_url':
        print(n['id'])
        break
" 2>/dev/null || true)

    if [ -n "$existing_id" ]; then
      ok "Chain node already exists: $label → $existing_id (skipping)"
      return
    fi

    info "Registering chain node: $label ($role, priority=$priority)..."
    local body result
    body=$(printf '{"chainId":"bitcoin","label":"%s","rpcUrl":"%s","rpcUser":"bitcoin","rpcPasswordRef":"%s","network":"regtest","role":"%s","priority":%d}' \
      "$label" "$rpc_url" "$pwd_ref" "$role" "$priority")

    result=$(curl -sf -X POST "${base}/admin/v1/chain-nodes" \
      -H "X-Admin-Key: $admin_key" \
      -H "Content-Type: application/json" \
      -d "$body" 2>/dev/null) || { warn "Failed to register $label"; return; }

    local node_id
    node_id=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null || true)
    [ -n "$node_id" ] && ok "Registered: $label → $node_id" || warn "Registration response: $result"
  }

  # btc-node-1 is primary (full node, priority 10)
  # rpcPasswordRef uses env: prefix — engine reads from BTC_NODE_*_RPC_PASSWORD env var
  _register_node "btc-node-1 (primary)" "full" 10 "http://btc-node-1:18443" "env:BTC_NODE_1_RPC_PASSWORD"
  _register_node "btc-node-2 (standby)" "full" 20 "http://btc-node-2:18443" "env:BTC_NODE_2_RPC_PASSWORD"

  ok "Chain nodes registered (btc-node-1 priority=10, btc-node-2 priority=20)"
  detail "Note: chain_nodes use env: password refs. In production set:"
  detail "  BTC_NODE_1_RPC_PASSWORD=<password> in engine environment"
  detail "  BTC_NODE_2_RPC_PASSWORD=<password> in engine environment"
}

# ─── Step 8: Start btc-indexers ───────────────────────────────────────────────
step_indexers() {
  header "Step 8 — Start btc-indexers"

  info "Starting btc-indexer-1 (watches btc-node-1)..."
  $V3_COMPOSE_CMD up $COMPOSE_UP_FLAGS -d btc-indexer-1

  info "Starting btc-indexer-2 (watches btc-node-2)..."
  $V3_COMPOSE_CMD up $COMPOSE_UP_FLAGS -d btc-indexer-2

  sleep 3

  ok "btc-indexer-1 started — watching btc-node-1 (port 18443)"
  ok "btc-indexer-2 started — watching btc-node-2 (port 18453)"
  detail "Indexers scan blocks every 5s → write to chain_events table"
  detail "Deduplication: ON CONFLICT DO NOTHING if both detect the same tx"
}

# ─── Step 9: nginx load balancer + UI proxy ────────────────────────────────────
step_nginx_ui() {
  header "Step 9 — nginx load balancer + UI proxy"

  # Ensure nginx:alpine image is available locally before starting the container.
  # After docker system prune, the image may be absent. Pull with retry.
  if ! docker image inspect nginx:alpine > /dev/null 2>&1; then
    info "Pulling nginx:alpine (not found locally)..."
    local pull_tries=0
    until docker pull nginx:alpine > /dev/null 2>&1; do
      pull_tries=$((pull_tries+1))
      [ "$pull_tries" -le 3 ] || die "Failed to pull nginx:alpine after 3 attempts — check Docker Hub connectivity"
      warn "Pull attempt $pull_tries failed, retrying in 10s..."
      sleep 10
    done
    ok "nginx:alpine pulled"
  else
    detail "nginx:alpine already available locally"
  fi

  info "Starting nginx (engine-1 + engine-2 upstream → localhost:3009)..."
  $V3_COMPOSE_CMD up $COMPOSE_UP_FLAGS -d nginx
  local tries=0
  until curl -sf "http://127.0.0.1:3009/nginx-health" > /dev/null 2>&1; do
    printf "."; sleep 2; tries=$((tries+1))
    if [ "$tries" -ge 15 ]; then
      echo ""
      warn "nginx logs:"
      $V3_COMPOSE_CMD logs --tail 20 nginx 2>/dev/null | sed 's/^/    /' || true
      die "nginx did not respond after 30s"
    fi
  done
  echo " OK"
  ok "nginx ready → http://localhost:3009  (routes to engine-1 + engine-2)"

  info "Starting test UI proxy..."
  $V3_COMPOSE_CMD up $COMPOSE_UP_FLAGS -d ui
  ok "UI proxy started → http://localhost:3002"
}

# ─── Derive signing WIF ────────────────────────────────────────────────────────
step_derive_wif() {
  header "Step — Derive signing key"
  local xprv
  xprv=$(env_get_dev_secret "$ENGINE_ENV" "BTC_DEV_XPRV")
  if [ -z "$xprv" ]; then
    die "BTC_DEV_XPRV not in engine/.env. Run './${START_SCRIPT_NAME} reset --signer $SIGNER_MODE' or provide an uncommented BTC_DEV_XPRV dev seed."
  fi
  if ! grep -qE "^BTC_DEV_XPRV=" "$ENGINE_ENV" 2>/dev/null; then
    env_set "$ENGINE_ENV" "BTC_DEV_XPRV" "$xprv"
    ok "Recovered BTC_DEV_XPRV from commented dev entry in engine/.env"
  fi
  ACCOUNT_XPRV="$xprv"
  info "Deriving hot-wallet WIF (account m/1/0)..."
  HOT_WALLET_WIF=$(
    cd "$ENGINE_DIR" && BTC_DEV_XPRV="$xprv" node --no-warnings -e "
      const { BIP32Factory } = require('bip32');
      const ecc = require('tiny-secp256k1');
      const bitcoin = require('bitcoinjs-lib');
      const bip32 = BIP32Factory(ecc);
      const node = bip32.fromBase58(process.env.BTC_DEV_XPRV, bitcoin.networks.regtest);
      process.stdout.write(node.derive(1).derive(0).toWIF() + '\n');
    " 2>/dev/null
  ) || die "WIF derivation failed"
  ok "Hot-wallet WIF derived"

  SIGNER_ENT_HD_FINGERPRINT=$(
    cd "$ENGINE_DIR" && BTC_DEV_XPRV="$xprv" node --no-warnings -e "
      const { BIP32Factory } = require('bip32');
      const ecc = require('tiny-secp256k1');
      const bitcoin = require('bitcoinjs-lib');
      const bip32 = BIP32Factory(ecc);
      const node = bip32.fromBase58(process.env.BTC_DEV_XPRV, bitcoin.networks.regtest);
      process.stdout.write('btc_hd:regtest:' + Buffer.from(node.fingerprint).toString('hex') + '\n');
    " 2>/dev/null
  ) || die "HD fingerprint derivation failed"
}

derive_vault_btc_fingerprint() {
  node --no-warnings -e "
    const crypto = require('crypto');
    const chunks = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => {
      const doc = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const keys = doc.data && doc.data.keys ? doc.data.keys : {};
      const latest = Object.keys(keys).map(Number).sort((a, b) => b - a)[0];
      const publicKey = latest ? keys[String(latest)].public_key : '';
      if (!publicKey) throw new Error('Vault Transit key has no public key');
      let keyObject;
      if (publicKey.includes('BEGIN PUBLIC KEY')) {
        keyObject = crypto.createPublicKey(publicKey);
      } else {
        keyObject = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
      }
      const jwk = keyObject.export({ format: 'jwk' });
      const x = Buffer.from(jwk.x, 'base64url');
      const y = Buffer.from(jwk.y, 'base64url');
      const prefix = (y[y.length - 1] & 1) ? 0x03 : 0x02;
      const compressed = Buffer.concat([Buffer.from([prefix]), x]);
      const sha = crypto.createHash('sha256').update(compressed).digest();
      const h160 = crypto.createHash('ripemd160').update(sha).digest();
      process.stdout.write('btc:regtest:' + h160.subarray(0, 4).toString('hex') + '\n');
    });
  "
}

derive_vault_btc_address() {
  node --no-warnings -e "
    const crypto = require('crypto');
    const bitcoin = require('bitcoinjs-lib');
    const chunks = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => {
      const doc = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const keys = doc.data && doc.data.keys ? doc.data.keys : {};
      const latest = Object.keys(keys).map(Number).sort((a, b) => b - a)[0];
      const publicKey = latest ? keys[String(latest)].public_key : '';
      if (!publicKey) throw new Error('Vault Transit key has no public key');
      let keyObject;
      if (publicKey.includes('BEGIN PUBLIC KEY')) {
        keyObject = crypto.createPublicKey(publicKey);
      } else {
        keyObject = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
      }
      const jwk = keyObject.export({ format: 'jwk' });
      const x = Buffer.from(jwk.x, 'base64url');
      const y = Buffer.from(jwk.y, 'base64url');
      const prefix = (y[y.length - 1] & 1) ? 0x03 : 0x02;
      const compressed = Buffer.concat([Buffer.from([prefix]), x]);
      process.stdout.write(bitcoin.payments.p2wpkh({ pubkey: compressed, network: bitcoin.networks.regtest }).address + '\n');
    });
  "
}

derive_wif_fingerprint() {
  node --no-warnings -e "
    const crypto = require('crypto');
    const bitcoin = require('bitcoinjs-lib');
    const ECPairFactory = require('ecpair').default || require('ecpair');
    const ecc = require('tiny-secp256k1');
    const ECPair = ECPairFactory(ecc);
    const keyPair = ECPair.fromWIF(process.env.HOT_WALLET_WIF, bitcoin.networks.regtest);
    const pubkey = Buffer.from(keyPair.publicKey);
    const sha = crypto.createHash('sha256').update(pubkey).digest();
    const h160 = crypto.createHash('ripemd160').update(sha).digest();
    process.stdout.write('btc:regtest:' + h160.subarray(0, 4).toString('hex') + '\n');
  "
}

derive_wif_address() {
  node --no-warnings -e "
    const bitcoin = require('bitcoinjs-lib');
    const ECPairFactory = require('ecpair').default || require('ecpair');
    const ecc = require('tiny-secp256k1');
    const ECPair = ECPairFactory(ecc);
    const keyPair = ECPair.fromWIF(process.env.HOT_WALLET_WIF, bitcoin.networks.regtest);
    process.stdout.write(bitcoin.payments.p2wpkh({ pubkey: Buffer.from(keyPair.publicKey), network: bitcoin.networks.regtest }).address + '\n');
  "
}

step_enterprise_vault() {
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] || return

  header "Step — Initialize Vault for Enterprise signer"
  if [ "$ENTERPRISE_PROVIDER" != "vault" ]; then
    warn "Enterprise provider '${ENTERPRISE_PROVIDER}' uses externally configured cloud KMS/secrets; skipping local Vault init"
    SIGNER_ENT_RESPONSE_KEY_HEX=$(env_get "$SIGNER_ENT_DIR/.env" "SIGNER_RESPONSE_SIGNING_KEY_HEX")
    if [ -z "$SIGNER_ENT_RESPONSE_KEY_HEX" ]; then
      SIGNER_ENT_RESPONSE_KEY_HEX=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
    fi
    return
  fi

  [ -n "${ACCOUNT_XPRV:-}" ] || die "ACCOUNT_XPRV missing — step_derive_wif must run first"

  if [ ! -f "$SIGNER_ENT_DIR/.env" ]; then
    cat > "$SIGNER_ENT_DIR/.env" <<'EOF'
# Placeholder created by btc-test-ui/start.sh so Docker Compose can start Vault
# before the enterprise signer .env is generated from enrollment.
SIGNER_PORT=3102
SIGNER_BIND_HOST=0.0.0.0
EOF
  fi

  info "Starting Vault dev server..."
  $V3_COMPOSE_CMD --profile signer-enterprise up $COMPOSE_UP_FLAGS -d vault

  info "Waiting for Vault..."
  local tries=0
  until curl -sf "http://localhost:8200/v1/sys/health" > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries+1))
    [ "$tries" -le 30 ] || die "Vault did not become ready after 60s"
  done
  echo " OK"
  ok "Vault ready → http://localhost:8200 (token: $VAULT_DEV_ROOT_TOKEN)"

  info "Enabling Transit + KV v2..."
  VAULT secrets enable transit >/dev/null 2>&1 || true
  local secret_kv_version
  secret_kv_version=$(VAULT secrets list -format=json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('secret/', {}).get('options', {}).get('version', ''))" 2>/dev/null || true)
  if [ "$secret_kv_version" != "2" ]; then
    warn "Vault mount secret/ is not KV v2; recreating it for btc-test-ui dev secrets"
    VAULT secrets disable secret >/dev/null 2>&1 || true
    VAULT secrets enable -path=secret -version=2 kv >/dev/null
  fi

  info "Ensuring Transit keys..."
  if VAULT read "transit/keys/${VAULT_TRANSIT_BTC_KEY}" >/dev/null 2>&1; then
    BTC_SIGNING_BACKEND="transit"
  else
    local transit_create_out
    if transit_create_out=$(VAULT write "transit/keys/${VAULT_TRANSIT_BTC_KEY}" type=secp256k1 2>&1); then
      BTC_SIGNING_BACKEND="transit"
    else
      BTC_SIGNING_BACKEND="kv_wif"
      warn "Vault Transit secp256k1 unavailable; using Vault KV WIF fallback for BTC withdrawal signing"
      detail "$(echo "$transit_create_out" | tail -1)"
    fi
  fi
  VAULT read "transit/keys/${VAULT_TRANSIT_EVM_KEY}" >/dev/null 2>&1 || \
    VAULT write "transit/keys/${VAULT_TRANSIT_EVM_KEY}" type=ecdsa-p256 >/dev/null

  if [ "$BTC_SIGNING_BACKEND" = "kv_wif" ]; then
    info "Writing hot-wallet WIF to Vault KV v2 fallback path..."
    printf '%s' "$HOT_WALLET_WIF" | $V3_COMPOSE_CMD exec -T vault sh -c \
      'cat > /tmp/chainapi-btc-hot-wallet-wif && chmod 600 /tmp/chainapi-btc-hot-wallet-wif'
    VAULT kv put -mount=secret "${VAULT_KV_SIGNER_PATH}/${VAULT_KV_HOT_WIF_PATH}" \
      "value=@/tmp/chainapi-btc-hot-wallet-wif" >/dev/null
    $V3_COMPOSE_CMD exec -T vault rm -f /tmp/chainapi-btc-hot-wallet-wif >/dev/null 2>&1 || true
  fi

  info "Writing sweep xprv to Vault KV v2 without exposing it as a process argument..."
  printf '%s' "$ACCOUNT_XPRV" | $V3_COMPOSE_CMD exec -T vault sh -c \
    'cat > /tmp/chainapi-btc-sweep-xprv && chmod 600 /tmp/chainapi-btc-sweep-xprv'
  VAULT kv put -mount=secret "${VAULT_KV_SIGNER_PATH}/${VAULT_KV_SWEEP_XPRV_PATH}" \
    "xprv=@/tmp/chainapi-btc-sweep-xprv" >/dev/null
  $V3_COMPOSE_CMD exec -T vault rm -f /tmp/chainapi-btc-sweep-xprv >/dev/null 2>&1 || true

  info "Writing open dev signing policy to Vault KV v2..."
  VAULT kv put -mount=secret "${VAULT_KV_SIGNER_PATH}/${VAULT_KV_POLICY_PATH}" \
    allowlistMode=open \
    maxDailyAmountRaw=100000000000 \
    maxSignaturesPerDay=10000 \
    policyVersion=btc-test-ui-dev >/dev/null

  info "Writing signer Vault policy + token..."
  VAULT policy write chain-api-signer-dev - >/dev/null <<EOF
path "transit/sign/${VAULT_TRANSIT_BTC_KEY}" { capabilities = ["update"] }
path "transit/sign/${VAULT_TRANSIT_EVM_KEY}" { capabilities = ["update"] }
path "transit/keys/${VAULT_TRANSIT_BTC_KEY}" { capabilities = ["read"] }
path "transit/keys/${VAULT_TRANSIT_EVM_KEY}" { capabilities = ["read"] }
path "secret/data/${VAULT_KV_SIGNER_PATH}/*" { capabilities = ["read"] }
EOF
  VAULT token lookup "$VAULT_DEV_SIGNER_TOKEN" >/dev/null 2>&1 || \
    VAULT token create -policy=chain-api-signer-dev -id="$VAULT_DEV_SIGNER_TOKEN" -period=768h >/dev/null

  local vault_addr transit_json
  if [ "$BTC_SIGNING_BACKEND" = "transit" ]; then
    transit_json=$(VAULT read -format=json "transit/keys/${VAULT_TRANSIT_BTC_KEY}") || die "Cannot read Vault Transit BTC key"
    SIGNER_ENT_FINGERPRINT=$(printf '%s' "$transit_json" | derive_vault_btc_fingerprint) || die "Cannot derive Vault Transit fingerprint"
    vault_addr=$(cd "$ENGINE_DIR" && printf '%s' "$transit_json" | derive_vault_btc_address) || die "Cannot derive Vault Transit address"
  else
    SIGNER_ENT_FINGERPRINT=$(cd "$SIGNER_ENT_DIR" && HOT_WALLET_WIF="$HOT_WALLET_WIF" derive_wif_fingerprint) || die "Cannot derive Vault KV WIF fingerprint"
    vault_addr=$(cd "$SIGNER_ENT_DIR" && HOT_WALLET_WIF="$HOT_WALLET_WIF" derive_wif_address) || die "Cannot derive Vault KV WIF address"
  fi

  SIGNER_ENT_RESPONSE_KEY_HEX=$(env_get "$SIGNER_ENT_DIR/.env" "SIGNER_RESPONSE_SIGNING_KEY_HEX")
  if [ -z "$SIGNER_ENT_RESPONSE_KEY_HEX" ]; then
    SIGNER_ENT_RESPONSE_KEY_HEX=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")
  fi

  local admin_key
  admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")
  if [ -n "$admin_key" ]; then
    info "Pointing tenant_default hot wallet at Vault Transit address..."
    curl -sf -X PATCH "http://localhost:3009/admin/v1/tenants/tenant_default/config" \
      -H "X-Admin-Key: $admin_key" \
      -H "Content-Type: application/json" \
      -d "{\"btcHotAddress\":\"${vault_addr}\"}" >/dev/null \
      && ok "tenant_default hot wallet updated for Vault Transit" \
      || warn "Could not update tenant hot wallet; withdrawal PSBTs may still target the seed-derived dev key"
  fi

  ok "Vault Transit BTC key ready"
  detail "BTC signing backend=${BTC_SIGNING_BACKEND}"
  detail "SIGNER_FINGERPRINT=${SIGNER_ENT_FINGERPRINT}"
  detail "Vault hot wallet address=${vault_addr}"
  detail "KV path=${VAULT_SECRET_PATH}"
}

configure_elasticsearch_dev_settings() {
  # Dev-only: Docker Desktop can sit above Elasticsearch's default 90% high
  # watermark even when there is enough room for this test stack. If allocation
  # is blocked, Kibana system indices stay unassigned and Kibana never becomes
  # ready.
  info "Applying Elasticsearch dev disk-allocation settings..."
  if curl -sf -X PUT "${ELASTIC_URL_HOST}/_cluster/settings" \
    -H "Content-Type: application/json" \
    -d '{"persistent":{"cluster.routing.allocation.disk.threshold_enabled":false}}' \
    > /dev/null; then
    ok "Elasticsearch disk watermark checks disabled for this dev cluster"
  else
    warn "Could not update Elasticsearch disk settings; Kibana may wait on unassigned shards"
    return
  fi

  curl -sf -X PUT "${ELASTIC_URL_HOST}/_all/_settings?expand_wildcards=all&allow_no_indices=true" \
    -H "Content-Type: application/json" \
    -d '{"index.blocks.read_only_allow_delete":null}' \
    > /dev/null 2>&1 || true
  curl -sf -X POST "${ELASTIC_URL_HOST}/_cluster/reroute?retry_failed=true" \
    > /dev/null 2>&1 || true
}

step_enterprise_siem() {
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] || return

  header "Step — Start Enterprise SIEM (Elastic)"

  info "Starting Elasticsearch..."
  $V3_COMPOSE_CMD --profile signer-enterprise up $COMPOSE_UP_FLAGS -d elasticsearch

  info "Waiting for Elasticsearch..."
  local tries=0
  until curl -sf "${ELASTIC_URL_HOST}/_cluster/health" > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries+1))
    [ "$tries" -le 45 ] || die "Elasticsearch did not become ready after 90s"
  done
  echo " OK"
  ok "Elasticsearch ready → ${ELASTIC_URL_HOST}"

  configure_elasticsearch_dev_settings

  info "Starting Kibana..."
  $V3_COMPOSE_CMD --profile signer-enterprise up $COMPOSE_UP_FLAGS -d --force-recreate kibana

  info "Waiting for Kibana (optional data-view setup)..."
  tries=0
  local kibana_status
  while true; do
    kibana_status=$(curl -sS -o /dev/null -w "%{http_code}" "${KIBANA_URL_HOST}/api/status" 2>/dev/null || true)
    [ "$kibana_status" = "200" ] && break
    printf "."
    sleep 2
    tries=$((tries+1))
    if [ "$tries" -ge 90 ]; then
      echo ""
      warn "Kibana did not become ready after 180s; SIEM data still goes to Elasticsearch"
      warn "Check: docker logs --tail 120 chainapi-kibana"
      return
    fi
  done
  echo " OK"
  ok "Kibana ready → ${KIBANA_URL_HOST}"

  info "Ensuring Kibana data view for ${ELASTIC_INDEX_PREFIX}-*..."
  curl -sf -X POST "${KIBANA_URL_HOST}/api/data_views/data_view" \
    -H "kbn-xsrf: true" \
    -H "Content-Type: application/json" \
    -d "{\"data_view\":{\"title\":\"${ELASTIC_INDEX_PREFIX}-*\",\"name\":\"chain-api signer audit\",\"timeFieldName\":\"@timestamp\"}}" \
    > /dev/null 2>&1 \
    && ok "Kibana data view ready: ${ELASTIC_INDEX_PREFIX}-*" \
    || warn "Kibana data view setup skipped/already exists; create ${ELASTIC_INDEX_PREFIX}-* manually if needed"
}

# ─── Enroll signers ────────────────────────────────────────────────────────────
# Enrollment hits nginx (localhost:3009) → stored in shared PostgreSQL → visible
# to both engine-1 and engine-2. Signer .env points to nginx, not a single engine.
step_enroll_signers() {
  header "Step — Enroll signer(s)"
  local api_key base
  api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  base="http://localhost:3009"

  _enroll_signer() {
    local edition="$1" fingerprint="$2" name="$3" signer_dir="$4" port="$5"

    [ -d "$signer_dir" ] || die "$name directory not found: $signer_dir"
    info "Enrolling '$name' via nginx → shared DB..."
    local body result signer_id
    local key_provider
    key_provider="env"
    [ "$edition" = "enterprise" ] && key_provider="$ENTERPRISE_PROVIDER"
    body=$(printf '{"name":"%s","signerFingerprint":"%s","publicKey":"ed25519:devpubkey:%s","capabilities":{"chains":["bitcoin"],"assets":["bitcoin:BTC"],"formats":["btc_psbt"]},"edition":"%s","connectivityMode":"polling","keyProvider":"%s"}' \
      "$name" "$fingerprint" "$edition" "$edition" "$key_provider")
    result=$(curl -sf -X POST "${base}/v1/external-signers/enroll" \
      -H "Authorization: Bearer $api_key" \
      -H "Content-Type: application/json" \
      -d "$body") || die "Enrollment failed for $name"
    signer_id=$(echo "$result" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null) \
      || die "Parse error: $result"
    ok "Enrolled → $signer_id (stored in shared DB, visible to both engines)"

    if [ "$edition" = "community" ]; then
      cat > "$signer_dir/.env" <<EOF
# chain-api OSS Signer — auto-generated by start.sh (regtest dev)
# CHAIN_API_BASE_URL points to nginx LB (http://localhost:3009).
# nginx routes to engine-1:3000 and engine-2:3000 round-robin with passive health checks.
CHAIN_API_BASE_URL=http://localhost:3009
CHAIN_API_FALLBACK_URLS=
SIGNER_API_KEY=${api_key}
SIGNER_ID=${signer_id}
TENANT_ID=tenant_default
SIGNER_NAME=${name}
SIGNER_FINGERPRINT=${fingerprint}
SIGNER_PUBLIC_KEY=ed25519:devpubkey:community:regtest
BTC_SIGNING_MODE=dev_env_key
BTC_DEV_PRIVATE_KEY_WIF=${HOT_WALLET_WIF}
BTC_DEV_ACCOUNT_XPRV=${ACCOUNT_XPRV}
BTC_NETWORK=regtest
POLL_INTERVAL_MS=3000
TASK_BATCH_SIZE=5
SUPPORTED_CHAINS=bitcoin
SUPPORTED_ASSETS=bitcoin:BTC
SUPPORTED_FORMATS=btc_psbt
MAX_AUTO_SIGN_AMOUNT_SATS=100000000
MAX_FEE_RATE_SAT_VB=50
MAX_OUTPUTS_PER_BATCH=200
SIGNER_PORT=${port}
SIGNER_BIND_HOST=0.0.0.0
SIGNER_AUTO_ENROLL=true
AUDIT_STDOUT=true
AUDIT_LOG_FILE=./data/audit.log
EOF
    else
      local enterprise_key_provider enterprise_secret_provider enterprise_signing_provider enterprise_config_provider
      enterprise_key_provider="hashicorp_vault_transit"
      enterprise_secret_provider="vault"
      enterprise_signing_provider="vault_transit"
      enterprise_config_provider="vault"
      case "$ENTERPRISE_PROVIDER" in
        aws)
          enterprise_key_provider="aws_kms"
          enterprise_secret_provider="aws"
          enterprise_signing_provider="aws_kms"
          enterprise_config_provider="aws"
          ;;
        azure)
          enterprise_key_provider="env"
          enterprise_secret_provider="azure"
          enterprise_signing_provider="azure_key_vault"
          enterprise_config_provider="azure"
          ;;
        gcp)
          enterprise_key_provider="env"
          enterprise_secret_provider="gcp"
          enterprise_signing_provider="gcp_kms"
          enterprise_config_provider="gcp"
          ;;
      esac
      cat > "$signer_dir/.env" <<EOF
# chain-api Enterprise Signer — auto-generated by start.sh (regtest dev)
# Enterprise provider: ${ENTERPRISE_PROVIDER}
# BTC withdrawal signing backend: ${BTC_SIGNING_BACKEND}
#   transit = Vault Transit (${VAULT_TRANSIT_BTC_KEY})
#   kv_wif  = Vault KV fallback (${VAULT_SECRET_PATH}/${VAULT_KV_HOT_WIF_PATH})
# BTC sweep signing secret: ${VAULT_KV_SWEEP_XPRV_PATH}
CHAIN_API_BASE_URL=http://localhost:3009
CHAIN_API_FALLBACK_URLS=
SIGNER_API_KEY=${api_key}
SIGNER_ID=${signer_id}
TENANT_ID=tenant_default
SIGNER_NAME=${name}
SIGNER_FINGERPRINT=${fingerprint}
SIGNER_FINGERPRINT_HD=${SIGNER_ENT_HD_FINGERPRINT}
SIGNER_PUBLIC_KEY=ed25519:devpubkey:enterprise:regtest
KEY_PROVIDER=${enterprise_key_provider}
SECRET_PROVIDER=${enterprise_secret_provider}
SIGNING_PROVIDER=${enterprise_signing_provider}
BTC_SWEEP_XPRV_SECRET_NAME=${VAULT_KV_SWEEP_XPRV_PATH}
POLICY_SECRET_NAME=${VAULT_KV_POLICY_PATH}
VAULT_ADDR=http://vault:8200
VAULT_AUTH_METHOD=token
VAULT_TOKEN=${VAULT_DEV_SIGNER_TOKEN}
VAULT_TRANSIT_BTC_KEY=${VAULT_TRANSIT_BTC_KEY}
VAULT_TRANSIT_EVM_KEY=${VAULT_TRANSIT_EVM_KEY}
VAULT_SECRET_PATH=${VAULT_SECRET_PATH}
VAULT_KV_HOT_WIF_PATH=${VAULT_KV_HOT_WIF_PATH}
VAULT_KV_SWEEP_XPRV_PATH=${VAULT_KV_SWEEP_XPRV_PATH}
VAULT_KV_POLICY_PATH=${VAULT_KV_POLICY_PATH}
VAULT_SECRET_CACHE_TTL_MS=60000
BTC_NETWORK=regtest
POLL_INTERVAL_MS=1000
TASK_BATCH_SIZE=20
SIGNER_CONCURRENCY=4
CONFIG_PROVIDER=${enterprise_config_provider}
TRANSPORT_SECURITY=https
SIGNER_PORT=${port}
SIGNER_BIND_HOST=0.0.0.0
AUDIT_SINK=siem
SIEM_PROVIDER=${SIEM_PROVIDER}
ELASTIC_URL=${ELASTIC_URL_INTERNAL}
ELASTIC_INDEX_PREFIX=${ELASTIC_INDEX_PREFIX}
ELASTIC_BATCH_SIZE=1
ELASTIC_FLUSH_INTERVAL_MS=1000
AUDIT_FALLBACK_FILE=./data/audit-fallback.jsonl
AUDIT_CHAIN_ENABLED=true
AUDIT_CHAIN_FILE=./data/audit-chain.jsonl
SIGNER_RESPONSE_SIGNING_KEY_HEX=${SIGNER_ENT_RESPONSE_KEY_HEX}
SUPPORTED_CHAINS=bitcoin
SUPPORTED_ASSETS=bitcoin:BTC
SUPPORTED_FORMATS=btc_psbt
EOF
      case "$ENTERPRISE_PROVIDER" in
        aws)
          cat >> "$signer_dir/.env" <<EOF
AWS_REGION=${AWS_REGION:-eu-central-1}
AWS_SECRETS_PREFIX=${AWS_SECRETS_PREFIX:-chain-api/signer/dev-enterprise}
AWS_KMS_BTC_KEY_ID=${AWS_KMS_BTC_KEY_ID:-alias/chain-api-btc-hot-wallet}
EOF
          ;;
        azure)
          cat >> "$signer_dir/.env" <<EOF
AZURE_TENANT_ID=${AZURE_TENANT_ID:-}
AZURE_CLIENT_ID=${AZURE_CLIENT_ID:-}
AZURE_CLIENT_SECRET=${AZURE_CLIENT_SECRET:-}
AZURE_KEY_VAULT_URL=${AZURE_KEY_VAULT_URL:-https://your-vault-name.vault.azure.net}
AZURE_BTC_KEY_NAME=${AZURE_BTC_KEY_NAME:-btc-hot-wallet}
EOF
          ;;
        gcp)
          cat >> "$signer_dir/.env" <<EOF
GCP_PROJECT_ID=${GCP_PROJECT_ID:-your-gcp-project}
GCP_SECRET_PREFIX=${GCP_SECRET_PREFIX:-chain-api-signer-dev}
GCP_KMS_LOCATION=${GCP_KMS_LOCATION:-global}
GCP_KMS_KEY_RING=${GCP_KMS_KEY_RING:-chain-api}
GCP_KMS_BTC_KEY=${GCP_KMS_BTC_KEY:-btc-hot-wallet}
GCP_KMS_CRYPTO_KEY_VERSION=${GCP_KMS_CRYPTO_KEY_VERSION:-}
EOF
          ;;
      esac
    fi
    ok ".env written → $signer_dir/.env  (CHAIN_API_BASE_URL=http://localhost:3009)"

    info "Setting auto-sign policy for $name..."
    curl -sf -X PUT "${base}/v1/external-signers/policies" \
      -H "Authorization: Bearer $api_key" \
      -H "Content-Type: application/json" \
      -d "{\"policies\":[{\"signerId\":\"$signer_id\",\"autoSignLimitRaw\":\"100000000\",\"dailyAutoSignLimitRaw\":\"1000000000\",\"maxFeeRateSatVb\":50,\"maxOutputsPerBatch\":200}]}" \
      > /dev/null || warn "Policy setup failed (manual approval needed)"
    ok "Auto-sign policy set"
  }

  [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]] && \
    _enroll_signer "community"  "$SIGNER_OSS_FINGERPRINT" "Dev OSS Signer"        "$SIGNER_OSS_DIR" "3101"
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && \
    _enroll_signer "enterprise" "$SIGNER_ENT_FINGERPRINT" "Dev Enterprise Signer" "$SIGNER_ENT_DIR" "3102"
}

# ─── Start signers via Docker Compose profiles ────────────────────────────────
step_signers_docker() {
  header "Step — Start signer(s) via Docker Compose"

  local profile=""
  [[ "$SIGNER_MODE" == "oss" ]]        && profile="signer-oss"
  [[ "$SIGNER_MODE" == "enterprise" ]] && profile="signer-enterprise"
  [[ "$SIGNER_MODE" == "both" ]]       && profile="signer-all"

  [ -z "$profile" ] && return

  if [[ "${CHAINAPI_SKIP_LOCAL_BUILD:-false}" == "true" ]]; then
    info "Pulling and starting signer(s) from Docker Hub (profile: $profile)..."
    case "$SIGNER_MODE" in
      oss) $V3_COMPOSE_CMD --profile "$profile" pull signer-oss ;;
      enterprise) $V3_COMPOSE_CMD --profile "$profile" pull signer-enterprise ;;
      both) $V3_COMPOSE_CMD --profile "$profile" pull signer-oss signer-enterprise ;;
    esac
  else
    info "Building and starting signer(s) (profile: $profile)..."
    $V3_COMPOSE_CMD --profile "$profile" build
  fi
  if [[ "$SIGNER_MODE" == "enterprise" && "$ENTERPRISE_PROVIDER" != "vault" ]]; then
    $V3_COMPOSE_CMD --profile "$profile" up $COMPOSE_UP_FLAGS -d --no-deps signer-enterprise
  else
    $V3_COMPOSE_CMD --profile "$profile" up $COMPOSE_UP_FLAGS -d
  fi

  sleep 3

  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]; then
    ok "signer-oss container started → localhost:3101"
    detail "Polling: http://nginx:3009 (container) = http://localhost:3009 (host)"
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    ok "signer-enterprise container started → localhost:3102"
    if [ "$ENTERPRISE_PROVIDER" = "vault" ]; then
      detail "Vault: http://vault:8200 (container) = http://localhost:8200 (host)"
    fi
    detail "Enterprise provider: ${ENTERPRISE_PROVIDER}"
    detail "SIEM: ${SIEM_PROVIDER} → ${ELASTIC_URL_INTERNAL} (container) = ${ELASTIC_URL_HOST} (host)"
  fi
  detail "Signer .env → CHAIN_API_BASE_URL=http://localhost:3009 (overridden to nginx in container)"
}

# ─── Step 10: Verify cluster ───────────────────────────────────────────────────
step_verify_cluster() {
  header "Step 10 — Verify cluster"

  local admin_key
  admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")

  info "Checking cluster status via engine-1..."
  local status
  status=$(curl -sf -H "X-Admin-Key: $admin_key" \
    "http://localhost:3000/admin/v1/cluster/status" 2>/dev/null) || { warn "Cluster status unavailable"; return; }

  local leader instance_count
  leader=$(echo "$status" | python3 -c \
    "import sys,json; d=json.load(sys.stdin)['data']; print(d.get('currentLeader',{}).get('id','none') if d.get('currentLeader') else 'none')" 2>/dev/null || echo "unknown")
  instance_count=$(echo "$status" | python3 -c \
    "import sys,json; d=json.load(sys.stdin)['data']; print(len(d.get('instances',[])))" 2>/dev/null || echo "?")

  ok "Cluster instances: $instance_count"
  ok "Current leader: $leader"
}

# ─── Print status ──────────────────────────────────────────────────────────────
step_status() {
  local api_key admin_key
  api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")

  echo ""
  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo -e "${C_BOLD}  chain-api dev environment ready${C_RESET}"
  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo ""
  echo -e "  ${C_CYAN}API key${C_RESET}           ${api_key}"
  echo -e "  ${C_CYAN}Admin key${C_RESET}         ${admin_key}"
  echo ""
  echo -e "  ${C_BOLD}── Engines (active-active) ─────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}engine-1${C_RESET}          →  http://localhost:3000  (leader candidate)"
  echo -e "  ${C_GREEN}engine-2${C_RESET}          →  http://localhost:3001  (active standby)"
  if [[ "$DEBUG_MODE" == "true" ]]; then
    echo ""
    echo -e "  ${C_BOLD}${C_YELLOW}── Debug (Node.js inspector — Docker) ──────────────────${C_RESET}"
    echo -e "  ${C_CYAN}engine-1 inspector${C_RESET}  →  localhost:${ENGINE1_DOCKER_DEBUG_PORT}  (VSCode: \"Attach: Engine-1 (v3 Docker)\")"
    echo -e "  ${C_CYAN}engine-2 inspector${C_RESET}  →  localhost:${ENGINE2_DOCKER_DEBUG_PORT}  (VSCode: \"Attach: Engine-2 (v3 Docker)\")"
    [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]] && \
      echo -e "  ${C_CYAN}signer-oss inspector${C_RESET} →  127.0.0.1:${SIGNER_OSS_DEBUG_PORT}  (VSCode: \"Attach: OSS Signer\")"
    [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && \
      echo -e "  ${C_CYAN}signer-ent inspector${C_RESET} →  127.0.0.1:${SIGNER_ENT_DEBUG_PORT}  (VSCode: \"Attach: Enterprise Signer\")"
    echo -e "  ${C_YELLOW}VSCode → Run & Debug → pick \"Attach: Engine-1 (v3 Docker)\" or compound${C_RESET}"
  fi
  echo ""
  echo -e "  ${C_BOLD}── Bitcoin Core (regtest, peered) ──────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}btc-node-1${C_RESET}        →  http://localhost:18443  (active, mines in dev)"
  echo -e "  ${C_GREEN}btc-node-2${C_RESET}        →  http://localhost:18453  (active, equivalent to node-1)"
  echo ""
  echo -e "  ${C_BOLD}── Block Indexers ──────────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}btc-indexer-1${C_RESET}     →  watches btc-node-1 → chain_events"
  echo -e "  ${C_GREEN}btc-indexer-2${C_RESET}     →  watches btc-node-2 → chain_events (dedup)"
  echo ""
  echo -e "  ${C_BOLD}── Database ────────────────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}PostgreSQL${C_RESET}        →  localhost:5433  db=chainapi  user=chainapi"
  echo ""
  echo -e "  ${C_BOLD}── Load Balancer (nginx) ────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}nginx${C_RESET}             →  http://localhost:3009  (engine-1 + engine-2 upstream)"
  detail "Signers + test clients should use localhost:3009 (not a single engine)"
  echo ""
  echo -e "  ${C_BOLD}── Test UI ─────────────────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}ui${C_RESET}                →  http://localhost:3002"
  echo ""
  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]; then
    echo -e "  ${C_BOLD}── Signers ─────────────────────────────────────────────${C_RESET}"
    echo -e "  ${C_GREEN}signer-oss${C_RESET}        →  http://localhost:3101  (Docker, polls nginx:3009)"
    detail "Signer polls nginx (failover across engines). Task claims safe: PostgreSQL isolation."
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    echo -e "  ${C_GREEN}signer-ent${C_RESET}        →  http://localhost:3102  (Docker, polls nginx:3009)"
    if [ "$ENTERPRISE_PROVIDER" = "vault" ]; then
      detail "Enterprise signer uses Vault Transit/KV → http://localhost:8200 (token: dev-root-token)"
    else
      detail "Enterprise signer uses external ${ENTERPRISE_PROVIDER} KMS/secrets configured in signer/.env"
    fi
    detail "Enterprise signer audit sink: Elastic SIEM → http://localhost:9200"
    detail "Browse audit events in Kibana → http://localhost:5601/app/discover"
    detail "Data view/index pattern: ${ELASTIC_INDEX_PREFIX}-*"
    detail "SIGNER_FINGERPRINT=${SIGNER_ENT_FINGERPRINT}"
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    echo ""
    echo -e "  ${C_BOLD}── Enterprise SIEM ─────────────────────────────────────${C_RESET}"
    echo -e "  ${C_GREEN}elasticsearch${C_RESET}    →  ${ELASTIC_URL_HOST}  (indices: ${ELASTIC_INDEX_PREFIX}-*)"
    echo -e "  ${C_GREEN}kibana${C_RESET}           →  ${KIBANA_URL_HOST}/app/discover"
    detail "Events appear after signer processes/rejects/signs tasks."
  fi
  echo ""
  echo -e "  ${C_BOLD}── Useful commands ─────────────────────────────────────${C_RESET}"
  echo ""
  local btcli="$V3_COMPOSE_CMD exec -T btc-node-1 bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=$MINING_WALLET"
  echo -e "  ${C_CYAN}Mine a block (confirms deposits):${C_RESET}"
  echo "    ADDR=\$($btcli getnewaddress mine bech32) && $btcli generatetoaddress 1 \$ADDR"
  echo ""
  echo -e "  ${C_CYAN}Send to deposit address:${C_RESET}"
  echo "    $btcli sendtoaddress <deposit_addr> 0.001"
  echo ""
  echo -e "  ${C_CYAN}API via nginx LB (stable endpoint):${C_RESET}"
  echo "    curl -s -H 'Authorization: Bearer $api_key' http://localhost:3009/v1/deposits | python3 -m json.tool"
  echo ""
  echo -e "  ${C_CYAN}Check chain_events (deposits detected by indexers):${C_RESET}"
  echo "    $V3_COMPOSE_CMD exec -T postgres \\"
  echo "      psql -U chainapi -d chainapi -c 'SELECT event_type,address,amount_raw,confirmations,node_id FROM chain_events ORDER BY created_at DESC LIMIT 10;'"
  echo ""
  echo -e "  ${C_CYAN}Cluster status:${C_RESET}"
  echo "    curl -s -H 'X-Admin-Key: $admin_key' http://localhost:3009/admin/v1/cluster/status | python3 -m json.tool"
  echo ""
  echo -e "  ${C_CYAN}Signers (if enrolled):${C_RESET}"
  echo "    curl -s -H 'Authorization: Bearer $api_key' http://localhost:3009/v1/external-signers | python3 -m json.tool"
  echo ""
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    echo -e "  ${C_CYAN}Enterprise SIEM audit events:${C_RESET}"
    echo "    open ${KIBANA_URL_HOST}/app/discover"
    echo "    curl -s '${ELASTIC_URL_HOST}/${ELASTIC_INDEX_PREFIX}-*/_search?size=10&sort=@timestamp:desc' | python3 -m json.tool"
    echo "    curl -s '${ELASTIC_URL_HOST}/_cat/indices/${ELASTIC_INDEX_PREFIX}-*?v'"
    echo ""
  fi
  echo -e "  ${C_CYAN}Logs:${C_RESET}"
  echo "    $V3_COMPOSE_CMD logs -f engine-1 engine-2 nginx"
  echo "    $V3_COMPOSE_CMD logs -f btc-indexer-1 btc-indexer-2"
  [[ "$SIGNER_MODE" != "none" && "$ENTERPRISE_PROVIDER" = "vault" ]] && \
    echo "    $V3_COMPOSE_CMD logs -f signer-oss signer-enterprise vault"
  [[ "$SIGNER_MODE" != "none" && "$ENTERPRISE_PROVIDER" != "vault" ]] && \
    echo "    $V3_COMPOSE_CMD logs -f signer-oss signer-enterprise"
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && \
    echo "    $V3_COMPOSE_CMD logs -f elasticsearch kibana   # SIEM debug only"
  echo ""
  echo -e "  ${C_YELLOW}Stop:  ./${START_SCRIPT_NAME} stop${C_RESET}"
  echo -e "  ${C_YELLOW}Reset: ./${START_SCRIPT_NAME} reset${C_RESET}"
  echo ""
}

# ─── Tail logs ────────────────────────────────────────────────────────────────
step_tail() {
  trap "cmd_stop; exit 0" INT TERM
  local services="engine-1 engine-2 btc-indexer-1 btc-indexer-2 nginx"
  [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]        && services="$services signer-oss"
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ && "$ENTERPRISE_PROVIDER" = "vault" ]] && services="$services vault signer-enterprise"
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ && "$ENTERPRISE_PROVIDER" != "vault" ]] && services="$services signer-enterprise"
  info "Tailing logs: $services (Ctrl+C to stop all)..."
  $V3_COMPOSE_CMD logs -f $services &
  wait
}

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────
case "$CMD" in

  stop)
    cmd_stop
    ;;

  reset)
    cmd_reset
    step_build
    step_infra
    step_genesis
    step_engine_env
    step_seed
    step_engines
    step_register_nodes
    step_indexers
    # nginx must start BEFORE signer enrollment — enrollment calls localhost:3009 (nginx)
    step_nginx_ui
    if [[ "$SIGNER_MODE" != "none" ]]; then
      step_derive_wif
      step_enterprise_vault
      step_enterprise_siem
      step_enroll_signers
      step_signers_docker
    fi
    step_verify_cluster
    step_status
    step_tail
    ;;

  start|"")
    step_build
    step_infra
    step_genesis
    step_engine_env
    step_seed
    step_engines
    step_register_nodes
    step_indexers
    # nginx must start BEFORE signer enrollment — enrollment calls localhost:3009 (nginx)
    step_nginx_ui
    if [[ "$SIGNER_MODE" != "none" ]]; then
      step_derive_wif
      step_enterprise_vault
      step_enterprise_siem
      step_enroll_signers
      step_signers_docker
    fi
    step_verify_cluster
    step_status
    step_tail
    ;;

  -h|--help|help)
    echo ""
    echo "  Usage: ${START_SCRIPT_NAME} [command] [options]"
    echo ""
    echo "  Commands:"
    echo "    start   Start — idempotent, safe to run any time  (default)"
    echo "    reset   Wipe data + restart fresh"
    echo "    stop    Stop all services"
    echo ""
    echo "  Options:"
    echo "    --signer oss          Add OSS signer daemon"
    echo "    --signer enterprise   Add Enterprise signer daemon"
    echo "    --signer both         Add both signer daemons"
    echo "    --enterprise-provider vault|aws|azure|gcp"
    echo "                          Enterprise signer key/secret provider (default: vault)"
    echo "    --debug               Node.js inspector on engines (Docker)"
    echo "                          engine-1 → 9229, engine-2 → 9232"
    echo ""
    echo "  Examples:"
    echo "    ./${START_SCRIPT_NAME}                         # full stack"
    echo "    ./${START_SCRIPT_NAME} --signer oss            # + OSS signer"
    echo "    ./${START_SCRIPT_NAME} --signer both           # + both signers"
    echo "    ./${START_SCRIPT_NAME} --signer enterprise --enterprise-provider aws"
    echo "    ./${START_SCRIPT_NAME} reset                   # full reset + restart"
    echo "    ./${START_SCRIPT_NAME} reset --signer oss      # full reset + OSS signer"
    echo "    ./${START_SCRIPT_NAME} stop                    # stop all services"
    echo "    ./${START_SCRIPT_NAME} --debug                 # with Node.js inspector"
    echo ""
    echo "  Endpoints:"
    echo "    Engine 1:      http://localhost:3000"
    echo "    Engine 2:      http://localhost:3001"
    echo "    nginx LB:      http://localhost:3009  (stable endpoint)"
    echo "    Vault dev:     http://localhost:8200  (enterprise signer only)"
    echo "    Elastic SIEM:  http://localhost:9200  (enterprise signer only)"
    echo "    Kibana:        http://localhost:5601  (enterprise signer only)"
    echo "    BTC Node 1:    http://localhost:18443  (primary, mines)"
    echo "    BTC Node 2:    http://localhost:18453  (standby, syncs)"
    echo "    PostgreSQL:    localhost:5433  (chainapi/chainapi_dev)"
    echo "    Test UI:       http://localhost:3002"
    echo ""
    ;;

  *)
    err "Unknown command: $CMD"
    echo "  Run '$(basename "$0") --help' for usage."
    exit 1
    ;;
esac
