#!/usr/bin/env bash
# Roda NO SERVIDOR a cada deploy (chamado pelo workflow cd.yml via SSH).
# Uso: bash ~/concurseiros/deploy/deploy.sh <commit>
set -euo pipefail
COMMIT="${1:-origin/main}"
cd ~/concurseiros
git fetch --all --prune
git reset --hard "$COMMIT"
cd backend
# Só reinstala as dependências quando o package-lock.json muda (economiza memória e tempo)
HASH="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ ! -f node_modules/.lock-hash ] || [ "$(cat node_modules/.lock-hash)" != "$HASH" ]; then
  npm ci
  echo "$HASH" > node_modules/.lock-hash
else
  echo "Dependências sem mudança, pulando npm ci"
fi
npx prisma migrate deploy
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
echo "Deploy concluído: $(git rev-parse --short HEAD)"
