#!/usr/bin/env bash
set -euo pipefail
echo "Doporučení: deploy UI přes GitHub Actions (Pages)."
echo "Lokální build (pro kontrolu):"
echo "  BASE_PATH='/<repo>' npm run build:ui"
echo "Výstup bude v UI/build/ (statické soubory)."
echo "TODO: lokální deploy skript lze doplnit (gh CLI / git subtree / rsync), pokud bude potřeba."
