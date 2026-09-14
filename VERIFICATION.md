# Verification record

This record distinguishes checks executed locally from code/configuration prepared for external validation.

## Executed locally

- ESLint: passed.
- TypeScript: passed.
- Vitest: 54 tests passed across 8 files.
- PostgreSQL: all three migrations executed in PGlite, including anonymous, authenticated and service-role permissions.
- Seed integration: all connected seed rows satisfy database constraints; SQL reproduces the simulated A/B counts and excludes them from measured traffic.
- Production build: passed with Next.js 16.3.5 using webpack and `CIRCLES_CONSTRAINED_BUILD=true`; TypeScript remains enabled.
- Browser: reader join/reaction/question flow, persistence after reload, creator answer/skip, new-circle creation and publishing, new circle in Discover, and premium demo join verified through the available browser controls.

## Prepared but not executed successfully here

- Playwright: 12 desktop/mobile cases are authored. CLI discovered all 12, then this sandbox rejected worker process creation with `spawn EPERM`. The suite is included in GitHub Actions; no CI run is claimed.
- Seed CLI: `tsx` process creation was rejected locally. The seed plan and its database inserts were independently executed in the passing PostgreSQL integration test. Auth account creation requires a real Supabase project and was not exercised.
- The ordinary Turbopack build path is subject to the same local process restriction. The constrained production build succeeded without suppressing type errors.

## Not connected or validated

- Hosted Supabase Auth, email delivery/confirmation, and hosted PostgREST integration.
- GitHub remote/push and GitHub Actions execution.
- Vercel deployment, domain, environment configuration, or live traffic.

No secrets or hosted accounts were supplied. Browser-local demo activity and generated metrics do not demonstrate external persistence or production adoption.

Additional final checks: HTTP responses succeeded for all main routes; variant A rendered 24 preview messages across six cards and B rendered 48. Main pages had no horizontal overflow at 390px. Category filtering returned the expected group, the keyboard skip link received focus first, and the final browser walkthrough logged no console errors.
