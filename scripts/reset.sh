#!/usr/bin/env bash
set -e

echo "This will destroy all regtest blockchain data!"
read -p "  Continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "  Aborted."
  exit 0
fi

echo ""
echo "Stopping containers..."
docker compose down

echo "Removing bitcoin_regtest volume..."
docker volume rm local-test-ui_bitcoin_regtest 2>/dev/null || \
  docker volume rm "$(basename "$(pwd)")_bitcoin_regtest" 2>/dev/null || \
  echo "  Volume not found or already removed."

echo "Starting containers..."
docker compose up -d

echo ""
echo "Running init..."
sleep 5
bash "$(dirname "$0")/init.sh"
