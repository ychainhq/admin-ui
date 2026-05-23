#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — Bitcoin regtest + chain-api engine + optional signer(s)
#
# Usage:
#   ./start.sh                            start engine only  (default)
#   ./start.sh --signer oss              start engine + OSS signer
#   ./start.sh --signer enterprise       start engine + Enterprise signer
#   ./start.sh --signer both             start engine + both signers
#   ./start.sh --debug                   start with Node.js inspector (VSCode attach)
#   ./start.sh --signer oss --debug      engine + OSS signer, both debuggable
#   ./start.sh reset [--signer ...]      wipe data and start fresh
#   ./start.sh stop                      stop Bitcoin Core + running signers
#
# Debug ports (used with --debug):
#   Engine:             9229   → "Attach: Engine" in .vscode/launch.json
#   OSS Signer:         9230   → "Attach: OSS Signer"
#   Enterprise Signer:  9231   → "Attach: Enterprise Signer"
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

# PID files for background processes
ENGINE_PIDFILE="$ENGINE_DIR/.engine.pid"
SIGNER_OSS_PIDFILE="$SIGNER_OSS_DIR/.signer.pid"
SIGNER_ENT_PIDFILE="$SIGNER_ENT_DIR/.signer.pid"

# Stable fingerprints — survive reset (enrollment is idempotent on fingerprint)
SIGNER_OSS_FINGERPRINT="btc:regtest:dev_oss"
SIGNER_ENT_FINGERPRINT="btc:regtest:dev_enterprise"

# Debug ports (Node.js --inspect, used with --debug flag)
ENGINE_DEBUG_PORT=9229
SIGNER_OSS_DEBUG_PORT=9230
SIGNER_ENT_DEBUG_PORT=9231

# ─── Colors ──────────────────────────────────────────────────────────────────
C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'; C_CYAN='\033[0;36m'
C_RED='\033[0;31m';   C_BOLD='\033[1m';       C_RESET='\033[0m'
C_MAGENTA='\033[0;35m'

ok()     { echo -e "${C_GREEN}  ✓  $*${C_RESET}"; }
info()   { echo -e "${C_CYAN}  ▶  $*${C_RESET}"; }
warn()   { echo -e "${C_YELLOW}  ⚠  $*${C_RESET}"; }
err()    { echo -e "${C_RED}  ✗  $*${C_RESET}" >&2; }
header() { echo -e "\n${C_BOLD}━━━  $*  ━━━${C_RESET}\n"; }
die()    { err "$*"; exit 1; }

# ─── Argument parsing ─────────────────────────────────────────────────────────
CMD="start"
SIGNER_MODE="none"
DEBUG_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    start|reset|stop|-h|--help|help) CMD="$1"; shift ;;
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

# ─── Bitcoin CLI wrapper ──────────────────────────────────────────────────────
BTC() {
  docker compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T bitcoin-core \
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

# ─── Cleanup — kills all background processes ─────────────────────────────────
cleanup() {
  echo ""
  local engine_pid signer_oss_pid signer_ent_pid
  engine_pid=$(cat "$ENGINE_PIDFILE" 2>/dev/null || true)
  signer_oss_pid=$(cat "$SIGNER_OSS_PIDFILE" 2>/dev/null || true)
  signer_ent_pid=$(cat "$SIGNER_ENT_PIDFILE" 2>/dev/null || true)

  local any_running=false
  for pid in $engine_pid $signer_oss_pid $signer_ent_pid; do
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      any_running=true; break
    fi
  done

  if [[ "$any_running" == "true" ]]; then
    info "Shutting down..."
    for pid in $engine_pid $signer_oss_pid $signer_ent_pid; do
      [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
  fi

  rm -f "$ENGINE_PIDFILE" "$SIGNER_OSS_PIDFILE" "$SIGNER_ENT_PIDFILE"
}

# ─── stop ─────────────────────────────────────────────────────────────────────
cmd_stop() {
  header "Stop"
  cleanup
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
  echo    "    • All generated API keys + xprv (fresh ones will be created)"
  [[ "$SIGNER_MODE" != "none" ]] && \
    echo "    • Signer .env file(s) — fresh ID will be enrolled"
  echo ""
  read -r -p "  Continue? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 0; }
  echo ""

  cleanup

  cd "$SCRIPT_DIR"
  info "Stopping containers and removing volume..."
  docker compose down -v 2>/dev/null || docker compose down 2>/dev/null || true
  ok "Containers stopped, volume removed"

  info "Removing chain-api database..."
  rm -f "$ENGINE_DB" "${ENGINE_DB}-shm" "${ENGINE_DB}-wal"
  ok "Database removed"

  info "Clearing keys from engine/.env..."
  if [ -f "$ENGINE_ENV" ]; then
    env_set "$ENGINE_ENV" "API_KEY"       ""
    env_set "$ENGINE_ENV" "ADMIN_KEY"     ""
    env_set "$ENGINE_ENV" "BTC_DEV_XPRV"  ""
    env_set "$ENGINE_ENV" "BTC_DEV_XPUB"  ""
  fi
  ok "Keys cleared — will be regenerated on seed"

  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]] && [ -f "$SIGNER_OSS_DIR/.env" ]; then
    rm -f "$SIGNER_OSS_DIR/.env"
    ok "signer-oss/.env removed — fresh signer ID will be enrolled"
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && [ -f "$SIGNER_ENT_DIR/.env" ]; then
    rm -f "$SIGNER_ENT_DIR/.env"
    ok "signer/.env removed — fresh signer ID will be enrolled"
  fi
  echo ""
}

