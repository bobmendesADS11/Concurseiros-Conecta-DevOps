#!/usr/bin/env bash
# Roda NO SERVIDOR a cada deploy (chamado pelo workflow cd.yml via SSH).
# Uso: bash ~/concurseiros/deploy/deploy.sh <commit>
set -euo pipefail
COMMIT="${1:-origin/main}"
cd ~/concurseiros
git fetch --all --prune
git reset --hard "$COMMIT"
cd backend
npm ci
npx prisma migrate deploy
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
echo "Deploy concluído: $(git rev-parse --short HEAD)"
