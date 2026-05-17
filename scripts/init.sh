#!/usr/bin/env bash
set -e

# Mining wallet used only for genesis block generation in regtest.
# Tenant wallets (btc_tenant_*) are created by the chain-api engine.
MINING_WALLET="btcminer"
CLI="docker compose exec bitcoin-core bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin"

echo "⏳  Waiting for Bitcoin Core to be ready..."
until $CLI getblockchaininfo > /dev/null 2>&1; do
  printf "."
  sleep 2
done
echo " ready."

echo ""
echo "📂  Initializing mining wallet '$MINING_WALLET'..."
if $CLI createwallet "$MINING_WALLET" false false "" false true false 2>/dev/null; then
  echo "    Wallet created."
else
  $CLI loadwallet "$MINING_WALLET" 2>/dev/null \
    && echo "    Wallet loaded." \
    || echo "    Wallet already loaded, continuing."
fi

BLOCK_COUNT=$($CLI getblockcount)
echo "    Current block height: $BLOCK_COUNT"

if [ "$BLOCK_COUNT" -lt 101 ]; then
  echo ""
  echo "⛏️   Mining 101 genesis blocks (coinbase matures after 100 confirmations)..."
  ADDR=$($CLI -rpcwallet="$MINING_WALLET" getnewaddress "genesis" "bech32")
  RESULT=$($CLI -rpcwallet="$MINING_WALLET" generatetoaddress 101 "$ADDR")
  BLOCKS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "101")
  echo "    Mined $BLOCKS blocks."
else
  echo "    Chain already has blocks, skipping genesis mining."
fi

echo ""
echo "✅  Bitcoin Core is ready."
echo ""
echo "    Block height : $($CLI getblockcount)"
echo ""
echo "    Tenant wallets (btc_tenant_*) are provisioned automatically"
echo "    by the chain-api engine on startup and tenant creation."
echo ""
echo "    Open UI  →  http://localhost:3001"
echo ""
