#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — Bitcoin regtest + chain-api engine launcher
#
# Usage:
#   ./start.sh           start everything (idempotent — first run or restart)
#   ./start.sh reset     wipe all data, regenerate keys, start fresh
#   ./start.sh stop      stop Bitcoin Core containers
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE_DIR="$(cd "$SCRIPT_DIR/../engine" 2>/dev/null && pwd || echo "$SCRIPT_DIR/../engine")"
UI_ENV="$SCRIPT_DIR/.env"
ENGINE_ENV="$ENGINE_DIR/.env"
ENGINE_DB="$ENGINE_DIR/data/chain-api.db"
MINING_WALLET="btcminer"

# ─── Colors ──────────────────────────────────────────────────────────────────
C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'; C_CYAN='\033[0;36m'
C_RED='\033[0;31m';   C_BOLD='\033[1m';       C_RESET='\033[0m'

ok()     { echo -e "${C_GREEN}  ✓  $*${C_RESET}"; }
info()   { echo -e "${C_CYAN}  ▶  $*${C_RESET}"; }
warn()   { echo -e "${C_YELLOW}  ⚠  $*${C_RESET}"; }
err()    { echo -e "${C_RED}  ✗  $*${C_RESET}" >&2; }
header() { echo -e "\n${C_BOLD}━━━  $*  ━━━${C_RESET}\n"; }
die()    { err "$*"; exit 1; }

# ─── Bitcoin CLI wrapper ──────────────────────────────────────────────────────
BTC() {
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T bitcoin-core \
    bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin "$@"
}

# ─── .env helpers ─────────────────────────────────────────────────────────────

# env_get FILE KEY → value (empty if not found)
env_get() {
  grep -E "^${2}=" "${1}" 2>/dev/null | head -1 | cut -d= -f2- | tr -d ' \t' || true
}

# env_set FILE KEY VALUE → replaces existing or appends
env_set() {
  local file="$1" key="$2" val="$3"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    sed -i '' "s|^${key}=.*|${key}=${val}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$val" >> "$file"
  fi
}

# ─── stop ─────────────────────────────────────────────────────────────────────
cmd_stop() {
  header "Stop"
  cd "$SCRIPT_DIR"
  docker compose down
  ok "Bitcoin Core stopped"
  echo ""
}

# ─── reset ────────────────────────────────────────────────────────────────────
cmd_reset() {
  header "Reset"
  echo -e "  ${C_YELLOW}This will destroy:${C_RESET}"
  echo    "    • Bitcoin Core blockchain data (regtest volume)"
  echo    "    • chain-api database (chain-api.db)"
  echo    "    • All generated API keys (fresh ones will be created)"
  echo ""
  read -r -p "  Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 0; }
  echo ""

  cd "$SCRIPT_DIR"

  info "Stopping containers and removing volume..."
  docker compose down -v 2>/dev/null || docker compose down 2>/dev/null || true
  ok "Containers stopped, volume removed"

  info "Removing chain-api database..."
  rm -f "$ENGINE_DB" "${ENGINE_DB}-shm" "${ENGINE_DB}-wal"
  ok "Database removed"

  info "Clearing API keys from .env files..."
  if [ -f "$ENGINE_ENV" ]; then
    env_set "$ENGINE_ENV" "API_KEY"    ""
    env_set "$ENGINE_ENV" "ADMIN_KEY"  ""
  fi
  if [ -f "$UI_ENV" ]; then
    env_set "$UI_ENV" "CHAIN_API_KEY"       ""
    env_set "$UI_ENV" "CHAIN_API_ADMIN_KEY" ""
  fi
  ok "Keys cleared — will be regenerated on seed"
  echo ""
}

# ─── step 1: Bitcoin Core ─────────────────────────────────────────────────────
step_btc() {
  header "Step 1 — Bitcoin Core"
  cd "$SCRIPT_DIR"

  # Start containers if not running
  if docker compose ps 2>/dev/null | grep -qE "bitcoin-core.*(Up|running)" ; then
    ok "Containers already running"
  else
    info "Starting containers (docker compose up -d)..."
    docker compose up -d
    ok "Containers started"
  fi

  # Wait for RPC
  info "Waiting for Bitcoin Core RPC..."
  local tries=0
  until BTC getblockchaininfo > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries + 1))
    [ "$tries" -le 30 ] || die "Bitcoin Core did not respond after 60s — check: docker compose logs bitcoin-core"
  done
  echo " OK"

  # Mining wallet (idempotent: create → load → already loaded)
  info "Ensuring mining wallet '$MINING_WALLET'..."
  if BTC createwallet "$MINING_WALLET" false false "" false true false > /dev/null 2>&1; then
    ok "Wallet '$MINING_WALLET' created"
  elif BTC loadwallet "$MINING_WALLET" > /dev/null 2>&1; then
    ok "Wallet '$MINING_WALLET' loaded from disk"
  else
    ok "Wallet '$MINING_WALLET' already loaded"
  fi

  # Genesis blocks
  local height
  height=$(BTC getblockcount 2>/dev/null || echo "0")
  if [ "$height" -lt 101 ]; then
    info "Mining 101 genesis blocks (current height: $height)..."
    local addr
    addr=$(BTC -rpcwallet="$MINING_WALLET" getnewaddress "genesis" "bech32")
    BTC -rpcwallet="$MINING_WALLET" generatetoaddress 101 "$addr" > /dev/null
    ok "Genesis blocks mined → height: $(BTC getblockcount)"
  else
    ok "Chain at height $height — genesis mining not needed"
  fi
}

