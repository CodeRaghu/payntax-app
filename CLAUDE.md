# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PayNTax app: Django/DRF backend + Next.js frontend, decoupled by `contract/openapi.yaml`. Specs (requirements `REQ-*`, screens `SCR-*`, TODO IDs, ADRs) are in the sibling repo `../architecture-docs`.

## Commands

Backend runs only in Docker (host Python is 3.9; the app needs 3.12). Frontend npm commands run on the host from `frontend/`.

- `make up` / `make seed` / `make totp` (current MFA code for seeded users; replayed codes are rejected within the same 30 s window)
- Backend tests: `docker compose run --rm backend pytest tests/test_x.py::test_name`
- Backend lint: `make lint-backend` (ruff + ruff format + mypy with django-stubs)
- Frontend: `npm test`, `npm run typecheck` (runs `next typegen` first, needed for `PageProps`/`LayoutProps`), `npm run lint`, `npm run build`
- `make e2e` needs the stack running and seeded

## Changing the API

After any serializer/view/URL change: `make contract`, then fix what `npm run typecheck` reports (including `src/mocks/`). Commit `contract/openapi.yaml` and `frontend/src/api/schema.d.ts` with the change; CI diffs both. `spectacular` runs with `--fail-on-warn`: annotate `SerializerMethodField`s with type hints or `@extend_schema_field`, and set `operation_id` on custom actions.

## Conventions

- Frontend screens live in `src/features/<area>/`, route files in `src/app/` stay thin. Screens get data only via hooks in `src/api/hooks/` and types from `src/api/types.ts` (never `schema.d.ts` or `fetch`).
- Keep `src/mocks/handlers.ts` in step with the API so `make mock` and the Vitest tests keep working.
- API paths have no trailing slash (Next.js proxy strips them; routers use `trailing_slash=False`).
- Every client-data view/change calls `apps.audit.service.record(...)`; never put PII in audit metadata.
- Firm-owned querysets use `FirmScopedQuerysetMixin`; foreign keys in request bodies use `FirmScopedPrimaryKeyRelatedField`. Cross-firm access must return 404 (tests in `tests/test_security.py`).
- Sensitive values use `EncryptedTextField` and are masked in responses; revealing them is a separate audited endpoint.
- Vendor integrations go behind the provider settings in `config/settings.py` (`EXTRACTION_PROVIDER`, `BILLING_PROVIDER`, …) via `apps.core.providers.get_provider`.
- In tests, document processing runs inline (conftest patches `process_document_task.delay`); use `django_capture_on_commit_callbacks(execute=True)` around requests that queue it.
- Tax constants (standard deduction, SS wage base) live in `apps/forms/form1040.py` and `apps/extraction/validation.py`; verify yearly.
- This Next.js (16.4, cache components on) differs from older versions: read `frontend/node_modules/next/dist/docs/` before using unfamiliar APIs. Pages awaiting `params` must sit under a `<Suspense>` (the route-group layouts provide one).
- Local S3 is SeaweedFS (MinIO no longer publishes images); the browser uploads to `S3_PUBLIC_ENDPOINT_URL` via pre-signed PUT.
- Synthetic data only; SSNs in fixtures use the never-issued 9xx range.
- Branches `feature/<TODO-id>-short-name`; Conventional Commits.
