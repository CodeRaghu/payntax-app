# payntax-app

Application supporting CPA activities: tax filing now, payroll for employers and clients later.
Plans, requirements, screens and ADRs live in [architecture-docs](https://github.com/CodeRaghu/architecture-docs).

| Path | What |
|---|---|
| `backend/` | Django + DRF API, Celery worker (`apps/`: accounts, clients, returns, documents, extraction, forms, billing, audit) |
| `frontend/` | Next.js + TypeScript + Tailwind, React Hook Form + Zod, TanStack Query |
| `contract/openapi.yaml` | The API contract between them, generated from the backend |
| `infra/` | Terraform (to come, TODO S2.1) |

## Set up a local environment

### 1. Install the tools (macOS)

```bash
brew install git node@24 pre-commit
brew install --cask docker
```

| Tool | Why |
|---|---|
| Docker Desktop | Runs the whole stack: Postgres, Redis, S3 stand-in, backend, worker, frontend. Start it before anything else. |
| Node.js 20+ | Only for frontend commands on your machine (tests, lint, `make mock`, `make e2e`). |
| pre-commit | Blocks secrets (gitleaks) and lint errors before each commit. |

You don't need Python on your machine: the backend runs in Docker (Python 3.12).

### 2. Get the code and create `.env`

```bash
git clone https://github.com/CodeRaghu/payntax-app.git
cd payntax-app
make env            # creates .env from .env.example with fresh local keys (never overwrites an existing .env)
pre-commit install
```

`.env` is git-ignored. It holds local-only values; real secrets live in AWS Secrets Manager.

### 3. Start the app

```bash
make up             # builds the images and starts everything in the background (first run takes a few minutes)
make seed           # loads synthetic data: a demo firm, two users, three clients and a sample W-2
```

| | |
|---|---|
| App | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/api/docs |
| Django admin | http://localhost:8000/admin |

Check that everything is running: `docker compose ps` lists `backend`, `worker`, `frontend`, `postgres`,
`redis` and `s3` as `Up`.

### 4. Sign in

1. Open http://localhost:3000 and sign in as `owner@payntax.test` (or `preparer@payntax.test`) with
   password `local-demo-password`.
2. For the MFA code, run `make totp` (or `make totp EMAIL=preparer@payntax.test`) and enter it straight away.
   Codes change every 30 seconds and a used code can't be reused in the same window.
   You can also add the secret `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ` to an authenticator app.
3. Accounts you create with **Sign up** scan their own QR code; `make totp EMAIL=<email>` works for them
   once set up. New firms pick a plan on a test checkout page (no real payment).

### 5. Frontend tooling on your machine (optional)

```bash
cd frontend && npm install
npx playwright install chromium   # only for make e2e
```

### Stop, restart, reset

| Command | Does |
|---|---|
| `make down` | Stop everything. Data is kept. |
| `make up` | Start again (rebuilds if code or dependencies changed). |
| `make logs` | Follow backend, worker and frontend logs. |
| `docker compose down -v` | Stop and **delete all local data**. Then `make up && make seed`. |

### UI only, no backend

`make mock` runs just the frontend at http://localhost:3000 against a mock API in the browser
(any password, MFA code `123456`). Data is fake and resets on reload. Stop the Docker frontend first
(`docker compose stop frontend`) if it is using port 3000.

### Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot connect to the Docker daemon` | Start Docker Desktop and wait until it says it's running. |
| Port 3000, 8000, 5432, 6379 or 8333 already in use | Stop whatever uses it, or change the left-hand port in `docker-compose.yml`. |
| MFA code rejected | Run `make totp` again and enter the new code right away. |
| Upload stuck on "Queued…" | The worker isn't running: `docker compose ps worker`, then `make logs`. |
| Model changes not applied | `make migrations && make migrate`. |

## UI and API are independent

```text
frontend screens ──► src/api hooks ──► typed client ──► /api/* ──┬─► Next.js proxy ──► Django
   (features/)        (only door)     (schema.d.ts)               └─► MSW mock (make mock, tests)
                                            ▲
                         contract/openapi.yaml (generated from Django by drf-spectacular)
```

- Screens never call `fetch`; ESLint blocks it outside `src/api`. Changing a screen can't affect the API.
- The backend can change freely as long as the contract holds. When it changes, run `make contract`:
  it regenerates `contract/openapi.yaml` and the frontend types, and `tsc` shows every screen and mock
  affected. CI fails if either file is stale.
- Vendors sit behind interfaces chosen by settings, so swapping them touches neither the UI nor views:
  `EXTRACTION_PROVIDER` (synthetic → Textract/LLM), `VIRUS_SCANNER`, `STORAGE_BACKEND`, `FORM_RENDERER`,
  `BILLING_PROVIDER` (fake → Stripe). Auth endpoints are the contract for the pending auth-provider ADR.

## Common commands

| Command | Does |
|---|---|
| `make test` | Backend (pytest) and frontend (Vitest) tests |
| `make e2e` | Playwright against the running stack (`make up && make seed` first) |
| `make lint` | ruff, mypy, eslint, tsc, and the contract check |
| `make contract` | Regenerate the OpenAPI contract and frontend types |
| `make migrations` / `make migrate` | Django migrations |
| `make logs` | Follow backend, worker and frontend logs |

## Data rules

Synthetic data only: never real SSNs, tax documents or client names in code, tests, logs or tickets.
SSNs, EINs and extracted values are encrypted per field (`FIELD_ENCRYPTION_KEYS`). Logs scrub SSN and
EIN patterns. Every view or change of client data is written to the audit log.
