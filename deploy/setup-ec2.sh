#!/usr/bin/env bash
# Preparação ÚNICA do servidor EC2 (Ubuntu). Rode uma vez, logado como ubuntu:
#   curl -fsSL https://raw.githubusercontent.com/bobmendesADS11/Concurseiros-Conecta-DevOps/main/deploy/setup-ec2.sh | bash
# A aplicação roda com PM2 na porta 3001 e o nginx publica ela na porta 80.
set -euo pipefail
REPO_URL="${1:-https://github.com/bobmendesADS11/Concurseiros-Conecta-DevOps.git}"
APP_DIR="$HOME/concurseiros"
PORTA=3001

echo ">> Instalando PostgreSQL, nginx e git"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git nginx postgresql
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
command -v pm2 >/dev/null || sudo npm install -g pm2

echo ">> Criando 1 GB de swap (a t3.micro tem só 1 GB de RAM)"
if [ ! -f /swapfile ]; then
  sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
sudo swapon /swapfile 2>/dev/null || true

echo ">> Criando o banco de dados"
DB_SENHA="$(openssl rand -hex 16)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='app') THEN CREATE ROLE app LOGIN CREATEDB PASSWORD '${DB_SENHA}'; ELSE ALTER ROLE app PASSWORD '${DB_SENHA}'; END IF; END \$\$;"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='concurseiro_conecta'" | grep -q 1 \
  || sudo -u postgres createdb -O app concurseiro_conecta

echo ">> Baixando o código"
[ -d "$APP_DIR" ] || git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR/backend"
cat > .env <<ENV
DATABASE_URL="postgresql://app:${DB_SENHA}@localhost:5432/concurseiro_conecta?schema=public"
PORT=${PORTA}
JWT_SECRET=$(openssl rand -hex 32)
ENV
npm ci
sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.lock-hash
npx prisma migrate deploy
npm run db:seed || true

echo ">> Subindo a aplicação com PM2"
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" >/dev/null

echo ">> Publicando na porta 80 com nginx"
sudo tee /etc/nginx/sites-available/concurseiros >/dev/null <<NGINX
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:${PORTA};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGINX
sudo rm -f /etc/nginx/sites-enabled/default
sudo ln -sf /etc/nginx/sites-available/concurseiros /etc/nginx/sites-enabled/concurseiros
sudo nginx -t && sudo systemctl reload nginx

echo ">> Pronto! Acesse http://$(curl -s https://checkip.amazonaws.com)"
