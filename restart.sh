#!/bin/bash
# restart.sh — zatrzymuje i restartuje kontenery btc-test-ui
# Użycie:
#   ./restart.sh        — restart wszystkiego (UI + Bitcoin Core)
#   ./restart.sh ui     — tylko proxy/UI
#   ./restart.sh btc    — tylko Bitcoin Core

cd "$(dirname "$0")"

case "${1:-all}" in
  ui)
    echo "Restartuję UI (proxy)…"
    docker compose restart ui
    ;;
  btc)
    echo "Restartuję Bitcoin Core…"
    docker compose restart bitcoin-core
    ;;
  all)
    echo "Restartuję wszystko…"
    docker compose restart
    ;;
  down)
    echo "Zatrzymuję i usuwam kontenery…"
    docker compose down
    ;;
  *)
    echo "Użycie: $0 [ui|btc|all|down]"
    exit 1
    ;;
esac

echo "Gotowe."
docker compose ps
