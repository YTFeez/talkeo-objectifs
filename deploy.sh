#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/talkeo}"
REPO_URL="${REPO_URL:-https://github.com/YTFeez/talkeo.git}"

echo "==> Déploiement Talkeo"

if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi

cd "$APP_DIR"
git pull origin main

if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Éditez $APP_DIR/.env avec vos codes secrets avant de continuer."
  exit 1
fi

docker compose pull 2>/dev/null || true
docker compose up -d --build

echo ""
echo "✓ Talkeo est en ligne sur le port 3002"
echo "  Données persistées dans le volume Docker: talkeo-data"
echo "  Vérification: curl http://localhost:3002/api/health"
