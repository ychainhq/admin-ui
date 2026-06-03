#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — Ychain / chain-api development environment launcher
#
# MODES
# ──────
#   Default (no --v3):  single BTC Core (regtest), SQLite, one engine
#   --v3:               2 × BTC Core (regtest, peered), PostgreSQL,
#                       2 × engine (active-active cluster), 2 × btc-indexer
#
# USAGE
# ──────
#   ./start.sh                            start (default mode, engine only)
#   ./start.sh --v3                       start v3 (full stack, Docker Compose)
#   ./start.sh --v3 --signer oss          v3 + OSS signer
#   ./start.sh --v3 --signer both         v3 + both signers
#   ./start.sh --signer oss               default mode + OSS signer
#   ./start.sh --signer enterprise        default mode + Enterprise signer
#   ./start.sh --signer both              default mode + both signers
#   ./start.sh --debug                    default mode with Node.js inspector
#   ./start.sh --v3 --debug               v3 mode with debugger on engine-1 (9229) + engine-2 (9232)
#   ./start.sh reset                      wipe + restart (default mode)
#   ./start.sh reset --v3                 wipe + restart (v3 mode)
#   ./start.sh stop                       stop everything
#
# V3 ARCHITECTURE (--v3)
# ──────────────────────
#   btc-node-1   — Bitcoin Core regtest (primary, mines blocks)
#   btc-node-2   — Bitcoin Core regtest (standby, syncs via P2P)
#   postgres     — PostgreSQL 16 (shared DB for both engines)
#   engine-1     — chain-api (active, cluster leader candidate)
#   engine-2     — chain-api (active-active, SKIP LOCKED for work distribution)
#   btc-indexer-1 — scans btc-node-1 blocks → chain_events
#   btc-indexer-2 — scans btc-node-2 blocks → chain_events (dedup via UNIQUE)
#   ui           — test proxy (http://localhost:3002)
#
# RPC endpoints in v3 mode:
#   engine-1:          http://localhost:3000
#   engine-2:          http://localhost:3001
#   btc-node-1 RPC:    http://localhost:18443
#   btc-node-2 RPC:    http://localhost:18453
#   PostgreSQL:        localhost:5433  (user: chainapi, db: chainapi)
#
# DEBUG PORTS (used with --debug)
# ──────────────────────────────
# Default mode (local processes):
#   Engine:            9229   → "Attach: Engine"
#   OSS Signer:        9230   → "Attach: OSS Signer"
#   Enterprise Signer: 9231   → "Attach: Enterprise Signer"
#
# V3 mode (Docker containers via docker-compose.v3.debug.yml overlay):
#   Engine-1 (Docker): 9229   → "Attach: Engine-1 (v3 Docker)"
#   Engine-2 (Docker): 9232   → "Attach: Engine-2 (v3 Docker)"
#   OSS Signer (local): 9230  → "Attach: OSS Signer"  (signers run locally)
#   Enterprise (local): 9231  → "Attach: Enterprise Signer"
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENGINE_DIR="$ROOT_DIR/engine"
SIGNER_OSS_DIR="$ROOT_DIR/signer-oss"
SIGNER_ENT_DIR="$ROOT_DIR/signer"

UI_ENV="$SCRIPT_DIR/.env"
ENGINE_ENV="$ENGINE_DIR/.env"
ENGINE_DB="$ENGINE_DIR/data/chain-api.db"
MINING_WALLET="btcminer"

# PID files for local (non-v3) mode
ENGINE_PIDFILE="$ENGINE_DIR/.engine.pid"
SIGNER_OSS_PIDFILE="$SIGNER_OSS_DIR/.signer.pid"
SIGNER_ENT_PIDFILE="$SIGNER_ENT_DIR/.signer.pid"

# Stable fingerprints for signer enrollment
SIGNER_OSS_FINGERPRINT="btc:regtest:dev_oss"
SIGNER_ENT_FINGERPRINT="btc:regtest:dev_enterprise"

# Debug ports (default/legacy mode — local Node.js processes)
ENGINE_DEBUG_PORT=9229
SIGNER_OSS_DEBUG_PORT=9230
SIGNER_ENT_DEBUG_PORT=9231

# v3 debug ports (Docker containers)
# engine-2 uses 9232 to avoid conflict with signer-oss on 9230
ENGINE1_DOCKER_DEBUG_PORT=9229
ENGINE2_DOCKER_DEBUG_PORT=9232

# v3 compose file — V3_COMPOSE_CMD is finalized after arg parsing (may add debug overlay)
V3_COMPOSE="$SCRIPT_DIR/docker-compose.v3.yml"
V3_COMPOSE_DEBUG="$SCRIPT_DIR/docker-compose.v3.debug.yml"
# V3_COMPOSE_CMD set below after DEBUG_MODE is known

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
V3_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    start|reset|stop|-h|--help|help) CMD="$1"; shift ;;
    --v3) V3_MODE=true; shift ;;
    --signer)
      [[ $# -ge 2 ]] || die "--signer requires an argument: oss|enterprise|both"
      SIGNER_MODE="$2"; shift 2 ;;
    --debug) DEBUG_MODE=true; shift ;;
    *)
      err "Unknown argument: $1"
      echo "  Run '$(basename "$0") --help' for usage."
      exit 1 ;;
  esac
done

[[ "$SIGNER_MODE" =~ ^(none|oss|enterprise|both)$ ]] || \
  die "Invalid --signer value: '$SIGNER_MODE'. Use: oss, enterprise, both"

# Finalize V3_COMPOSE_CMD — add debug overlay when --debug --v3
if [[ "$V3_MODE" == "true" && "$DEBUG_MODE" == "true" ]]; then
  V3_COMPOSE_CMD="docker compose -f $V3_COMPOSE -f $V3_COMPOSE_DEBUG"
else
  V3_COMPOSE_CMD="docker compose -f $V3_COMPOSE"
