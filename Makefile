.DEFAULT_GOAL := help
SHELL := /bin/bash

DC      := docker compose
DC_PROD := docker compose -f docker-compose.prod.yml
APP     := $(DC) exec app
APP_T   := $(DC) exec -T app

.PHONY: help up up-prod down restart logs ps install build migrate seed fresh db sh shell thinker tinker \
        lint send deploy deploy-full deploy-rebuild deploy-first

help: ## Lista os comandos disponíveis
	@echo ""
	@echo "  Boi na Rede — comandos"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[32mmake %-16s\033[0m %s\n", $$1, $$2}'
	@echo ""

# ─── Desenvolvimento ──────────────────────────────────────────

up: ## Sobe o ambiente de desenvolvimento (self-heal: derruba órfãos antes)
	@test -f .env || (cp .env.example .env && echo "▶ .env criado a partir de .env.example")
	@mkdir -p storage/uploads
	$(DC) --profile dev down --remove-orphans
	$(DC) --profile dev up -d --build
	@if [ ! -d backend/vendor ]; then echo "▶ Instalando dependências do backend..."; $(APP_T) composer install --no-interaction; fi
	@echo ""
	@echo "  ✔ Aplicação: http://localhost:$$(grep -E '^APP_PORT=' .env | cut -d= -f2)"
	@echo "  ℹ Primeira vez? Rode: make fresh"

up-prod: ## Sobe o ambiente de produção
	$(DC_PROD) up -d

down: ## Para todos os containers
	$(DC) --profile dev down --remove-orphans

restart: down up ## Reinicia o ambiente de desenvolvimento

logs: ## Acompanha os logs
	$(DC) --profile dev logs -f --tail=100

ps: ## Lista os containers
	$(DC) --profile dev ps

install: ## Instala dependências (composer + npm) e gera APP_KEY se faltar
	$(APP_T) composer install --no-interaction
	$(DC) run --rm --no-deps node sh -c "npm install --no-audit --no-fund"
	@if ! grep -qE '^APP_KEY=.+' .env; then \
	  key=$$($(APP_T) php artisan key:generate --show); \
	  sed -i.bak "s|^APP_KEY=.*|APP_KEY=$$key|" .env && rm -f .env.bak; \
	  echo "▶ APP_KEY gerada."; \
	fi

build: ## Gera o build otimizado do frontend (backend/public/build)
	$(DC) run --rm --no-deps node sh -c "npm install --no-audit --no-fund && npm run build"

migrate: ## Executa as migrations
	$(APP) php artisan migrate

seed: ## Executa os seeders (idempotentes)
	$(APP) php artisan db:seed

fresh: ## Recria o banco do zero e popula com dados de demonstração
	$(APP) php artisan migrate:fresh --seed

db: ## Abre o console do MySQL
	$(DC) exec mysql sh -c 'mysql -u"$$MYSQL_USER" -p"$$MYSQL_PASSWORD" "$$MYSQL_DATABASE"'

sh: shell
shell: ## Abre um shell no container da aplicação
	$(APP) sh

tinker: thinker
thinker: ## Abre o Laravel Tinker
	$(APP) php artisan tinker

lint: ## Formata o backend (Pint) e valida o frontend (ESLint + TypeScript)
	@echo "▶ Backend: Laravel Pint"
	$(APP_T) ./vendor/bin/pint
	@echo "▶ Frontend: ESLint + TypeScript"
	$(DC) run --rm --no-deps node sh -c "npm run lint && npm run typecheck"

# ─── Git ──────────────────────────────────────────────────────

send: ## Lint → pede a mensagem → branch auto/… → commit → push → PR → merge em main
	@bash docker/scripts/send.sh

# ─── Produção ─────────────────────────────────────────────────

deploy: ## git pull + deploy-full (sem rebuild de imagem)
	git stash --include-untracked || true
	git pull --ff-only
	@$(MAKE) --no-print-directory deploy-full

deploy-full: ## Deploy completo em 6 etapas com tempo total e tempo de manutenção
	@bash docker/scripts/deploy-full.sh

deploy-rebuild: ## Use quando Dockerfile.prod ou pacotes PHP/Node mudarem
	$(DC_PROD) build
	$(DC_PROD) up -d app
	@echo "ℹ Sem helpers de rota no cliente (Ziggy não é usado) — etapa ignorada."
	@$(MAKE) --no-print-directory deploy-full

deploy-first: ## Primeira subida do servidor (HTTP → certificado → HTTPS)
	@bash docker/scripts/deploy-first.sh
