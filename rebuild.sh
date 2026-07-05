#!/bin/bash
set -euo pipefail

cd "${APP_DIR:-$HOME/talkeo}"

echo "==> Pull du code"
git pull origin main

echo "==> Build Docker (avec frontend)"
docker compose build --no-cache

echo "==> Demarrage"
docker compose up -d

echo "==> Verification"
sleep 3
docker compose exec talkeo ls -la /app/client/dist/ || true
curl -sf http://localhost:3002/api/health && echo ""
curl -sf -o /dev/null -w "Page accueil: HTTP %{http_code}\n" http://localhost:3002/

echo ""
echo "OK - Ouvre https://talkeo.fr"