fi

# ─── Bitcoin CLI wrappers ─────────────────────────────────────────────────────
# Default (non-v3): single node via docker-compose.yml
BTC() {
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T bitcoin-core \
    bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin "$@"
}

# v3: node-1 via docker-compose.v3.yml
BTC1() {
  $V3_COMPOSE_CMD exec -T btc-node-1 \
    bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin "$@"
}

# v3: node-2 via docker-compose.v3.yml
BTC2() {
  $V3_COMPOSE_CMD exec -T btc-node-2 \
    bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin "$@"
}

# ─── .env helpers ─────────────────────────────────────────────────────────────
env_get() {
  grep -E "^${2}=" "${1}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' \t' || true
}

env_set() {
  local file="$1" key="$2" val="$3"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$val" >> "$file"
  fi
}

# ─── Cleanup — local mode ─────────────────────────────────────────────────────
cleanup_local() {
  echo ""
  local engine_pid signer_oss_pid signer_ent_pid
  engine_pid=$(cat "$ENGINE_PIDFILE" 2>/dev/null || true)
  signer_oss_pid=$(cat "$SIGNER_OSS_PIDFILE" 2>/dev/null || true)
  signer_ent_pid=$(cat "$SIGNER_ENT_PIDFILE" 2>/dev/null || true)

  local any=false
  for pid in $engine_pid $signer_oss_pid $signer_ent_pid; do
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null && any=true && break
  done

  if [[ "$any" == "true" ]]; then
    info "Shutting down local processes..."
    for pid in $engine_pid $signer_oss_pid $signer_ent_pid; do
      [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
  fi

  rm -f "$ENGINE_PIDFILE" "$SIGNER_OSS_PIDFILE" "$SIGNER_ENT_PIDFILE"
}

# ─────────────────────────────────────────────────────────────────────────────
#  V3 MODE — full stack via docker-compose.v3.yml
# ─────────────────────────────────────────────────────────────────────────────

# ─── v3: stop legacy (default) docker-compose containers ─────────────────────
# Prevents port conflicts when switching from default mode to v3.
# Default docker-compose.yml uses ports 18443 (BTC RPC) and 3001 (UI)
# which overlap with v3 services.
stop_legacy_compose() {
  local legacy_compose="$SCRIPT_DIR/docker-compose.yml"
  if [ -f "$legacy_compose" ]; then
    local running
    running=$(docker compose -f "$legacy_compose" ps --status running -q 2>/dev/null | wc -l | tr -d ' ')
    if [ "$running" -gt "0" ] 2>/dev/null || \
       docker compose -f "$legacy_compose" ps 2>/dev/null | grep -qE "Up|running"; then
      info "Stopping legacy docker-compose.yml containers (port conflict prevention)..."
      docker compose -f "$legacy_compose" down 2>/dev/null || true
      ok "Legacy containers stopped"
    fi
  fi
}

# ─── v3: stop ─────────────────────────────────────────────────────────────────
cmd_v3_stop() {
  header "V3 Stop"
  # --profile signer-all stops signer containers started via profiles (signer-oss, signer-enterprise).
  # Without profiles, docker compose down leaves profile containers running → network stays in use.
  $V3_COMPOSE_CMD --profile signer-all down
  # Kill any remaining orphan containers using the network
  docker compose -f "$V3_COMPOSE" --profile signer-all rm -sf 2>/dev/null || true
  ok "All v3 services stopped"
  cleanup_local
}

# ─── v3: reset ────────────────────────────────────────────────────────────────
cmd_v3_reset() {
  header "V3 Reset"
  echo -e "  ${C_YELLOW}This will destroy:${C_RESET}"
  echo    "    • PostgreSQL data volume"
  echo    "    • Both Bitcoin Core blockchain volumes (btc_node_1, btc_node_2)"
  echo    "    • All Docker images (rebuild required)"
  echo    "    • All unused Docker images, containers, networks, build cache"
  [[ "$SIGNER_MODE" != "none" ]] && \
    echo "    • Signer .env file(s)"
  echo ""
  read -r -p "  Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 0; }
  echo ""

  # Stop legacy single-node stack first to free ports 18443, 3001, etc.
  stop_legacy_compose

  $V3_COMPOSE_CMD --profile signer-all down -v 2>/dev/null || true
  ok "Containers stopped and volumes removed"

  # Free Docker VM disk space to prevent "no space left on device" errors.
  # Strategy: prune build cache (biggest hog, easily rebuilt) + stopped containers.
  # Do NOT prune images — that would force re-pulling nginx:alpine, postgres, bitcoind
  # from Docker Hub on every reset, which is slow and fails when Hub is rate-limited.
  info "Pruning Docker build cache and stopped containers..."
  docker builder prune -af 2>&1 | tail -1
  docker container prune -f  2>&1 | tail -1
  ok "Docker build cache and stopped containers pruned"

  # Show how much space is now available
  local reclaim
  reclaim=$(docker system df 2>/dev/null | grep 'Build Cache' | awk '{print $4}' || echo "?")
  detail "Build cache freed. Remaining Docker disk usage:"
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

# ─── v3: build images ─────────────────────────────────────────────────────────
step_v3_build() {
  header "V3 Step 1 — Build Docker images"
  info "Building engine, btc-indexer, and ui images..."
  # reset uses --no-cache (guarantees fresh build after code changes, e.g. migrate.ts).
  # start uses normal cache (faster for iterative runs — Docker detects file changes).
  local cache_flag=""
  [[ "$CMD" == "reset" ]] && cache_flag="--no-cache"
  $V3_COMPOSE_CMD build $cache_flag engine-1 engine-2 btc-indexer-1 btc-indexer-2 ui
  ok "All images built"
}

# ─── v3: start infrastructure (postgres + btc nodes) ─────────────────────────
step_v3_infra() {
  header "V3 Step 2 — Start PostgreSQL + Bitcoin Core nodes"

  # Stop legacy single-node stack before starting v3 to free overlapping ports
  # (default docker-compose.yml uses 18443/BTC RPC and 3001/UI proxy)
  stop_legacy_compose

  info "Starting postgres + btc-node-1 + btc-node-2..."
  if ! $V3_COMPOSE_CMD up -d postgres btc-node-1 btc-node-2; then
    echo ""
    err "Failed to start infrastructure containers."
    echo ""
    # Show common causes
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

  # Verify P2P peering
  local node2_peers
  node2_peers=$(BTC2 getpeerinfo 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "0")
  if [ "$node2_peers" -gt "0" ]; then
    ok "btc-node-2 peered with btc-node-1 ($node2_peers peer(s))"
  else
    warn "btc-node-2 has no peers yet — blocks may take a moment to propagate"
  fi
}

# ─── v3: mine genesis blocks ──────────────────────────────────────────────────
step_v3_genesis() {
  header "V3 Step 3 — Genesis blocks (btc-node-1)"

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

  # Verify node-2 synced
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

# ─── v3: set up engine .env ───────────────────────────────────────────────────
step_v3_engine_env() {
  header "V3 Step 4 — Engine environment"

  [ -d "$ENGINE_DIR" ] || die "Engine directory not found: $ENGINE_DIR"

  if [ ! -f "$ENGINE_ENV" ]; then
    if [ -f "$ENGINE_DIR/.env.example" ]; then
      cp "$ENGINE_DIR/.env.example" "$ENGINE_ENV"
      info "Created engine/.env from .env.example"
    else
      # Create minimal .env for v3
      cat > "$ENGINE_ENV" <<'ENVEOF'
# chain-api engine — v3 dev environment
# Keys will be populated by seed
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
      info "Created engine/.env (v3 defaults)"
    fi
  fi

  # Ensure DB_TYPE=postgres in engine .env (v3 always uses postgres)
  env_set "$ENGINE_ENV" "DB_TYPE" "postgres"
  env_set "$ENGINE_ENV" "DATABASE_URL" "postgres://chainapi:chainapi_dev@localhost:5433/chainapi"
  env_set "$ENGINE_ENV" "BITCOIN_NETWORK" "regtest"
  env_set "$ENGINE_ENV" "BITCOIN_CORE_PROVISIONING_ENABLED" "false"
  ok "engine/.env configured for v3 (PostgreSQL)"
}

# ─── v3: run migrations + seed (via local ts-node against postgres) ───────────
step_v3_seed() {
  header "V3 Step 5 — DB migrations + seed"

  # Temporarily set DATABASE_URL for local ts-node run
  local original_db_type
  original_db_type=$(env_get "$ENGINE_ENV" "DB_TYPE" || echo "sqlite")

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

  [ -n "$new_api"   ] && { env_set "$ENGINE_ENV" "API_KEY"       "$new_api";   engine_api_key="$new_api"; }
  [ -n "$new_admin" ] && { env_set "$ENGINE_ENV" "ADMIN_KEY"     "$new_admin"; engine_admin_key="$new_admin"; }
  [ -n "$new_xpub"  ] && env_set "$ENGINE_ENV" "BTC_DEV_XPUB" "$new_xpub"
  [ -n "$new_xprv"  ] && env_set "$ENGINE_ENV" "BTC_DEV_XPRV" "$new_xprv"

  # Re-read if not captured from seed output
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

# ─── v3: start engines ────────────────────────────────────────────────────────
step_v3_engines() {
  header "V3 Step 6 — Start engine-1 and engine-2"

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
  $V3_COMPOSE_CMD up -d --force-recreate engine-1

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
  $V3_COMPOSE_CMD up -d --force-recreate engine-2

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

# ─── v3: register chain_nodes ─────────────────────────────────────────────────
step_v3_register_nodes() {
  header "V3 Step 7 — Register chain nodes"

  local api_key admin_key base
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
  # rpcPasswordRef uses env: prefix — engine reads from BTC_NODE_1_PASSWORD env var
  # In regtest dev, password is stored plaintext via env: reference
  _register_node "btc-node-1 (primary)" "full"         10  "http://btc-node-1:18443" "env:BTC_NODE_1_RPC_PASSWORD"
  _register_node "btc-node-2 (standby)" "full"         20  "http://btc-node-2:18443" "env:BTC_NODE_2_RPC_PASSWORD"

  ok "Chain nodes registered (btc-node-1 priority=10, btc-node-2 priority=20)"
  detail "Note: chain_nodes use env: password refs. In production set:"
  detail "  BTC_NODE_1_RPC_PASSWORD=<password> in engine environment"
  detail "  BTC_NODE_2_RPC_PASSWORD=<password> in engine environment"
}

# ─── v3: start indexers ───────────────────────────────────────────────────────
step_v3_indexers() {
  header "V3 Step 8 — Start btc-indexers"

  info "Starting btc-indexer-1 (watches btc-node-1)..."
  $V3_COMPOSE_CMD up -d btc-indexer-1

  info "Starting btc-indexer-2 (watches btc-node-2)..."
  $V3_COMPOSE_CMD up -d btc-indexer-2

  # Give them a few seconds to initialize
  sleep 3

  ok "btc-indexer-1 started — watching btc-node-1 (port 18443)"
  ok "btc-indexer-2 started — watching btc-node-2 (port 18453)"
  detail "Indexers scan blocks every 5s → write to chain_events table"
  detail "Deduplication: ON CONFLICT DO NOTHING if both detect the same tx"
}

# ─── v3: start nginx + UI proxy ──────────────────────────────────────────────
step_v3_nginx_ui() {
  header "V3 Step 9 — nginx load balancer + UI proxy"

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
  $V3_COMPOSE_CMD up -d nginx
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
  $V3_COMPOSE_CMD up -d ui
  ok "UI proxy started → http://localhost:3002"
}

# ─── v3: derive WIF ───────────────────────────────────────────────────────────
step_v3_derive_wif() {
  header "V3 Step — Derive signing key"
  local xprv
  xprv=$(env_get "$ENGINE_ENV" "BTC_DEV_XPRV")
  [ -n "$xprv" ] || die "BTC_DEV_XPRV not in engine/.env — try: ./start.sh reset --v3 --signer $SIGNER_MODE"
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
}

# ─── v3: enroll + configure signers ───────────────────────────────────────────
# Enrollment hits nginx (localhost:3009) → stored in shared PostgreSQL → visible
# to both engine-1 and engine-2. Signer .env points to nginx, not a single engine.
step_v3_enroll_signers() {
  header "V3 Step — Enroll signer(s)"
  local api_key base
  api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  # Enroll via nginx LB — any healthy engine handles it, result stored in shared DB
  base="http://localhost:3009"

  _enroll_signer_v3() {
    local edition="$1" fingerprint="$2" name="$3" signer_dir="$4" port="$5"

    [ -d "$signer_dir" ] || die "$name directory not found: $signer_dir"
    info "Enrolling '$name' via nginx → shared DB..."
    local body result signer_id
    body=$(printf '{"name":"%s","signerFingerprint":"%s","publicKey":"ed25519:devpubkey:%s","capabilities":{"chains":["bitcoin"],"assets":["bitcoin:BTC"],"formats":["btc_psbt"]},"edition":"%s","connectivityMode":"polling","keyProvider":"env"}' \
      "$name" "$fingerprint" "$edition" "$edition")
    result=$(curl -sf -X POST "${base}/v1/external-signers/enroll" \
      -H "Authorization: Bearer $api_key" \
      -H "Content-Type: application/json" \
      -d "$body") || die "Enrollment failed for $name"
    signer_id=$(echo "$result" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null) \
      || die "Parse error: $result"
    ok "Enrolled → $signer_id (stored in shared DB, visible to both engines)"

    # Write signer .env — CHAIN_API_BASE_URL points to nginx, not engine-1 directly.
    # Signer gets automatic engine failover: nginx retries next engine on connection errors.
    # CHAIN_API_FALLBACK_URLS is empty because nginx already handles routing.
    if [ "$edition" = "community" ]; then
      cat > "$signer_dir/.env" <<EOF
# chain-api OSS Signer — auto-generated by start.sh (v3 regtest dev)
# CHAIN_API_BASE_URL points to nginx LB (http://localhost:3009).
# nginx routes to engine-1:3000 and engine-2:3000 round-robin with passive health checks.
# If one engine goes down, nginx automatically routes to the other.
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
      # Enterprise signer: additional fields (concurrency, config provider, etc.)
      cat > "$signer_dir/.env" <<EOF
# chain-api Enterprise Signer — auto-generated by start.sh (v3 regtest dev)
CHAIN_API_BASE_URL=http://localhost:3009
CHAIN_API_FALLBACK_URLS=
SIGNER_API_KEY=${api_key}
SIGNER_ID=${signer_id}
TENANT_ID=tenant_default
SIGNER_NAME=${name}
SIGNER_FINGERPRINT=${fingerprint}
SIGNER_PUBLIC_KEY=ed25519:devpubkey:enterprise:regtest
KEY_PROVIDER=env
BTC_DEV_PRIVATE_KEY_WIF=${HOT_WALLET_WIF}
BTC_DEV_ACCOUNT_XPRV=${ACCOUNT_XPRV}
BTC_NETWORK=regtest
POLL_INTERVAL_MS=1000
TASK_BATCH_SIZE=20
SIGNER_CONCURRENCY=4
CONFIG_PROVIDER=env
TRANSPORT_SECURITY=https
SIGNER_PORT=${port}
SIGNER_BIND_HOST=0.0.0.0
AUDIT_SINK=stdout
EOF
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
    _enroll_signer_v3 "community"  "$SIGNER_OSS_FINGERPRINT" "Dev OSS Signer"        "$SIGNER_OSS_DIR" "3101"
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && \
    _enroll_signer_v3 "enterprise" "$SIGNER_ENT_FINGERPRINT" "Dev Enterprise Signer" "$SIGNER_ENT_DIR" "3102"
}

# ─── v3: start signers via Docker Compose profiles ───────────────────────────
# Signers run as Docker containers using the .env files written by enroll step.
# Profile "signer-oss" starts signer-oss container.
# Profile "signer-enterprise" starts signer-enterprise container.
# The container overrides CHAIN_API_BASE_URL → http://nginx:3009 (Docker DNS).
step_v3_signers_docker() {
  header "V3 Step — Start signer(s) via Docker Compose"

  # Determine which compose profile to activate
  local profile=""
  [[ "$SIGNER_MODE" == "oss" ]]        && profile="signer-oss"
  [[ "$SIGNER_MODE" == "enterprise" ]] && profile="signer-enterprise"
  [[ "$SIGNER_MODE" == "both" ]]       && profile="signer-all"

  [ -z "$profile" ] && return

  info "Building and starting signer(s) (profile: $profile)..."
  $V3_COMPOSE_CMD --profile "$profile" build
  $V3_COMPOSE_CMD --profile "$profile" up -d

  sleep 3

  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]; then
    ok "signer-oss container started → localhost:3101"
    detail "Polling: http://nginx:3009 (container) = http://localhost:3009 (host)"
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    ok "signer-enterprise container started → localhost:3102"
  fi
  detail "Signer .env → CHAIN_API_BASE_URL=http://localhost:3009 (overridden to nginx in container)"
}

# ─── v3: build + start signers ────────────────────────────────────────────────
# Kept for reference — replaced by step_v3_signers_docker in v3 mode.
step_v3_signers_bg() {
  header "V3 Step — Start signer(s) (background, legacy)"

  _start_bg() {
    local dir="$1" label="$2" color="$3" port="$4" pid_file="$5" dbg_port="$6"
    [ -d "$dir" ] || die "$label directory not found: $dir"
    (cd "$dir" && npm install --silent) || warn "npm install in $label had warnings"
    (cd "$dir" && npm run build) || die "$label build failed"

    local inspect_flag=""
    [[ "$DEBUG_MODE" == "true" && -n "$dbg_port" ]] && inspect_flag="--inspect=127.0.0.1:${dbg_port}"

    (cd "$dir" && node $inspect_flag dist/main.js &
     printf '%s\n' "$!" > "$pid_file"
     wait) 2>&1 | awk -v lbl="$label" -v col="$color" '{printf "%s[%s]\033[0m %s\n",col,lbl,$0; fflush()}' &

    sleep 0.3
    info "Waiting for $label /health on port $port..."
    local tries=0
    until curl -sf "http://127.0.0.1:${port}/health" > /dev/null 2>&1; do
      printf "."
      sleep 2
      tries=$((tries+1))
      [ "$tries" -le 20 ] || { echo ""; warn "$label did not respond — check logs"; return; }
    done
    echo " OK"
    ok "$label → http://127.0.0.1:${port}"
  }

  [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]] && \
    _start_bg "$SIGNER_OSS_DIR" "signer-oss" '\033[1;33m' "3101" "$SIGNER_OSS_PIDFILE" "$SIGNER_OSS_DEBUG_PORT"
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && \
    _start_bg "$SIGNER_ENT_DIR" "signer-ent" '\033[0;35m' "3102" "$SIGNER_ENT_PIDFILE" "$SIGNER_ENT_DEBUG_PORT"
}

# ─── v3: verify cluster ───────────────────────────────────────────────────────
step_v3_verify_cluster() {
  header "V3 Step 10 — Verify cluster"

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

# ─── v3: print status ─────────────────────────────────────────────────────────
step_v3_status() {
  local api_key admin_key
  api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")

  echo ""
  echo -e "${C_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C_RESET}"
  echo -e "${C_BOLD}  Ychain chain-api v3 — dev environment ready${C_RESET}"
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
  echo -e "  ${C_GREEN}btc-node-1${C_RESET}        →  http://localhost:18443  (primary, mines)"
  echo -e "  ${C_GREEN}btc-node-2${C_RESET}        →  http://localhost:18453  (standby, syncs)"
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
  fi
  echo ""
  echo -e "  ${C_BOLD}── Useful commands ─────────────────────────────────────${C_RESET}"
  echo ""
  local btcli="docker compose -f $SCRIPT_DIR/docker-compose.v3.yml exec -T btc-node-1 bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin -rpcwallet=$MINING_WALLET"
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
  echo "    docker compose -f $SCRIPT_DIR/docker-compose.v3.yml exec -T postgres \\"
  echo "      psql -U chainapi -d chainapi -c 'SELECT event_type,address,amount_raw,confirmations,node_id FROM chain_events ORDER BY created_at DESC LIMIT 10;'"
  echo ""
  echo -e "  ${C_CYAN}Cluster status:${C_RESET}"
  echo "    curl -s -H 'X-Admin-Key: $admin_key' http://localhost:3009/admin/v1/cluster/status | python3 -m json.tool"
  echo ""
  echo -e "  ${C_CYAN}Signers (if enrolled):${C_RESET}"
  echo "    curl -s -H 'Authorization: Bearer $api_key' http://localhost:3009/v1/external-signers | python3 -m json.tool"
  echo ""
  echo -e "  ${C_CYAN}Logs:${C_RESET}"
  echo "    docker compose -f $SCRIPT_DIR/docker-compose.v3.yml logs -f engine-1 engine-2 nginx"
  echo "    docker compose -f $SCRIPT_DIR/docker-compose.v3.yml logs -f btc-indexer-1 btc-indexer-2"
  [[ "$SIGNER_MODE" != "none" ]] && \
    echo "    docker compose -f $SCRIPT_DIR/docker-compose.v3.yml logs -f signer-oss signer-enterprise"
  echo ""
  echo -e "  ${C_YELLOW}Stop:  ./start.sh stop --v3${C_RESET}"
  echo -e "  ${C_YELLOW}Reset: ./start.sh reset --v3${C_RESET}"
  echo ""
}

# ─── v3: wait + tail logs ─────────────────────────────────────────────────────
step_v3_tail() {
  trap "cmd_v3_stop; exit 0" INT TERM
  local services="engine-1 engine-2 btc-indexer-1 btc-indexer-2 nginx"
  [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]        && services="$services signer-oss"
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && services="$services signer-enterprise"
  info "Tailing logs: $services (Ctrl+C to stop all)..."
  $V3_COMPOSE_CMD logs -f $services &
  wait
}

# ─────────────────────────────────────────────────────────────────────────────
#  LEGACY (DEFAULT) MODE — single BTC node, SQLite, one engine
#  All original step_btc, step_engine_setup, etc. functions preserved below
# ─────────────────────────────────────────────────────────────────────────────

cmd_stop() {
  header "Stop"
  cleanup_local
  if [[ "$V3_MODE" == "true" ]]; then
    cmd_v3_stop
  else
    cd "$SCRIPT_DIR"
    docker compose down
    ok "Bitcoin Core stopped"
  fi
  echo ""
}

step_btc() {
  header "Step 1 — Bitcoin Core (default mode)"
  cd "$SCRIPT_DIR"
  docker compose build ui
  ok "UI proxy image rebuilt"
  if docker compose ps 2>/dev/null | grep -qE "bitcoin-core.*(Up|running)"; then
    docker compose up -d ui > /dev/null 2>&1
    ok "UI proxy container updated"
  else
    docker compose up -d
    ok "Containers started"
  fi

  info "Waiting for Bitcoin Core RPC..."
  local tries=0
  until BTC getblockchaininfo > /dev/null 2>&1; do
    printf "."; sleep 2; tries=$((tries+1))
    [ "$tries" -le 30 ] || die "Bitcoin Core did not respond after 60s"
  done
  echo " OK"

  info "Ensuring mining wallet '$MINING_WALLET'..."
  BTC createwallet "$MINING_WALLET" false false "" false true false > /dev/null 2>&1 \
    || BTC loadwallet "$MINING_WALLET" > /dev/null 2>&1 || true

  local height
  height=$(BTC getblockcount 2>/dev/null || echo "0")
  if [ "$height" -lt 101 ]; then
    info "Mining 101 genesis blocks..."
    local addr; addr=$(BTC -rpcwallet="$MINING_WALLET" getnewaddress "genesis" "bech32")
    BTC -rpcwallet="$MINING_WALLET" generatetoaddress 101 "$addr" > /dev/null
    ok "Genesis blocks mined → height: $(BTC getblockcount)"
  else
    ok "Chain at height $height"
  fi
}

step_engine_setup() {
  header "Step 2 — chain-api DB & API keys (default mode)"
  [ -d "$ENGINE_DIR" ] || die "Engine not found: $ENGINE_DIR"

  if [ ! -f "$ENGINE_ENV" ]; then
    [ -f "$ENGINE_DIR/.env.example" ] && cp "$ENGINE_DIR/.env.example" "$ENGINE_ENV" \
      || die "No engine/.env and no .env.example"
  fi

  if [ ! -f "$UI_ENV" ]; then
    printf 'CHAIN_API_URL=http://host.docker.internal:3000\nCHAIN_API_KEY=\nCHAIN_API_ADMIN_KEY=\n' > "$UI_ENV"
  fi

  local api_key admin_key need_seed=false
  api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")

  { [ ! -f "$ENGINE_DB" ] || [ -z "$api_key" ] || [ -z "$admin_key" ]; } && need_seed=true

  if [ "$need_seed" = "true" ]; then
    info "Running db:seed..."
    local out; out=$(cd "$ENGINE_DIR" && npm run db:seed 2>&1) || { echo "$out"; die "Seed failed"; }
    local na nd xp xv
    na=$(echo "$out" | grep -oE 'API_KEY=cak_[a-f0-9]+' | head -1 | cut -d= -f2 || true)
    nd=$(echo "$out" | grep -oE 'ADMIN_KEY=aak_[a-f0-9]+' | head -1 | cut -d= -f2 || true)
    xp=$(echo "$out" | grep -oE 'BTC_DEV_XPUB=[A-Za-z0-9]+' | head -1 | cut -d= -f2 || true)
    xv=$(echo "$out" | grep -oE 'BTC_DEV_XPRV=[A-Za-z0-9]+' | head -1 | cut -d= -f2 || true)
    [ -n "$na" ] && { env_set "$ENGINE_ENV" "API_KEY" "$na"; api_key="$na"; }
    [ -n "$nd" ] && { env_set "$ENGINE_ENV" "ADMIN_KEY" "$nd"; admin_key="$nd"; }
    [ -n "$xp" ] && env_set "$ENGINE_ENV" "BTC_DEV_XPUB" "$xp"
    [ -n "$xv" ] && env_set "$ENGINE_ENV" "BTC_DEV_XPRV" "$xv"
    ok "Seed complete"
  else
    info "Running db:seed (idempotent)..."
    cd "$ENGINE_DIR" && npm run db:seed > /dev/null 2>&1 || warn "Seed returned non-zero"
    ok "Seed complete"
  fi

  env_set "$UI_ENV" "CHAIN_API_KEY" "$api_key"
  env_set "$UI_ENV" "CHAIN_API_ADMIN_KEY" "$admin_key"
  cd "$SCRIPT_DIR" && docker compose up -d ui > /dev/null 2>&1

  echo ""
  echo -e "  ${C_CYAN}API key${C_RESET}    $api_key"
  echo -e "  ${C_CYAN}Admin key${C_RESET}  $admin_key"
}

step_build_engine() {
  header "Step 3 — Build engine"
  cd "$ENGINE_DIR" && npm run build || die "Engine build failed"
  ok "Engine built → dist/"
}

step_derive_wif() {
  header "Step 4 — Derive signing key"
  local xprv; xprv=$(env_get "$ENGINE_ENV" "BTC_DEV_XPRV")
  [ -n "$xprv" ] || die "BTC_DEV_XPRV missing — try: ./start.sh reset --signer $SIGNER_MODE"
  ACCOUNT_XPRV="$xprv"
  HOT_WALLET_WIF=$(
    cd "$ENGINE_DIR" && BTC_DEV_XPRV="$xprv" node --no-warnings -e "
      const bip32 = require('bip32').BIP32Factory(require('tiny-secp256k1'));
      const btc = require('bitcoinjs-lib');
      const node = bip32.fromBase58(process.env.BTC_DEV_XPRV, btc.networks.regtest);
      process.stdout.write(node.derive(1).derive(0).toWIF()+'\n');
    " 2>/dev/null
  ) || die "WIF derivation failed"
  ok "Hot-wallet WIF derived"
}

step_build_signers() {
  header "Step 5 — Build signer(s)"
  [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]] && {
    (cd "$SIGNER_OSS_DIR" && npm install --silent && npm run build) || die "signer-oss build failed"
    ok "signer-oss built"
  }
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && {
    (cd "$SIGNER_ENT_DIR" && npm install --silent && npm run build) || die "signer-ent build failed"
    ok "signer-ent built"
  }
}

step_start_engine_bg() {
  header "Step 6 — Start engine (background)"
  ENGINE_PORT=$(env_get "$ENGINE_ENV" "PORT"); ENGINE_PORT="${ENGINE_PORT:-3000}"
  local inspect_flag=""
  [[ "$DEBUG_MODE" == "true" ]] && inspect_flag="--inspect=127.0.0.1:${ENGINE_DEBUG_PORT}"
  (cd "$ENGINE_DIR" && { node $inspect_flag dist/main.js & printf '%s\n' "$!" > "$ENGINE_PIDFILE"; wait; }) \
    2>&1 | awk '{printf "\033[0;36m[engine]\033[0m %s\n", $0; fflush()}' &
  sleep 0.3
  info "Waiting for engine /health..."
  local tries=0
  until curl -sf "http://127.0.0.1:${ENGINE_PORT}/health" > /dev/null 2>&1; do
    printf "."; sleep 2; tries=$((tries+1))
    [ "$tries" -le 30 ] || die "Engine did not respond after 60s"
    local epid; epid=$(cat "$ENGINE_PIDFILE" 2>/dev/null || true)
    [[ -n "$epid" ]] && kill -0 "$epid" 2>/dev/null || die "Engine process died"
  done
  echo " OK"
  ok "Engine → http://127.0.0.1:${ENGINE_PORT}"
}

step_enroll_and_configure_signers() {
  header "Step 7 — Enroll signer(s)"
  local api_key base
  api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  base="http://127.0.0.1:${ENGINE_PORT:-3000}"

  _enroll() {
    local edition="$1" fp="$2" name="$3" dir="$4" port="$5"
    info "Enrolling '$name'..."
    local body result sid
    body=$(printf '{"name":"%s","signerFingerprint":"%s","publicKey":"ed25519:devpubkey:%s","capabilities":{"chains":["bitcoin"],"assets":["bitcoin:BTC"],"formats":["btc_psbt"]},"edition":"%s","connectivityMode":"polling","keyProvider":"env"}' \
      "$name" "$fp" "$edition" "$edition")
    result=$(curl -sf -X POST "${base}/v1/external-signers/enroll" \
      -H "Authorization: Bearer $api_key" -H "Content-Type: application/json" -d "$body") || die "Enrollment failed"
    sid=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null) || die "Parse error: $result"
    ok "Enrolled → $sid"
    cat > "$dir/.env" <<EOF
CHAIN_API_BASE_URL=${base}
SIGNER_API_KEY=${api_key}
SIGNER_ID=${sid}
TENANT_ID=tenant_default
SIGNER_NAME=${name}
SIGNER_FINGERPRINT=${fp}
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
SIGNER_BIND_HOST=127.0.0.1
EOF
    curl -sf -X PUT "${base}/v1/external-signers/policies" \
      -H "Authorization: Bearer $api_key" -H "Content-Type: application/json" \
      -d "{\"policies\":[{\"signerId\":\"$sid\",\"autoSignLimitRaw\":\"100000000\",\"dailyAutoSignLimitRaw\":\"1000000000\",\"maxFeeRateSatVb\":50,\"maxOutputsPerBatch\":200}]}" > /dev/null || true
    ok "Policy set"
  }
  [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]        && _enroll "community"  "$SIGNER_OSS_FINGERPRINT" "Dev OSS Signer"        "$SIGNER_OSS_DIR" "3101"
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && _enroll "enterprise" "$SIGNER_ENT_FINGERPRINT" "Dev Enterprise Signer" "$SIGNER_ENT_DIR" "3102"
}

step_start_signers_bg() {
  header "Step 8 — Start signer(s) (background)"
  _start_signer() {
    local dir="$1" label="$2" color="$3" port="$4" pf="$5" dbg="$6"
    local inspect_flag=""
    [[ "$DEBUG_MODE" == "true" && -n "$dbg" ]] && inspect_flag="--inspect=127.0.0.1:${dbg}"
    (cd "$dir" && { node $inspect_flag dist/main.js & printf '%s\n' "$!" > "$pf"; wait; }) \
      2>&1 | awk -v l="$label" -v c="$color" '{printf "%s[%s]\033[0m %s\n",c,l,$0;fflush()}' &
    sleep 0.3
    local tries=0
    until curl -sf "http://127.0.0.1:${port}/health" > /dev/null 2>&1; do
      printf "."; sleep 2; tries=$((tries+1)); [ "$tries" -le 20 ] || { echo ""; warn "$label slow — continuing"; return; }
    done; echo " OK"; ok "$label → http://127.0.0.1:${port}"
  }
  [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]        && _start_signer "$SIGNER_OSS_DIR" "signer-oss" '\033[1;33m' 3101 "$SIGNER_OSS_PIDFILE" "$SIGNER_OSS_DEBUG_PORT"
  [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && _start_signer "$SIGNER_ENT_DIR" "signer-ent" '\033[0;35m' 3102 "$SIGNER_ENT_PIDFILE" "$SIGNER_ENT_DEBUG_PORT"
}

step_engine_start_fg() {
  header "Step 4 — Start engine (foreground)"
  ENGINE_PORT=$(env_get "$ENGINE_ENV" "PORT"); ENGINE_PORT="${ENGINE_PORT:-3000}"
  echo -e "  ${C_CYAN}Bitcoin Core${C_RESET}  →  http://localhost:18443"
  echo -e "  ${C_CYAN}UI proxy${C_RESET}      →  http://localhost:3001"
  echo -e "  ${C_CYAN}chain-api${C_RESET}     →  http://localhost:${ENGINE_PORT}"
  echo ""
  if [[ "$DEBUG_MODE" == "true" ]]; then
    echo -e "  ${C_YELLOW}Debug: inspector → 127.0.0.1:${ENGINE_DEBUG_PORT}${C_RESET}"
    echo -e "  ${C_YELLOW}Ctrl+C stops engine — Bitcoin Core keeps running${C_RESET}"
    echo ""
    (cd "$ENGINE_DIR" && { node --inspect="127.0.0.1:${ENGINE_DEBUG_PORT}" dist/main.js & printf '%s\n' "$!" > "$ENGINE_PIDFILE"; wait; }) \
      2>&1 | awk '{printf "\033[0;36m[engine]\033[0m %s\n", $0; fflush()}' &
    trap cleanup_local EXIT INT TERM
    wait
  else
    echo -e "  ${C_YELLOW}Ctrl+C stops engine — Bitcoin Core keeps running${C_RESET}"
    echo ""
    cd "$ENGINE_DIR" && exec npm start
  fi
}

step_wait_all() {
  trap cleanup_local EXIT INT TERM
  wait
}

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────
case "$CMD" in

  stop)
    if [[ "$V3_MODE" == "true" ]]; then
      header "V3 Stop"
      $V3_COMPOSE_CMD --profile signer-all down
      docker compose -f "$V3_COMPOSE" --profile signer-all rm -sf 2>/dev/null || true
      cleanup_local
      ok "All v3 services stopped"
    else
      header "Stop"
      cleanup_local
      cd "$SCRIPT_DIR" && docker compose down
      ok "Bitcoin Core stopped"
    fi
    ;;

  reset)
    if [[ "$V3_MODE" == "true" ]]; then
      cmd_v3_reset
      step_v3_build
      step_v3_infra
      step_v3_genesis
      step_v3_engine_env
      step_v3_seed
      step_v3_engines
      step_v3_register_nodes
      step_v3_indexers
      # nginx must start BEFORE signer enrollment — enrollment calls localhost:3009 (nginx)
      step_v3_nginx_ui
      if [[ "$SIGNER_MODE" != "none" ]]; then
        step_v3_derive_wif
        step_v3_enroll_signers
        step_v3_signers_docker
      fi
      step_v3_verify_cluster
      step_v3_status
      step_v3_tail
    else
      # Legacy reset
      header "Reset (default mode)"
      read -r -p "  This will wipe blockchain + DB + keys. Continue? [y/N] " confirm
      [[ "$confirm" =~ ^[Yy]$ ]] || exit 0
      cleanup_local
      cd "$SCRIPT_DIR" && docker compose down -v 2>/dev/null || true
      rm -f "$ENGINE_DB" "${ENGINE_DB}-shm" "${ENGINE_DB}-wal"
      [ -f "$ENGINE_ENV" ] && { env_set "$ENGINE_ENV" "API_KEY" ""; env_set "$ENGINE_ENV" "ADMIN_KEY" ""; }
      [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]        && rm -f "$SIGNER_OSS_DIR/.env"
      [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && rm -f "$SIGNER_ENT_DIR/.env"
      ok "Reset complete"
      # Fall through to start
      step_btc; step_engine_setup; step_build_engine
      if [[ "$SIGNER_MODE" != "none" ]]; then
        step_derive_wif; step_build_signers; step_start_engine_bg
        step_enroll_and_configure_signers; step_start_signers_bg; step_wait_all
      else
        step_engine_start_fg
      fi
    fi
    ;;

  start|"")
    if [[ "$V3_MODE" == "true" ]]; then
      # ── V3 START ──────────────────────────────────────────────────────────
      step_v3_build
      step_v3_infra
      step_v3_genesis
      step_v3_engine_env
      step_v3_seed
      step_v3_engines
      step_v3_register_nodes
      step_v3_indexers
      # nginx must start BEFORE signer enrollment — enrollment calls localhost:3009 (nginx)
      step_v3_nginx_ui
      if [[ "$SIGNER_MODE" != "none" ]]; then
        step_v3_derive_wif
        step_v3_enroll_signers
        step_v3_signers_docker
      fi
      step_v3_verify_cluster
      step_v3_status
      step_v3_tail
    else
      # ── DEFAULT START ─────────────────────────────────────────────────────
      step_btc; step_engine_setup; step_build_engine
      if [[ "$SIGNER_MODE" != "none" ]]; then
        step_derive_wif; step_build_signers; step_start_engine_bg
        step_enroll_and_configure_signers; step_start_signers_bg; step_wait_all
      else
        step_engine_start_fg
      fi
    fi
    ;;

  -h|--help|help)
    echo ""
    echo "  Usage: $(basename "$0") [command] [options]"
    echo ""
    echo "  Commands:"
    echo "    start   Start — idempotent, safe to run any time  (default)"
    echo "    reset   Wipe data + restart fresh"
    echo "    stop    Stop all services"
    echo ""
    echo "  Mode options:"
    echo "    (default)             SQLite, 1 BTC node, 1 engine"
    echo "    --v3                  PostgreSQL, 2 BTC nodes, 2 engines, 2 btc-indexers"
    echo ""
    echo "  Other options:"
    echo "    --signer oss          Add OSS signer daemon"
    echo "    --signer enterprise   Add Enterprise signer daemon"
    echo "    --signer both         Add both signer daemons"
    echo "    --debug               Node.js inspector"
    echo "                          default mode: engine → 9229, signer-oss → 9230, signer-ent → 9231"
    echo "                          v3 mode:      engine-1 (Docker) → 9229, engine-2 (Docker) → 9232"
    echo "                                        signer-oss (local) → 9230, signer-ent (local) → 9231"
    echo ""
    echo "  Examples:"
    echo "    ./start.sh                         # default mode, engine only"
    echo "    ./start.sh --v3                    # full v3 stack"
    echo "    ./start.sh --v3 --signer oss       # v3 + OSS signer"
    echo "    ./start.sh reset --v3              # full reset + v3 stack"
    echo "    ./start.sh stop --v3               # stop v3 services"
    echo "    ./start.sh --signer oss --debug    # default + OSS signer, debuggable"
    echo ""
    echo "  V3 endpoints (after ./start.sh --v3):"
    echo "    Engine 1:      http://localhost:3000"
    echo "    Engine 2:      http://localhost:3001"
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
