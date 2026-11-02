# PayNTax frontend

Next.js app for the PayNTax screens (SCR-01 … SCR-11). See the repository README for running it.

```text
src/app/         thin route files (route groups: (auth), (billing), (app))
src/features/    one folder per area; each screen is a client component
src/api/         typed API client, hooks and domain types — the only way screens reach the backend
src/mocks/       MSW mock API (used by `make mock` and Vitest)
e2e/             Playwright tests against the running stack
```

`npm run api:generate` regenerates `src/api/schema.d.ts` from `../contract/openapi.yaml`.
