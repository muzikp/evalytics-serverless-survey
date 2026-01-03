#!/usr/bin/env bash
set -euo pipefail

echo "[1/3] Starting MySQL (docker compose)…"
docker compose -f utils/docker-compose.yml up -d

echo "[2/3] Starting API (SAM local)…"
( cd API && sam local start-api ) &

echo "[3/3] Starting UI (once initialized)…"
echo "TODO: ( cd UI && npm run dev )"
wait
