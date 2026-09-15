# Verification record — September 14, 2026

This record covers the final free-product, role-separation, creator-invitation and private-Inbox implementation. It distinguishes executed checks from prepared or externally dependent work.

## Automated checks executed locally

| Check                             | Exact result                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Full Vitest unit/PostgreSQL suite | **191 tests passed in 16 files**, exit 0                                                             |
| ESLint across repository          | Passed, exit 0                                                                                       |
| TypeScript `tsc --noEmit`         | Passed, exit 0                                                                                       |
| Next.js production build          | Passed, exit 0, Next.js 16.3.5; webpack with `CIRCLES_CONSTRAINED_BUILD=true`                        |
| Local HTTP access smoke checks    | **47 assertions passed**, exit 0                                                                     |
| Playwright desktop/mobile suite   | **Not executed successfully**: 18 tests discovered, worker startup failed with `spawn EPERM`, exit 1 |

Commands used from the repository root:

```powershell
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run --configLoader=native --pool=threads
$env:CIRCLES_CONSTRAINED_BUILD='true'
node node_modules/next/dist/bin/next build --webpack
# With the resulting production server running on localhost:3000:
node --env-file=.env.local scripts/check-access.mjs
$env:PLAYWRIGHT_EXTERNAL_SERVER='true'
node node_modules/@playwright/test/cli.js test --workers=1
```

The constrained build uses Next's worker-thread path to accommodate local child-process restrictions; TypeScript validation remains enabled. The ordinary build configuration is retained for Vercel. Playwright checks are authored, including the new collaboration and Inbox flows, but **no Playwright pass is claimed**. GitHub Actions is configured but no CI execution is claimed.

PostgreSQL tests execute migrations, including the complete 001–007 chain, inside PGlite with mock Auth users and database roles. They verify free membership conversion and joining, own-profile/unique-handle rules, creator-only posting/settings, invitation acceptance/decline and atomic role creation, private Inbox participant access, and independent internal Growth privileges. A Growth administrator cannot read a different pair's private thread. The seed integration reproduces the historical simulated experiment counts while excluding them from measured reports.

The HTTP script verifies anonymous, owner/viewer, reader, Rahul, Priya and Arjun receive real 404 responses at `/internal/growth` and `/experiments`; authorized internal sessions receive the report and legacy redirect. It also checks wrong keys, cross-origin sign-in requests, forged sessions, the owner's full name and the four consumer navigation items.

## Browser walkthroughs executed through the available browser controls

- **Anonymous:** Discover, four-message preview, Continue watching, public conversation, sign-in requirement for reacting. No experiment or platform links in navigation.
- **Viewer:** owner sign-in returns to the chosen group; join, reaction and question submission work; membership persists after reload. Profile retains Chidambar Rao Serusanagandla and @chidambar; saving succeeds. The formerly premium Next Chapter group joins freely with no pricing or payment flow.
- **Creator:** managed-group selection, message posting, question answering/skipping, public answer display and settings save work. Creator navigation is contextual to Groups.
- **Collaboration:** created After Hours Club as the owner; invited Rahul, Alex and Priya. It had one creator before acceptance and four afterward. Priya published a visible group message. Arjun received a fourth invitation and declined without receiving the group role.
- **Inbox:** owner started a private thread with Rahul by handle; Rahul saw the message and replied. Alex's Inbox did not expose that conversation. There was no external delivery from the local demo.
- **Internal:** private-key sign-in opened the protected report, preserving the labeled 11.2%/14.7% simulated join rates. Starting the experiment displayed an eight-message treatment in this browser; restoring Draft returned Discover to four-message previews.
- **Responsive/accessibility:** no horizontal overflow at 390 × 844 on Discover, a group, Groups, Inbox, Creator studio or Profile. Mobile questions follow the conversation. The keyboard skip link receives focus. Final walkthrough captured no browser warning/error entries.

Screenshots were saved outside the Git repository in `../screenshots/`: Discover, a group, Creator studio and Inbox. These are screenshots of the local demo, not evidence of deployment or real users.

## External validation still required

- Hosted Supabase Auth, email confirmation and PostgREST integration. The SQL permissions were tested locally, not against a hosted Supabase instance.
- Seed Auth account provisioning and existing-session behavior after rotating the private internal seed password. The seed plan/database inserts are covered; local `tsx` startup previously hit the child-process restriction.
- Normal-environment Playwright execution and GitHub CI.
- Vercel configuration/deployment, domain setup and real traffic. **No deployment was attempted.**

