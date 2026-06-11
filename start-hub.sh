#!/usr/bin/env bash
# start-hub.sh - lightweight launcher using Docker Hub images.
#
# Usage mirrors start.sh:
#   ./start-hub.sh
#   ./start-hub.sh --signer oss
#   ./start-hub.sh --signer enterprise
#   ./start-hub.sh --signer both
#   ./start-hub.sh --debug
#   ./start-hub.sh reset
#   ./start-hub.sh stop
#
# Defaults:
#   CHAINAPI_IMAGE_NAMESPACE=ychain
#   CHAINAPI_IMAGE_TAG=latest
#
# Override a single image when needed:
#   CHAINAPI_ENGINE_IMAGE=myorg/chain-api-engine:1.2.3 ./start-hub.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

export CHAINAPI_IMAGE_NAMESPACE="${CHAINAPI_IMAGE_NAMESPACE:-${DOCKERHUB_NAMESPACE:-ychain}}"
export CHAINAPI_IMAGE_TAG="${CHAINAPI_IMAGE_TAG:-latest}"

export CHAINAPI_ENGINE_IMAGE="${CHAINAPI_ENGINE_IMAGE:-${CHAINAPI_IMAGE_NAMESPACE}/chain-api-engine:${CHAINAPI_IMAGE_TAG}}"
export CHAINAPI_BTC_INDEXER_IMAGE="${CHAINAPI_BTC_INDEXER_IMAGE:-${CHAINAPI_IMAGE_NAMESPACE}/chain-api-btc-indexer:${CHAINAPI_IMAGE_TAG}}"
export CHAINAPI_UI_IMAGE="${CHAINAPI_UI_IMAGE:-${CHAINAPI_IMAGE_NAMESPACE}/chain-api-ui:${CHAINAPI_IMAGE_TAG}}"
export CHAINAPI_SIGNER_OSS_IMAGE="${CHAINAPI_SIGNER_OSS_IMAGE:-${CHAINAPI_IMAGE_NAMESPACE}/chain-api-signer-oss:${CHAINAPI_IMAGE_TAG}}"
export CHAINAPI_SIGNER_ENTERPRISE_IMAGE="${CHAINAPI_SIGNER_ENTERPRISE_IMAGE:-${CHAINAPI_IMAGE_NAMESPACE}/chain-api-signer-enterprise:${CHAINAPI_IMAGE_TAG}}"

export CHAINAPI_COMPOSE_OVERLAY="${CHAINAPI_COMPOSE_OVERLAY:-${SCRIPT_DIR}/docker-compose.v3.hub.yml}"
export CHAINAPI_SKIP_LOCAL_BUILD=true
export CHAINAPI_START_SCRIPT_NAME="$(basename "$0")"

exec "$SCRIPT_DIR/start.sh" "$@"