# ─── step 1: Bitcoin Core ─────────────────────────────────────────────────────
step_btc() {
  header "Step 1 — Bitcoin Core"
  cd "$SCRIPT_DIR"

  info "Rebuilding UI proxy Docker image..."
  docker compose build ui
  ok "UI proxy image rebuilt"

  if docker compose ps 2>/dev/null | grep -qE "bitcoin-core.*(Up|running)"; then
    info "Applying rebuilt UI image..."
    docker compose up -d ui > /dev/null 2>&1
    ok "UI proxy container updated"
  else
    info "Starting containers (docker compose up -d)..."
    docker compose up -d
    ok "Containers started"
  fi

  info "Waiting for Bitcoin Core RPC..."
  local tries=0
  until BTC getblockchaininfo > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries + 1))
    [ "$tries" -le 30 ] || die "Bitcoin Core did not respond after 60s"
  done
  echo " OK"

  info "Ensuring mining wallet '$MINING_WALLET'..."
  if BTC createwallet "$MINING_WALLET" false false "" false true false > /dev/null 2>&1; then
    ok "Wallet '$MINING_WALLET' created"
  elif BTC loadwallet "$MINING_WALLET" > /dev/null 2>&1; then
    ok "Wallet '$MINING_WALLET' loaded from disk"
  else
    ok "Wallet '$MINING_WALLET' already loaded"
  fi

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
  [ -f "$ENGINE_DIR/package.json" ] || die "No package.json in $ENGINE_DIR"

  if [ ! -f "$ENGINE_ENV" ]; then
    if [ -f "$ENGINE_DIR/.env.example" ]; then
      cp "$ENGINE_DIR/.env.example" "$ENGINE_ENV"
      info "Created engine/.env from .env.example"
    else
      die "No engine/.env found and no .env.example to copy from"
    fi
  fi

  if [ ! -f "$UI_ENV" ]; then
    cat > "$UI_ENV" <<'ENVEOF'