Demo content, including messages and invitations, is inspectable shared browser storage. It is suitable for fictional review content, not secure private communication. Connected-mode privacy uses Supabase Auth and PostgreSQL RLS. No production adoption, paid usage or real experiment lift is claimed.

## Deployment preparation pass — September 14, 2026

Added `DEPLOYMENT.md`, linked it from the README, documented current Supabase secret-key compatibility in the environment template, and pinned the manifest/lockfile Node engine to `22.x`. No application code, schema, dependency version, navigation or product behavior changed. No account, remote, hosted database connection or deployment was created.

Executed preparation checks:

- Manifest/lockfile engine and dependency consistency: passed on Node v22.19.0.
- Runbook contains all seven repository migration filenames: passed.
- `git diff --check`: passed.
- Installed Supabase SDK mock transport: two requests (table read and Auth admin list) correctly used a synthetic `sb_secret_...` API key; passed without network calls. This is not a hosted-key test.
- Existing client bundle scan: no configured demo secret values were present. The hosted service key and analytics signing secret are not configured, so their actual deployed-value checks remain pending. Source inspection found the privileged client behind a server-only boundary.
- Independent read-only authorization review: all 15 application tables enable RLS; invitation recipient checks, Inbox participant checks and independent Growth guards are present. Hosted enforcement remains pending.

The full suite, lint, TypeScript, production build and HTTP checks above were **not rerun during this preparation pass**. Playwright remains locally blocked by `spawn EPERM`; no successful E2E or GitHub Actions run is claimed. The next step is the user's Supabase project creation, followed by the ordered setup and hosted verification in the runbook.

## Authentication logging security fix — September 15, 2026

The reported `authenticate(...)` payload was produced by Next.js development Server Function tracing, not a console statement inside `src/app/auth/actions.ts`. Installed Next.js 16.3.5 defaults `logging.serverFunctions` to true. Its action handler captures `boundActionArguments`, and the development request logger formats them alongside the function name and source file. An authentication argument therefore includes the plaintext password.

`next.config.ts` now sets `logging.serverFunctions=false`, preventing that argument capture/logging, and `browserToTerminal=false`, preventing browser console forwarding. Ordinary HTTP status/timing logs remain available. Every Supabase client explicitly sets `auth.debug=false`. An ESLint rule rejects console logging in auth/session/client modules, the Profile component and proxy. Authentication inputs, validation, Supabase calls, cookie handling and returned user messages are unchanged; the action file itself required no edit.

Checks actually executed after the fix:

| Check | Result |
| --- | --- |
| ESLint | Passed, exit 0 |
| TypeScript | Passed, exit 0 |
| Full unit/PostgreSQL suite | **201 tests passed in 17 files**, exit 0 |
| New auth regression cases | 10 cases covering sign-in, signup confirmation/session outcomes, invalid input, returned/thrown sensitive errors and sign-out without logging |
| Production build | Passed, exit 0; Next.js 16.3.5, webpack and the existing constrained-build setting |
| Built configuration | Both Server Function tracing and browser-to-terminal forwarding are false |
| Connected development HTTP sign-in | Passed: invalid synthetic password rejected; real seeded Alex account signed in through the Next server action; session cookie received; authenticated Profile survived reload |
| Fresh server log scan | Passed: no synthetic password marker, configured credential/secret values, returned cookie values, access token or refresh token; no `authenticate(...)` argument trace |
| Browser production bundle scan | No configured Supabase server key, analytics signing secret, or seed-password values found |

The runtime verification invoked the actual development server action over HTTP. Calling the exported function directly would not exercise the framework logger. A generated invalid password marker was checked first, before sending the private seed credential. Credentials and response cookies stayed in the local checker's memory and were never printed. Both captured stdout/stderr and Next's fresh development log were inspected; ordinary GET/POST `/profile` status lines remained.

The normal `next dev --webpack` launcher hit the existing child-process `spawn EPERM` restriction. Localhost was restarted using the installed Next development server directly with `NODE_ENV=development`, `__NEXT_DEV_SERVER=1`, and the existing worker-thread build workaround. This preserves the development action-logging path under test. The direct development server remains on port 3000. No deployment occurred.

This establishes connected password sign-in and session persistence on localhost against the configured Supabase project. It does not establish email confirmation, all hosted RLS flows, a Vercel deployment, or Playwright success. Playwright was not rerun in this pass.

Changed files: `next.config.ts`, `eslint.config.mjs`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/proxy.ts`, `scripts/seed.ts`, `tests/unit/auth-logging.test.ts`, and this verification record. Next may regenerate the uncommitted `next-env.d.ts` development type paths; that generated change is excluded from the security commit.