# ─── step 2: engine DB + keys ─────────────────────────────────────────────────
step_engine_setup() {
  header "Step 2 — chain-api DB & API keys"

  [ -d "$ENGINE_DIR" ] || die "Engine directory not found at $ENGINE_DIR"
  [ -f "$ENGINE_DIR/package.json" ] || die "No package.json in $ENGINE_DIR — is this the right engine path?"

  # Ensure engine/.env exists
  if [ ! -f "$ENGINE_ENV" ]; then
    if [ -f "$ENGINE_DIR/.env.example" ]; then
      cp "$ENGINE_DIR/.env.example" "$ENGINE_ENV"
      info "Created engine/.env from .env.example"
    else
      die "No engine/.env found and no .env.example to copy from"
    fi
  fi

  # Ensure btc-test-ui/.env exists
  if [ ! -f "$UI_ENV" ]; then
    cat > "$UI_ENV" <<'ENVEOF'
# UI proxy config — auto-managed by start.sh
CHAIN_API_URL=http://host.docker.internal:3000
CHAIN_API_KEY=
CHAIN_API_ADMIN_KEY=
ENVEOF
    info "Created btc-test-ui/.env"
  fi

  # Read current keys from engine/.env
  local engine_api_key engine_admin_key
  engine_api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  engine_admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")

  # Decide if seed is needed
  local need_seed=false
  if [ ! -f "$ENGINE_DB" ]; then
    info "Database not found — seeding required"
    need_seed=true
  fi
  if [ -z "$engine_api_key" ] || [ -z "$engine_admin_key" ]; then
    info "API keys missing from engine/.env — seeding required"
    need_seed=true
  fi

  if [ "$need_seed" = "true" ]; then
    # ── Full seed: may generate new keys ──────────────────────────────────────
    info "Running npm run db:seed (may take a moment)..."
    local seed_out
    seed_out=$(cd "$ENGINE_DIR" && npm run db:seed 2>&1) || {
      echo "$seed_out"
      die "Seed failed — see output above"
    }

    # Extract newly generated keys (seed only prints them when freshly created).
    # Match the exact console.log format "  API_KEY=cak_xxx" / "  ADMIN_KEY=aak_xxx"
    # to avoid picking up the short logger IDs (aak_XXXXXXXXXXXXXXXX = 16 chars).
    local new_api new_admin new_xpub
    new_api=$(echo "$seed_out"   | grep -oE 'API_KEY=cak_[a-f0-9]+'        | head -1 | cut -d= -f2 || true)
    new_admin=$(echo "$seed_out" | grep -oE 'ADMIN_KEY=aak_[a-f0-9]+'      | head -1 | cut -d= -f2 || true)
    new_xpub=$(echo "$seed_out"  | grep -oE 'BTC_DEV_XPUB=[A-Za-z0-9]+'   | head -1 | cut -d= -f2 || true)

    if [ -n "$new_api" ]; then
      env_set "$ENGINE_ENV" "API_KEY" "$new_api"
      engine_api_key="$new_api"
      ok "New API key saved → engine/.env"
    fi
    if [ -n "$new_admin" ]; then
      env_set "$ENGINE_ENV" "ADMIN_KEY" "$new_admin"
      engine_admin_key="$new_admin"
      ok "New admin key saved → engine/.env"
    fi
    if [ -n "$new_xpub" ]; then
      env_set "$ENGINE_ENV" "BTC_DEV_XPUB" "$new_xpub"
      ok "BTC xpub saved → engine/.env"
    fi

    if [ -z "$engine_api_key" ] || [ -z "$engine_admin_key" ]; then
      # Keys already existed in DB (weren't printed) — re-read .env
      engine_api_key=$(env_get "$ENGINE_ENV" "API_KEY")
      engine_admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")
    fi

    [ -n "$engine_api_key" ] && [ -n "$engine_admin_key" ] || \
      die "Seed ran but keys could not be determined — set API_KEY and ADMIN_KEY in engine/.env manually"

    ok "Seed complete"

  else
    # ── Idempotent seed: DB and keys exist; runs fast, provisions BTC wallet ──
    info "Running npm run db:seed (idempotent — ensures BTC wallet provisioned)..."
    local seed_log
    seed_log=$(cd "$ENGINE_DIR" && npm run db:seed 2>&1) || {
      warn "Seed returned non-zero (continuing anyway)"
    }
    echo "$seed_log" | grep -iE "wallet|WARN|ERROR" | head -8 || true
    ok "Seed complete"
  fi

  # ── Sync keys from engine/.env → btc-test-ui/.env ─────────────────────────
  local ui_api ui_admin
  ui_api=$(env_get "$UI_ENV" "CHAIN_API_KEY")
  ui_admin=$(env_get "$UI_ENV" "CHAIN_API_ADMIN_KEY")

  local keys_changed=false
  if [ "$ui_api" != "$engine_api_key" ] || [ "$ui_admin" != "$engine_admin_key" ]; then
    env_set "$UI_ENV" "CHAIN_API_KEY"       "$engine_api_key"
    env_set "$UI_ENV" "CHAIN_API_ADMIN_KEY" "$engine_admin_key"
    keys_changed=true
    ok "Keys synced → btc-test-ui/.env"
  else
    ok "Keys already in sync"
  fi

  # Recreate the UI proxy container so it picks up the current .env values.
  # `docker compose restart` does NOT reload env vars from .env — must use `up -d`.
  # Docker Compose detects env changes and recreates only the ui service (not bitcoin-core).
  if [ "$keys_changed" = "true" ] || [ -z "$ui_api" ] || [ -z "$ui_admin" ]; then
    info "Applying new keys to UI proxy container..."
    cd "$SCRIPT_DIR" && docker compose up -d ui > /dev/null 2>&1
    ok "UI proxy updated with current keys"

    # If bitcoin-core was also recreated (edge case: network was gone), reload btcminer wallet.
    info "Ensuring btcminer wallet is loaded after container recreation..."
    local tries=0
    until BTC getblockchaininfo > /dev/null 2>&1; do
      sleep 1; tries=$((tries + 1))
      [ "$tries" -le 15 ] || break
    done
    BTC createwallet "$MINING_WALLET" false false "" false true false > /dev/null 2>&1 \
      || BTC loadwallet "$MINING_WALLET" > /dev/null 2>&1 \
      || true
  fi

  local dev_xpub
  dev_xpub=$(env_get "$ENGINE_ENV" "BTC_DEV_XPUB")

  echo ""
  echo -e "  ${C_CYAN}API key${C_RESET}    ${engine_api_key}"
  echo -e "  ${C_CYAN}Admin key${C_RESET}  ${engine_admin_key}"
  if [ -n "$dev_xpub" ]; then
    echo -e "  ${C_CYAN}BTC xpub${C_RESET}   ${dev_xpub}"
  fi
}