# UI proxy config — auto-managed by start.sh
CHAIN_API_URL=http://host.docker.internal:3000
CHAIN_API_KEY=
CHAIN_API_ADMIN_KEY=
ENVEOF
    info "Created btc-test-ui/.env"
  fi

  local engine_api_key engine_admin_key
  engine_api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  engine_admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")

  local need_seed=false
  [ ! -f "$ENGINE_DB" ] && { info "Database not found — seeding required"; need_seed=true; }
  { [ -z "$engine_api_key" ] || [ -z "$engine_admin_key" ]; } && \
    { info "API keys missing — seeding required"; need_seed=true; }

  if [ "$need_seed" = "true" ]; then
    info "Running npm run db:seed..."
    local seed_out
    seed_out=$(cd "$ENGINE_DIR" && npm run db:seed 2>&1) || {
      echo "$seed_out"
      die "Seed failed — see output above"
    }

    local new_api new_admin new_xpub new_xprv
    new_api=$(echo "$seed_out"    | grep -oE 'API_KEY=cak_[a-f0-9]+'       | head -1 | cut -d= -f2 || true)
    new_admin=$(echo "$seed_out"  | grep -oE 'ADMIN_KEY=aak_[a-f0-9]+'     | head -1 | cut -d= -f2 || true)
    new_xpub=$(echo "$seed_out"   | grep -oE 'BTC_DEV_XPUB=[A-Za-z0-9]+'  | head -1 | cut -d= -f2 || true)
    new_xprv=$(echo "$seed_out"   | grep -oE 'BTC_DEV_XPRV=[A-Za-z0-9]+'  | head -1 | cut -d= -f2 || true)

    [ -n "$new_api"   ] && { env_set "$ENGINE_ENV" "API_KEY"      "$new_api";   engine_api_key="$new_api";   ok "New API key saved → engine/.env"; }
    [ -n "$new_admin" ] && { env_set "$ENGINE_ENV" "ADMIN_KEY"    "$new_admin"; engine_admin_key="$new_admin"; ok "New admin key saved → engine/.env"; }
    [ -n "$new_xpub"  ] && { env_set "$ENGINE_ENV" "BTC_DEV_XPUB" "$new_xpub"; ok "BTC xpub saved → engine/.env"; }
    [ -n "$new_xprv"  ] && { env_set "$ENGINE_ENV" "BTC_DEV_XPRV" "$new_xprv"; ok "BTC xprv saved → engine/.env (regtest dev key)"; }

    if [ -z "$engine_api_key" ] || [ -z "$engine_admin_key" ]; then
      engine_api_key=$(env_get "$ENGINE_ENV" "API_KEY")
      engine_admin_key=$(env_get "$ENGINE_ENV" "ADMIN_KEY")
    fi
    [ -n "$engine_api_key" ] && [ -n "$engine_admin_key" ] || \
      die "Seed ran but keys missing — set API_KEY and ADMIN_KEY in engine/.env manually"
    ok "Seed complete"
  else
    info "Running npm run db:seed (idempotent)..."
    local seed_log
    seed_log=$(cd "$ENGINE_DIR" && npm run db:seed 2>&1) || { warn "Seed returned non-zero (continuing)"; }
    # Capture xprv if printed (only happens on first generation)
    local xprv_check
    xprv_check=$(echo "$seed_log" | grep -oE 'BTC_DEV_XPRV=[A-Za-z0-9]+' | head -1 | cut -d= -f2 || true)
    [ -n "$xprv_check" ] && env_set "$ENGINE_ENV" "BTC_DEV_XPRV" "$xprv_check"
    echo "$seed_log" | grep -iE "wallet|WARN|ERROR" | head -8 || true
    ok "Seed complete"
  fi

  # Sync keys → btc-test-ui/.env
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

  if [ "$keys_changed" = "true" ] || [ -z "$ui_api" ] || [ -z "$ui_admin" ]; then
    info "Applying new keys to UI proxy container..."
    cd "$SCRIPT_DIR" && docker compose up -d ui > /dev/null 2>&1
    ok "UI proxy updated"
    info "Ensuring btcminer wallet after container recreation..."
    local tries=0
    until BTC getblockchaininfo > /dev/null 2>&1; do
      sleep 1; tries=$((tries+1)); [ "$tries" -le 15 ] || break
    done
    BTC createwallet "$MINING_WALLET" false false "" false true false > /dev/null 2>&1 \
      || BTC loadwallet "$MINING_WALLET" > /dev/null 2>&1 || true
  fi

  local dev_xpub
  dev_xpub=$(env_get "$ENGINE_ENV" "BTC_DEV_XPUB")

  echo ""
  echo -e "  ${C_CYAN}API key${C_RESET}    ${engine_api_key}"
  echo -e "  ${C_CYAN}Admin key${C_RESET}  ${engine_admin_key}"
  [ -n "$dev_xpub" ] && echo -e "  ${C_CYAN}BTC xpub${C_RESET}   ${dev_xpub}"
}

# ─── step 3: build engine ─────────────────────────────────────────────────────
step_build_engine() {
  header "Step 3 — Building engine"
  cd "$ENGINE_DIR"
  info "Compiling TypeScript (npm run build)..."
  npm run build || die "Engine build failed"
  ok "Engine built → dist/"
}

