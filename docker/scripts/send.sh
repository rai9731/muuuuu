#!/usr/bin/env bash
# make send — do working tree até main em um comando.
# 1) lint  2) pede a mensagem  3) branch auto/AAAAMMDD-HHMMSS + commit
# 4) push + PR (gh ou glab)  5) merge automático em main (até 5 tentativas), volta para main e limpa a branch.
set -euo pipefail

G='\033[32m'; Y='\033[33m'; R='\033[31m'; B='\033[1m'; N='\033[0m'
step() { echo -e "${B}${G}▶ $*${N}"; }
warn() { echo -e "${Y}⚠ $*${N}"; }
fail() { echo -e "${R}✘ $*${N}"; exit 1; }

BASE_BRANCH=main
MAX_RETRIES=5

if command -v gh >/dev/null 2>&1; then CLI=gh
elif command -v glab >/dev/null 2>&1; then CLI=glab
else fail "Instale o GitHub CLI (gh) ou o GitLab CLI (glab) para usar o make send."
fi

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Esta pasta não é um repositório git."
git remote get-url origin >/dev/null 2>&1 || fail "Nenhum remote 'origin' configurado."

step "1/5 Rodando lint"
make --no-print-directory lint || fail "Lint falhou. Corrija os erros e rode make send novamente."

if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  warn "Nada para enviar — working tree limpo."
  exit 0
fi

step "2/5 Mensagem do commit"
read -r -p "Descreva a alteração: " MSG
[ -n "${MSG// }" ] || fail "Mensagem vazia — envio cancelado."

BRANCH="auto/$(TZ=America/Sao_Paulo date +%Y%m%d-%H%M%S)"
step "3/5 Criando $BRANCH e commitando"
git checkout -b "$BRANCH"
git add -A
if git diff --cached --quiet; then
  git checkout "$BASE_BRANCH" && git branch -D "$BRANCH"
  warn "Nada para commitar."
  exit 0
fi
git commit -m "$MSG"

step "4/5 Push e abertura do PR"
git push -u origin "$BRANCH"
if [ "$CLI" = gh ]; then
  gh pr create --base "$BASE_BRANCH" --head "$BRANCH" --title "$MSG" --body "$MSG"
else
  glab mr create --target-branch "$BASE_BRANCH" --source-branch "$BRANCH" --title "$MSG" --description "$MSG" --remove-source-branch --yes
fi

step "5/5 Merge automático em $BASE_BRANCH"
merged=false
for i in $(seq 1 "$MAX_RETRIES"); do
  sleep 5
  if [ "$CLI" = gh ]; then
    gh pr merge "$BRANCH" --merge --delete-branch && merged=true
  else
    glab mr merge "$BRANCH" --remove-source-branch --yes && merged=true
  fi
  $merged && break
  warn "Tentativa $i/$MAX_RETRIES falhou — tentando de novo..."
done
$merged || fail "Não foi possível fazer o merge após $MAX_RETRIES tentativas. O PR continua aberto."

git checkout "$BASE_BRANCH"
git pull --ff-only
git branch -D "$BRANCH" 2>/dev/null || true
echo -e "${B}${G}✔ Enviado e mesclado em $BASE_BRANCH.${N}"
