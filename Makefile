COMPOSE := docker compose
FRONTEND := npm --prefix frontend

.PHONY: env up down logs migrate migrations seed totp test test-backend test-frontend lint lint-backend \
        lint-frontend contract contract-check e2e mock shell

env:            ## Create .env with fresh local keys
	python3 scripts/make_env.py

up: .env        ## Build and start the whole stack
	$(COMPOSE) up --build -d
	@echo "Frontend http://localhost:3000 · API http://localhost:8000/api/docs"

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f backend worker frontend

migrate:
	$(COMPOSE) exec backend python manage.py migrate

migrations:     ## Create Django migrations after model changes
	$(COMPOSE) run --rm backend python manage.py makemigrations

seed:           ## Load synthetic firms, users, clients and documents
	$(COMPOSE) exec backend python manage.py seed

totp:           ## Print the current MFA code for a seeded user: make totp EMAIL=preparer@payntax.test
	@$(COMPOSE) exec backend python manage.py totp $(EMAIL)

test: test-backend test-frontend

test-backend:
	$(COMPOSE) run --rm backend pytest

test-frontend:
	$(FRONTEND) run test

lint: lint-backend lint-frontend contract-check

lint-backend:
	$(COMPOSE) run --rm --no-deps backend sh -c "ruff check . && ruff format --check . && mypy ."

lint-frontend:
	$(FRONTEND) run lint && $(FRONTEND) run typecheck

contract:       ## Regenerate contract/openapi.yaml from the backend and the frontend's typed client
	$(COMPOSE) run --rm --no-deps backend python manage.py spectacular --file /contract/openapi.yaml --validate --fail-on-warn
	$(FRONTEND) run api:generate

contract-check: ## Fail if the committed contract or generated types are out of date
	$(COMPOSE) run --rm --no-deps backend sh -c "python manage.py spectacular --file /tmp/openapi.yaml --validate --fail-on-warn && diff -u /contract/openapi.yaml /tmp/openapi.yaml"
	$(FRONTEND) run api:check

e2e:            ## Playwright against the running local stack
	$(FRONTEND) run e2e

mock:           ## Run only the UI, on mock data (no backend needed)
	NEXT_PUBLIC_API_MOCKING=enabled $(FRONTEND) run dev

shell:
	$(COMPOSE) exec backend python manage.py shell

.env:
	python3 scripts/make_env.py