# ─── step 4: derive hot-wallet WIF (only when signer mode active) ─────────────
# The hot wallet key is at path m/1/0 from the account xprv (m/44'/1'/0' for regtest).
# Same path used by engine seed to derive the hot wallet address.
step_derive_wif() {
  header "Step 4 — Derive hot-wallet signing key"

  local xprv
  xprv=$(env_get "$ENGINE_ENV" "BTC_DEV_XPRV")

  if [ -z "$xprv" ]; then
    warn "BTC_DEV_XPRV not in engine/.env — re-running seed to capture it..."
    local seed_out
    seed_out=$(cd "$ENGINE_DIR" && npm run db:seed 2>&1) || true
    xprv=$(echo "$seed_out" | grep -oE 'BTC_DEV_XPRV=[A-Za-z0-9]+' | head -1 | cut -d= -f2 || true)
    [ -n "$xprv" ] && { env_set "$ENGINE_ENV" "BTC_DEV_XPRV" "$xprv"; ok "BTC xprv captured"; } \
      || die "BTC_DEV_XPRV not found — try: ./start.sh reset --signer $SIGNER_MODE"
  fi

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
  ) || die "WIF derivation failed — ensure bip32, tiny-secp256k1, bitcoinjs-lib are in engine/node_modules"

  ok "Hot-wallet WIF derived (key at m/1/0)"
}

# ─── step 5: build signer(s) ──────────────────────────────────────────────────
step_build_signers() {
  header "Step 5 — Building signer(s)"

  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]; then
    [ -d "$SIGNER_OSS_DIR" ] || die "signer-oss directory not found at $SIGNER_OSS_DIR"
    info "Installing signer-oss dependencies..."
    (cd "$SIGNER_OSS_DIR" && npm install --silent) || warn "npm install in signer-oss had warnings"
    info "Building signer-oss..."
    (cd "$SIGNER_OSS_DIR" && npm run build) || die "signer-oss build failed"
    ok "signer-oss built → dist/"
  fi

  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    [ -d "$SIGNER_ENT_DIR" ] || die "signer (enterprise) directory not found at $SIGNER_ENT_DIR"
    info "Installing signer (enterprise) dependencies..."
    (cd "$SIGNER_ENT_DIR" && npm install --silent) || warn "npm install in signer had warnings"
    info "Building signer (enterprise)..."
    (cd "$SIGNER_ENT_DIR" && npm run build) || die "Enterprise signer build failed"
    ok "signer (enterprise) built → dist/"
  fi
}

# ─── step 6: start engine in background ───────────────────────────────────────
step_start_engine_bg() {
  header "Step 6 — Starting engine (background)"

  ENGINE_PORT=$(env_get "$ENGINE_ENV" "PORT"); ENGINE_PORT="${ENGINE_PORT:-3000}"

  local inspect_flag=""
  if [[ "$DEBUG_MODE" == "true" ]]; then
    inspect_flag="--inspect=127.0.0.1:${ENGINE_DEBUG_PORT}"
    info "Starting engine on port ${ENGINE_PORT} [debugger: 127.0.0.1:${ENGINE_DEBUG_PORT}]..."
  else
    info "Starting engine on port ${ENGINE_PORT}..."
  fi

  (
    cd "$ENGINE_DIR"
    node $inspect_flag dist/main.js &
    printf '%s\n' "$!" > "$ENGINE_PIDFILE"
    wait
  ) 2>&1 | awk '{printf "\033[0;36m[engine]\033[0m %s\n", $0; fflush()}' &

  sleep 0.3   # give subshell time to write PID file

  info "Waiting for engine /health..."
  local tries=0
  until curl -sf "http://127.0.0.1:${ENGINE_PORT}/health" > /dev/null 2>&1; do
    printf "."
    sleep 2
    tries=$((tries+1))
    if [ "$tries" -ge 30 ]; then
      echo ""
      die "Engine did not respond after 60s — check logs above"
    fi
    # Abort early if engine process died
    local epid
    epid=$(cat "$ENGINE_PIDFILE" 2>/dev/null || true)
    [[ -n "$epid" ]] && kill -0 "$epid" 2>/dev/null || { echo ""; die "Engine process died — check logs above"; }
  done
  echo " OK"

  ok "Engine running on http://127.0.0.1:${ENGINE_PORT}"
}

