#!/usr/bin/env bash
# deploy-first — primeira subida do servidor.
# Nginx sobe só com HTTP (initial.conf) → certbot emite o certificado → troca para production.conf (HTTPS).
set -euo pipefail

DC="docker compose -f docker-compose.prod.yml"
G='\033[32m'; R='\033[31m'; B='\033[1m'; N='\033[0m'
step() { echo -e "\n${B}${G}▶ $*${N}"; }
fail() { echo -e "${R}✘ $*${N}"; exit 1; }

[ -f .env ] || fail ".env não encontrado. Copie .env.production para .env e preencha as chaves."
DOMAIN=$(grep -E '^APP_DOMAIN=' .env | cut -d= -f2-)
EMAIL=$(grep -E '^CERTBOT_EMAIL=' .env | cut -d= -f2-)
[ -n "$DOMAIN" ] || fail "Defina APP_DOMAIN no .env."

step "Nginx em modo HTTP (initial.conf)"
cp docker/nginx/initial.conf docker/nginx/active.conf
mkdir -p "$(grep -E '^STORAGE_PATH=' .env | cut -d= -f2-)" 2>/dev/null || true

step "Build das imagens"
$DC build
$DC up -d mysql redis app nginx

step "Gerando APP_KEY (se ainda não existir)"
$DC exec -T app composer install --no-dev --optimize-autoloader --no-interaction
if ! grep -qE '^APP_KEY=.+' .env; then
  KEY=$($DC exec -T app php artisan key:generate --force --show | tr -d '\r')
  sed -i "s|^APP_KEY=.*|APP_KEY=$KEY|" .env
  $DC up -d --force-recreate app
fi

step "Emitindo certificado Let's Encrypt para $DOMAIN"
$DC run --rm --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive

step "Ativando HTTPS (production.conf)"
cp docker/nginx/production.conf docker/nginx/active.conf
$DC up -d --force-recreate nginx
$DC --profile certbot up -d certbot

echo "ℹ Sem helpers de rota no cliente (Ziggy não é usado) — etapa ignorada."

step "Deploy completo"
bash docker/scripts/deploy-full.sh
$DC exec -T app php artisan config:cache
$DC exec -T app php artisan db:seed --force

echo -e "\n${B}${G}✔ Servidor no ar em https://$DOMAIN${N}"
