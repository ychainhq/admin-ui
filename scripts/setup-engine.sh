#!/usr/bin/env bash
# Verifies chain-api engine connectivity and bootstraps a dev customer.
# Run after: docker compose up -d && scripts/init.sh && (engine running)
#
# Usage:
#   bash scripts/setup-engine.sh
#
# Reads CHAIN_API_KEY and CHAIN_API_ADMIN_KEY from .env (if present) or env.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

# Load .env if present
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
fi

ENGINE_URL="${CHAIN_API_URL:-http://localhost:3000}"
API_KEY="${CHAIN_API_KEY:-}"
ADMIN_KEY="${CHAIN_API_ADMIN_KEY:-}"

# ─── 1. Health check ──────────────────────────────────────────────────────────

echo "Checking chain-api at $ENGINE_URL..."
HEALTH=$(curl -sf "$ENGINE_URL/health" 2>/dev/null) || {
  echo ""
  echo "  Engine not reachable at $ENGINE_URL"
  echo "  Start the engine first:"
  echo "    cp chain-api.env ../engine/.env"
  echo "    cd ../engine && npm run db:migrate && npm run db:seed && npm run dev"
  exit 1
}
echo "  OK — $HEALTH"

# ─── 2. Key check ─────────────────────────────────────────────────────────────

if [ -z "$API_KEY" ] || [ -z "$ADMIN_KEY" ]; then
  echo ""
  echo "  CHAIN_API_KEY or CHAIN_API_ADMIN_KEY not set."
  echo "  Copy keys printed by 'npm run db:seed' into .env:"
  echo ""
  echo "    cp .env.example .env"
  echo "    # then edit .env and paste the cak_ and aak_ keys"
  echo ""
  exit 1
fi

# ─── 3. List tenants (admin) ──────────────────────────────────────────────────

echo ""
echo "Tenants:"
TENANTS=$(curl -sf "$ENGINE_URL/admin/v1/tenants" \
  -H "X-Admin-Key: $ADMIN_KEY" 2>/dev/null) || TENANTS=""

if [ -n "$TENANTS" ]; then
  echo "$TENANTS" | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = data if isinstance(data, list) else data.get('data', [data])
for t in rows:
    print('  ', t.get('id',''), '|', t.get('name',''), '|', t.get('status',''))
" 2>/dev/null || echo "  (parse error — raw: $TENANTS)"
else
  echo "  (could not fetch — check CHAIN_API_ADMIN_KEY)"
fi

# ─── 4. Create dev customer ───────────────────────────────────────────────────

echo ""
echo "Creating dev customer (dev-customer-1)..."
RESP=$(curl -sf -X POST "$ENGINE_URL/v1/customers" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reference":"dev-customer-1","metadata":{"name":"Dev Customer 1"}}' 2>/dev/null) || RESP=""

if [ -n "$RESP" ]; then
  CUST_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('id','?'))" 2>/dev/null || echo "?")
  echo "  Created: $CUST_ID"
else
  echo "  Skipped (already exists or API key invalid)"
fi

# ─── 5. Summary ───────────────────────────────────────────────────────────────

echo ""
echo "Done."
echo ""
echo "  Bitcoin Core  ->  http://localhost:18443"
echo "  chain-api     ->  $ENGINE_URL"
echo "  UI            ->  http://localhost:3001"
echo ""