# ─── step 7: enroll + configure signers ───────────────────────────────────────
# Writes signer .env files with enrolled SIGNER_ID and the derived WIF.
# Enrollment via the engine API is idempotent on signerFingerprint.
step_enroll_and_configure_signers() {
  header "Step 7 — Enroll signer(s) + configure auto-sign policy"

  local api_key
  api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  local base="http://127.0.0.1:${ENGINE_PORT:-3000}"

  _enroll_signer() {
    local edition="$1"         # community | enterprise
    local fingerprint="$2"     # e.g. btc:regtest:dev_oss
    local name="$3"            # display name
    local signer_dir="$4"      # path to signer directory
    local port="$5"            # health port (3101 | 3102)
    local node_env_file="$signer_dir/.env"

    info "Enrolling '$name' (fingerprint: $fingerprint)..."
    local body
    body=$(printf '{"name":"%s","signerFingerprint":"%s","publicKey":"ed25519:devpubkey:%s","capabilities":{"chains":["bitcoin"],"assets":["bitcoin:BTC"],"formats":["btc_psbt"]},"edition":"%s","connectivityMode":"polling","keyProvider":"env"}' \
      "$name" "$fingerprint" "$edition" "$edition")

    local result
    result=$(curl -sf -X POST "${base}/v1/external-signers/enroll" \
      -H "Authorization: Bearer $api_key" \
      -H "Content-Type: application/json" \
      -d "$body") || die "Enrollment API call failed for $name (is engine running?)"

    local signer_id
    signer_id=$(echo "$result" | python3 -c \
      "import sys,json; d=json.load(sys.stdin); print(d['data']['id'])" 2>/dev/null) \
      || die "Failed to parse enrollment response for $name: $result"

    ok "Enrolled → signer_id: $signer_id"

    # Write signer .env
    if [ "$edition" = "community" ]; then
      cat > "$node_env_file" <<EOF
# chain-api OSS Signer — auto-generated by start.sh (regtest dev environment)
CHAIN_API_BASE_URL=${base}
SIGNER_API_KEY=${api_key}
SIGNER_ID=${signer_id}
TENANT_ID=tenant_default
SIGNER_NAME=${name}
SIGNER_FINGERPRINT=${fingerprint}
SIGNER_PUBLIC_KEY=ed25519:devpubkey:${edition}:regtest

BTC_SIGNING_MODE=dev_env_key
BTC_DEV_PRIVATE_KEY_WIF=${HOT_WALLET_WIF}
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
SIGNER_AUTO_ENROLL=true
AUDIT_STDOUT=true
AUDIT_LOG_FILE=./data/audit.log
EOF
    else
      cat > "$node_env_file" <<EOF
# chain-api Enterprise Signer — auto-generated by start.sh (regtest dev environment)
CHAIN_API_BASE_URL=${base}
SIGNER_API_KEY=${api_key}
SIGNER_ID=${signer_id}
TENANT_ID=tenant_default
SIGNER_NAME=${name}

KEY_PROVIDER=env
BTC_DEV_PRIVATE_KEY_WIF=${HOT_WALLET_WIF}
BTC_NETWORK=regtest

POLL_INTERVAL_MS=3000
TASK_BATCH_SIZE=5

SIGNER_PORT=${port}
SIGNER_BIND_HOST=127.0.0.1
TRANSPORT_SECURITY=https
AUDIT_SINK=stdout
EOF
    fi
    ok ".env written → $node_env_file"

    # Set auto-sign policy so the batcher dispatches to this signer automatically
    info "Configuring auto-sign policy for $name..."
    local policy_body
    policy_body=$(printf '{"policies":[{"signerId":"%s","autoSignLimitRaw":"100000000","dailyAutoSignLimitRaw":"1000000000","maxFeeRateSatVb":50,"maxOutputsPerBatch":200}]}' \
      "$signer_id")
    curl -sf -X PUT "${base}/v1/external-signers/policies" \
      -H "Authorization: Bearer $api_key" \
      -H "Content-Type: application/json" \
      -d "$policy_body" > /dev/null \
      || warn "Policy setup failed for $name (manual approval will be required)"
    ok "Auto-sign policy set (limit: 1 BTC per batch, 10 BTC daily)"
  }

  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]; then
    _enroll_signer "community" "$SIGNER_OSS_FINGERPRINT" "Dev OSS Signer (regtest)" "$SIGNER_OSS_DIR" "3101"
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    _enroll_signer "enterprise" "$SIGNER_ENT_FINGERPRINT" "Dev Enterprise Signer (regtest)" "$SIGNER_ENT_DIR" "3102"
  fi
}

