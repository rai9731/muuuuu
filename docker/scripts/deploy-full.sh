#!/usr/bin/env bash
# deploy-full — deploy em 6 etapas, com tempo total e tempo de manutenção separados.
set -euo pipefail

DC="docker compose -f docker-compose.prod.yml"
ART="$DC exec -T app php artisan"

G='\033[32m'; Y='\033[33m'; R='\033[31m'; C='\033[36m'; B='\033[1m'; N='\033[0m'
step() { echo -e "\n${B}${C}[$1/6]${N} ${B}$2${N}"; }
ok()   { echo -e "${G}  ✔ $*${N}"; }
fail() { echo -e "${R}  ✘ $*${N}"; exit 1; }

[ -f .env ] || fail ".env não encontrado. Copie .env.production para .env antes do deploy."
SECRET=$(grep -E '^MAINTENANCE_SECRET=' .env | cut -d= -f2- | tr -d "'\"")
START=$(date +%s)

step 1 "Preparando ambiente"
mkdir -p backend/storage/{app,logs,framework/{cache/data,sessions,views}} backend/bootstrap/cache
chmod -R ug+rwX backend/storage backend/bootstrap/cache
rm -f backend/public/hot
[ -f docker/nginx/active.conf ] || cp docker/nginx/production.conf docker/nginx/active.conf
$DC up -d mysql redis app
ok "Permissões, public/hot e active.conf verificados"

step 2 "Dependências do backend"
$DC exec -T app composer install --no-dev --optimize-autoloader --no-interaction
ok "composer install concluído"

step 3 "Build isolado do frontend"
if ! $DC run --rm node sh -c "npm install --no-audit --no-fund && npm run build"; then
  fail "Build do frontend falhou — deploy abortado. A aplicação continua no ar."
fi
ok "Build gerado em backend/public/build"

step 4 "Modo manutenção"
$ART down --secret="$SECRET" --retry=10 || true
DOWN_START=$(date +%s)
ok "Em manutenção (preview: /$SECRET)"

step 5 "Migrations, caches e reinício"
$ART migrate --force
$ART config:cache
$ART route:cache
$ART view:clear
$ART view:cache
$ART storage:link || true
$DC up -d redis mysql nginx
$DC up -d --force-recreate app scheduler queue
sleep 3
chmod -R ug+rwX backend/storage backend/bootstrap/cache
$DC exec -T nginx nginx -s reload
ok "Migrations, caches e containers atualizados"

step 6 "Saindo da manutenção"
$ART up
END=$(date +%s)
HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
DATE=$(git log -1 --format=%cd --date=format:'%d/%m/%Y %H:%M' 2>/dev/null || echo "")
printf '{ "hash": "%s", "date": "%s" }\n' "$HASH" "$DATE" > backend/public/version.json

echo -e "\n${B}${G}✔ Deploy concluído${N}"
echo -e "  Versão:          ${B}$HASH${N} ($DATE)"
echo -e "  Tempo total:     ${B}$((END - START))s${N}"
echo -e "  Em manutenção:   ${B}${Y}$((END - DOWN_START))s${N}"