# ─── step 3: start engine (foreground) ───────────────────────────────────────
step_engine_start() {
  header "Step 3 — Starting engine"

  echo -e "  ${C_CYAN}Bitcoin Core${C_RESET}  →  http://localhost:18443"
  echo -e "  ${C_CYAN}UI proxy${C_RESET}      →  http://localhost:3001"
  echo -e "  ${C_CYAN}chain-api${C_RESET}     →  http://localhost:3000"
  echo ""
  echo -e "  ${C_YELLOW}Ctrl+C stops the engine — Bitcoin Core keeps running${C_RESET}"
  echo ""

  cd "$ENGINE_DIR"
  exec npm run dev
}

# ─── main ─────────────────────────────────────────────────────────────────────
MODE="${1:-start}"

case "$MODE" in
  stop)
    cmd_stop
    ;;
  reset)
    cmd_reset
    step_btc
    step_engine_setup
    step_engine_start
    ;;
  start|"")
    step_btc
    step_engine_setup
    step_engine_start
    ;;
  -h|--help|help)
    echo ""
    echo "  Usage: $(basename "$0") [command]"
    echo ""
    echo "  Commands:"
    echo "    start   Start everything — idempotent, safe to run any time  (default)"
    echo "    reset   Wipe blockchain + DB + keys, start completely fresh"
    echo "    stop    Stop Bitcoin Core containers (engine stops with Ctrl+C)"
    echo ""
    ;;
  *)
    err "Unknown command: $MODE"
    echo "  Run '$(basename "$0") --help' for usage."
    exit 1
    ;;
esac