# ─── step 8: start signer(s) in background ────────────────────────────────────
step_start_signers_bg() {
  header "Step 8 — Starting signer(s) (background)"

  _start_signer_bg() {
    local signer_dir="$1"
    local label="$2"        # e.g. "signer-oss"
    local color="$3"        # ANSI color code
    local app_port="$4"     # health port
    local pid_file="$5"
    local debug_port="$6"   # Node.js --inspect port (empty = no debug)

    local inspect_flag=""
    if [[ "$DEBUG_MODE" == "true" && -n "$debug_port" ]]; then
      inspect_flag="--inspect=127.0.0.1:${debug_port}"
      info "Starting $label on health-port ${app_port} [debugger: 127.0.0.1:${debug_port}]..."
    else
      info "Starting $label on health-port ${app_port}..."
    fi

    (
      cd "$signer_dir"
      node $inspect_flag dist/main.js &
      printf '%s\n' "$!" > "$pid_file"
      wait
    ) 2>&1 | awk -v lbl="$label" -v col="$color" \
      '{printf "%s[%s]\033[0m %s\n", col, lbl, $0; fflush()}' &

    sleep 0.3
  }

  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]; then
    _start_signer_bg "$SIGNER_OSS_DIR" "signer-oss" '\033[1;33m' "3101" "$SIGNER_OSS_PIDFILE" "$SIGNER_OSS_DEBUG_PORT"
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    _start_signer_bg "$SIGNER_ENT_DIR" "signer-ent" '\033[0;35m' "3102" "$SIGNER_ENT_PIDFILE" "$SIGNER_ENT_DEBUG_PORT"
  fi

  # Wait for signer(s) /health
  _wait_signer_health() {
    local port="$1" label="$2" pid_file="$3"
    local tries=0
    info "Waiting for $label /health on port ${port}..."
    until curl -sf "http://127.0.0.1:${port}/health" > /dev/null 2>&1; do
      printf "."
      sleep 2
      tries=$((tries+1))
      if [ "$tries" -ge 20 ]; then
        echo ""
        warn "$label did not respond after 40s — check logs above (continuing)"
        return
      fi
      local spid
      spid=$(cat "$pid_file" 2>/dev/null || true)
      [[ -n "$spid" ]] && kill -0 "$spid" 2>/dev/null || { echo ""; warn "$label process died — check logs above"; return; }
    done
    echo " OK"
    ok "$label healthy → http://127.0.0.1:${port}/health"
  }

  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]; then
    _wait_signer_health "3101" "signer-oss" "$SIGNER_OSS_PIDFILE"
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    _wait_signer_health "3102" "signer-ent" "$SIGNER_ENT_PIDFILE"
  fi
}

# ─── step 4 (no signer): start engine ────────────────────────────────────────
# Without --debug: foreground exec (existing behavior)
# With --debug:    background with --inspect, print attach info, wait
step_engine_start_fg() {
  header "Step 4 — Starting engine"

  ENGINE_PORT=$(env_get "$ENGINE_ENV" "PORT"); ENGINE_PORT="${ENGINE_PORT:-3000}"

  echo -e "  ${C_CYAN}Bitcoin Core${C_RESET}  →  http://localhost:18443"
  echo -e "  ${C_CYAN}UI proxy${C_RESET}      →  http://localhost:3001"
  echo -e "  ${C_CYAN}chain-api${C_RESET}     →  http://localhost:${ENGINE_PORT}"
  echo ""

  if [[ "$DEBUG_MODE" == "true" ]]; then
    echo -e "  ${C_YELLOW}Debug mode — engine started with Node.js inspector${C_RESET}"
    echo -e "  ${C_CYAN}Inspector${C_RESET}     →  127.0.0.1:${ENGINE_DEBUG_PORT}"
    echo -e "  ${C_CYAN}VSCode${C_RESET}        →  Run & Debug → \"Attach: Engine\""
    echo ""
    echo -e "  ${C_YELLOW}Ctrl+C stops the engine — Bitcoin Core keeps running${C_RESET}"
    echo ""

    (
      cd "$ENGINE_DIR"
      node --inspect="127.0.0.1:${ENGINE_DEBUG_PORT}" dist/main.js &
      printf '%s\n' "$!" > "$ENGINE_PIDFILE"
      wait
    ) 2>&1 | awk '{printf "\033[0;36m[engine]\033[0m %s\n", $0; fflush()}' &

    trap cleanup EXIT INT TERM
    wait
  else
    echo -e "  ${C_YELLOW}Ctrl+C stops the engine — Bitcoin Core keeps running${C_RESET}"
    echo ""
    cd "$ENGINE_DIR"
    exec npm start
  fi
}

