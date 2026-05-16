#!/usr/bin/env bash
set -e

WALLET="testwallet"
CLI="docker compose exec bitcoin-core bitcoin-cli -regtest -rpcuser=bitcoin -rpcpassword=bitcoin"

echo "⏳  Waiting for Bitcoin Core to be ready..."
until $CLI getblockchaininfo > /dev/null 2>&1; do
  printf "."
  sleep 2
done
echo " ready."

echo ""
echo "📂  Creating wallet '$WALLET'..."
$CLI createwallet "$WALLET" false false "" false true false 2>/dev/null \
  && echo "    Wallet created." \
  || echo "    Wallet already exists, continuing."

echo ""
echo "🔑  Generating genesis address..."
ADDR=$($CLI -rpcwallet="$WALLET" getnewaddress "genesis" "bech32")
echo "    Address: $ADDR"

echo ""
echo "⛏️   Mining 101 blocks to $ADDR"
echo "    (coinbase matures after 100 confirmations)"
RESULT=$($CLI -rpcwallet="$WALLET" generatetoaddress 101 "$ADDR")
BLOCKS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null || echo "101")
echo "    Mined $BLOCKS blocks."

echo ""
BALANCE=$($CLI -rpcwallet="$WALLET" getbalance)
echo "✅  Setup complete!"
echo ""
echo "    Initial address : $ADDR"
echo "    Wallet balance  : $BALANCE BTC"
echo "    Block height    : $($CLI getblockcount)"
echo ""
echo "    Open UI  →  http://localhost:3001"
echo ""
