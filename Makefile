COMPOSE      := docker compose
COMPOSE_DEV  := docker compose -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD := docker compose -f docker-compose.prod.yml

.DEFAULT_GOAL := help
.PHONY: help env up dev down logs ps seed reset test lint typecheck check prod-up prod-ps prod-logs prod-down

help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

env: ## Crée .env à partir de .env.example s'il n'existe pas
	@test -f .env || (cp .env.example .env && echo ".env créé à partir de .env.example")

up: env ## Démarre toute la pile (mode production-like) en arrière-plan
	$(COMPOSE) up --build -d

dev: env ## Démarre la pile en mode développement (hot-reload)
	$(COMPOSE_DEV) up --build --renew-anon-volumes

down: ## Arrête la pile (les données sont conservées)
	$(COMPOSE) down --remove-orphans

logs: ## Affiche les logs de tous les services
	$(COMPOSE) logs -f --tail=200

ps: ## État et santé des services
	$(COMPOSE) ps

seed: ## Rejoue le seed (idempotent) dans le conteneur API
	$(COMPOSE) exec api node dist/seed/seed.js

reset: ## Supprime conteneurs ET volumes (toutes les données), puis redémarre
	$(COMPOSE) down --volumes --remove-orphans
	$(MAKE) up

test: ## Lance les tests unitaires et d'intégration
	pnpm codegen && pnpm test

lint: ## Lint (ESLint) et vérification du formatage (Prettier)
	pnpm codegen && pnpm lint && pnpm format:check

typecheck: ## Vérification des types TypeScript
	pnpm codegen && pnpm typecheck

check: ## Lint + typecheck + tests (identique à la CI)
	pnpm check

prod-up: ## Démarre la production (VPS). Après un git pull : bash deploy/scripts/up.sh --build
	bash deploy/scripts/up.sh

prod-ps: ## État de la pile de production
	$(COMPOSE_PROD) ps

prod-logs: ## Logs de la pile de production
	$(COMPOSE_PROD) logs -f --tail=200

prod-down: ## Arrête la production, sans effacer les données
	$(COMPOSE_PROD) down --remove-orphans