# ─── E2E test guide ───────────────────────────────────────────────────────────
step_print_e2e_guide() {
  local api_key
  api_key=$(env_get "$ENGINE_ENV" "API_KEY")
  local base="http://localhost:${ENGINE_PORT:-3000}"
  local btcd="docker compose -f $SCRIPT_DIR/docker-compose.yml exec -T bitcoin-core bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin"

  header "E2E Test Guide"

  echo -e "  ${C_BOLD}Signer mode:${C_RESET} ${SIGNER_MODE}"
  echo -e "  ${C_BOLD}API key:${C_RESET}     ${api_key}"
  echo -e "  ${C_BOLD}Base URL:${C_RESET}    ${base}"
  echo -e "  ${C_BOLD}UI:${C_RESET}          http://localhost:3001"

  if [[ "$DEBUG_MODE" == "true" ]]; then
    echo ""
    echo -e "  ${C_BOLD}${C_YELLOW}Debug mode (VSCode attach):${C_RESET}"
    echo -e "  ${C_CYAN}Engine inspector${C_RESET}      →  127.0.0.1:${ENGINE_DEBUG_PORT}  (\"Attach: Engine\")"
    [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]        && echo -e "  ${C_CYAN}OSS Signer inspector${C_RESET}  →  127.0.0.1:${SIGNER_OSS_DEBUG_PORT}  (\"Attach: OSS Signer\")"
    [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]] && echo -e "  ${C_CYAN}Ent Signer inspector${C_RESET}  →  127.0.0.1:${SIGNER_ENT_DEBUG_PORT}  (\"Attach: Enterprise Signer\")"
    echo -e "  ${C_YELLOW}Open .vscode/launch.json → Run & Debug → wybierz konfigurację Attach${C_RESET}"
  fi
  echo ""

  cat <<GUIDE

  ${C_BOLD}── 1. Create a customer ─────────────────────────────────────────────${C_RESET}
  curl -s -X POST ${base}/v1/customers \\
    -H "Authorization: Bearer ${api_key}" \\
    -H "Content-Type: application/json" \\
    -d '{"externalId":"test-user-01","name":"Test User"}' | python3 -m json.tool

  ${C_BOLD}── 2. Create deposit address ─────────────────────────────────────────${C_RESET}
  # Replace <customerId> with the id from step 1
  curl -s -X POST ${base}/v1/customers/<customerId>/deposit-address \\
    -H "Authorization: Bearer ${api_key}" \\
    -H "Content-Type: application/json" \\
    -d '{"chain":"bitcoin"}' | python3 -m json.tool

  ${C_BOLD}── 3. Fund deposit address ───────────────────────────────────────────${C_RESET}
  # Replace <address> with the address from step 2
  ${btcd} -rpcwallet=${MINING_WALLET} sendtoaddress <address> 0.001

  ${C_BOLD}── 4. Mine a block (confirm deposit) ─────────────────────────────────${C_RESET}
  MINER_ADDR=\$(${btcd} -rpcwallet=${MINING_WALLET} getnewaddress "mine" "bech32")
  ${btcd} -rpcwallet=${MINING_WALLET} generatetoaddress 1 \$MINER_ADDR

  ${C_BOLD}── 5. Wait for deposit monitor (~30s), then check ────────────────────${C_RESET}
  curl -s ${base}/v1/deposits \\
    -H "Authorization: Bearer ${api_key}" | python3 -m json.tool

  ${C_BOLD}── 6a. WITHDRAWAL — create customer session + withdrawal ──────────────${C_RESET}
  # Create session for customer
  SESSION=\$(curl -s -X POST ${base}/v1/customers/<customerId>/sessions \\
    -H "Authorization: Bearer ${api_key}" \\
    -d '{}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

  # Customer creates withdrawal (uses /v1/me/withdrawals)
  curl -s -X POST ${base}/v1/me/withdrawals \\
    -H "Authorization: Bearer \$SESSION" \\
    -H "Content-Type: application/json" \\
    -d '{"chain":"bitcoin","assetId":"bitcoin:BTC","amount":"90000","destinationAddress":"bcrt1qfake...replace_with_real_regtest_address","note":"Test withdrawal"}' \\
    | python3 -m json.tool

  ${C_BOLD}── 6b. Check withdrawal batch (batcher runs every 30s) ───────────────${C_RESET}
  curl -s ${base}/v1/withdrawal-batches \\
    -H "Authorization: Bearer ${api_key}" | python3 -m json.tool

  # Once signer signs: status transitions pending_approval → pending_signature → broadcast

  ${C_BOLD}── 7. SWEEP — consolidate hot wallet funds ────────────────────────────${C_RESET}
  # List wallets to find hot wallet id
  curl -s ${base}/v1/wallets \\
    -H "Authorization: Bearer ${api_key}" | python3 -m json.tool

  # Create sweep (replace <walletId> with tenant_hot wallet id)
  curl -s -X POST ${base}/v1/sweeps \\
    -H "Authorization: Bearer ${api_key}" \\
    -H "Content-Type: application/json" \\
    -d '{"sourceWalletId":"<walletId>","chain":"bitcoin","note":"Test sweep"}' \\
    | python3 -m json.tool

  # Check signing task created for sweep
  curl -s ${base}/v1/signing-tasks \\
    -H "Authorization: Bearer ${api_key}" | python3 -m json.tool

  ${C_BOLD}── 8. Monitor signer activity ─────────────────────────────────────────${C_RESET}
  # Check external signers status
  curl -s ${base}/v1/external-signers \\
    -H "Authorization: Bearer ${api_key}" | python3 -m json.tool

  # Signer health
GUIDE

  if [[ "$SIGNER_MODE" =~ ^(oss|both)$ ]]; then
    echo "  curl -s http://localhost:3101/health"
  fi
  if [[ "$SIGNER_MODE" =~ ^(enterprise|both)$ ]]; then
    echo "  curl -s http://localhost:3102/health"
  fi

  echo ""
  echo -e "  ${C_YELLOW}Ctrl+C to stop engine and signer(s)${C_RESET}"
  echo ""
}

# ─── wait for all background processes ───────────────────────────────────────
step_wait_all() {
  trap cleanup EXIT INT TERM
  wait
}

# ─── main ─────────────────────────────────────────────────────────────────────
case "$CMD" in
  stop)
    cmd_stop
    ;;

  reset)
    cmd_reset
    step_btc
    step_engine_setup
    step_build_engine
    if [[ "$SIGNER_MODE" != "none" ]]; then
      step_derive_wif
      step_build_signers
      step_start_engine_bg
      step_enroll_and_configure_signers
      step_start_signers_bg
      step_print_e2e_guide
      step_wait_all
    else
      step_engine_start_fg
    fi
    ;;

  start|"")
    step_btc
    step_engine_setup
    step_build_engine
    if [[ "$SIGNER_MODE" != "none" ]]; then
      step_derive_wif
      step_build_signers
      step_start_engine_bg
      step_enroll_and_configure_signers
      step_start_signers_bg
      step_print_e2e_guide
      step_wait_all
    else
      step_engine_start_fg
    fi
    ;;

  -h|--help|help)
    echo ""
    echo "  Usage: $(basename "$0") [command] [options]"
    echo ""
    echo "  Commands:"
    echo "    start   Start everything — idempotent, safe to run any time  (default)"
    echo "    reset   Wipe blockchain + DB + keys, start completely fresh"
    echo "    stop    Stop Bitcoin Core containers + kill running signers"
    echo ""
    echo "  Options:"
    echo "    --signer oss         Also start the OSS signer daemon"
    echo "    --signer enterprise  Also start the Enterprise signer daemon"
    echo "    --signer both        Start both signer daemons"
    echo "    --debug              Start with Node.js --inspect (VSCode debugger attach)"
    echo ""
    echo "  Debug ports (used with --debug):"
    echo "    Engine:             127.0.0.1:9229   → \"Attach: Engine\""
    echo "    OSS Signer:         127.0.0.1:9230   → \"Attach: OSS Signer\""
    echo "    Enterprise Signer:  127.0.0.1:9231   → \"Attach: Enterprise Signer\""
    echo ""
    echo "  Examples:"
    echo "    ./start.sh                              # engine only"
    echo "    ./start.sh --signer oss                 # engine + OSS signer"
    echo "    ./start.sh --signer oss --debug         # engine + OSS, both debuggable"
    echo "    ./start.sh --debug                      # engine only, debuggable"
    echo "    ./start.sh reset --signer both --debug  # full reset + both + debug"
    echo ""
    ;;

  *)
    err "Unknown command: $CMD"
    echo "  Run '$(basename "$0") --help' for usage."
    exit 1
    ;;
esac
