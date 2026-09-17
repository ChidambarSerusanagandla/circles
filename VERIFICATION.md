# Verification record

## CI scope and confirmed connected validation — September 16, 2026

The user's completed manual connected run is confirmed by the saved `test-results/connected/safe-results.json`: **18 passed / 0 failed / 0 skipped** (9 desktop, 9 mobile). The user also confirmed subsequent cleanup verification found **0 E2E resources remaining**. No connected E2E or hosted cleanup was rerun for this CI-only correction. These results supersede the pending rerun and older counts in the historical sections below.

The normal GitHub Actions job no longer installs Chromium or runs the legacy demo Playwright suite. It retains dependency installation, lint, typecheck, all unit/PostgreSQL tests, the seed dry run, and the production build. The existing demo-mode environment enables credential-free build validation only; it does not change deployment configuration. No connected credentials were added, and CI does not run connected E2E against the shared review project. Manual `test:e2e:connected` and `test:e2e:cleanup` commands remain unchanged.

After the CI edit, `npm run lint`, `npm run typecheck`, and `npm test` passed (all **234 tests across 19 files**). The production build passed using the existing local workaround: `CIRCLES_CONSTRAINED_BUILD=true npm run build -- --webpack`. CI retains the ordinary `npm run build` command. These are local checks; the updated GitHub Actions run remains pending a push. No application or test code changed, and no deployment occurred.

## Desktop invitation-card follow-up — September 16, 2026

Latest completed connected baseline: **desktop 8 passed / 1 failed; mobile 9 passed / 0 failed; total 17 passed / 1 failed / 0 skipped**. The single failure is an unscoped invitation-card locator matching two DOM elements. It is now scoped to the accessible main/article with an exact group heading and strict uniqueness/visibility assertions. Additional connected assertions verify three distinct intended recipients and recipient-only RLS results before acceptance. See [E2E_SELECTOR_AUDIT.md](E2E_SELECTOR_AUDIT.md) for the historical DOM evidence limitation.

A fresh hosted probe confirmed exactly three invitations for distinct recipients, duplicate-pending rejection (`23505`), and only one readable invitation per pending recipient. All temporary probe data was cleaned in `finally`. The original failed run's E2E group was already absent; no recovery journals remain. Final protected-data verification found **six intended circles, zero E2E circles**, zero targeted leftovers and unchanged protected records.

Checks after this correction: ESLint **passed**, TypeScript **passed**, **234 unit/PostgreSQL tests passed in 19 files**, production build **passed** (existing constrained webpack configuration). No application behavior, schema/RLS, authentication or design changes. No deployment.

As requested, the next connected desktop/mobile run is for the user's working terminal:

```powershell
$env:PLAYWRIGHT_EXTERNAL_SERVER="true"
npm.cmd run test:e2e:connected
```

**18/18 remains unverified for this change.** After that run, check the saved report and confirm cleanup still leaves six intended circles and zero E2E circles.

## Connected E2E cleanup — September 16, 2026

The saved connected report before this pass completed **18 passed / 0 failed / 0 skipped** (9 desktop, 9 mobile), superseding the older selector-stage counts below. That run used the previous suite without automatic cleanup; it is not proof that the new teardown hooks have passed in a browser.

Applied the guarded cleanup to the configured `circles-review` project after a dry run and 33 cleanup safety tests. Removed 18 E2E groups and their cascaded data (33 creator links, 12 memberships, 27 messages, 6 reactions, 18 questions, 6 answers, 18 invitations), 11 precisely matched Inbox messages and 112 group-linked observed events. The shared thread was retained. Protected-record checksums matched afterward: all six seeded groups/content, all 13 profiles/Auth identities, both Growth roles, experiment configuration, 2,000 existing assignments and 5,195 untargeted analytics events remained intact. Unattributable historical browsing events were deliberately retained. See [E2E_CLEANUP.md](E2E_CLEANUP.md).

Checks after adding journaled teardown and recovery:

- ESLint: passed, exit 0.
- TypeScript: passed, exit 0.
- Full unit/PostgreSQL suite: **234 passed in 19 files**, including 33 new cleanup tests executing guards and the real cleanup implementation against all seven migrations.
- Production build: passed, exit 0, using the existing Next 16.3.5 webpack/worker-thread setting.
- Hosted cleanup and protected-data verification: passed. Remaining database groups: six intended circles, zero E2E circles.
- Connected Discover HTTP and live browser checks: six conversation cards, zero E2E cards; all six seeded group names present.
- New connected E2E run: attempted, but the agent shell hit `spawn EPERM` when launching a worker, before any test case ran. Preflight completed and its retained journal was successfully recovered with the cleanup CLI. A full browser run of the new teardown still needs the user's working terminal.

No application source, schema/RLS, product behavior or visual design changed. No deployment occurred. The sections below are historical checks.

## Question-status follow-up — September 16, 2026

The next completed connected run is **desktop 9 passed / 0 failed, mobile 8 passed / 1 failed, total 17 passed / 1 failed / 0 skipped**. This verifies the prior four selector corrections. The sole remaining failure matched the answered-question status both inside and outside the active main region.

The final correction changes only the creator Playwright spec: question assertions use the existing accessible main region, exact question content, unique row/badge counts and visible expected status text. No application, authentication, RLS, Growth, Inbox or creator/question behavior changed. See [E2E_SELECTOR_AUDIT.md](E2E_SELECTOR_AUDIT.md) for evidence and its limits.

Rerun results after this narrow correction: ESLint **passed**, TypeScript **passed**, all **201 unit/PostgreSQL tests passed in 17 files**, and production build **passed** using the existing webpack/worker-thread setting. The exact connected E2E command was attempted; worker launch failed with `spawn EPERM` before executing any tests in this agent shell. A fresh completed run from the user's working terminal is still required. **18/18 is not claimed.** No deployment occurred.

## Connected selector follow-up — September 16, 2026

The connected Supabase suite has actually completed a run: **desktop 7 passed / 2 failed, mobile 7 passed / 2 failed, total 14 passed / 4 failed / 0 skipped**. Those results precede the selector correction. They supersede the earlier statement that no connected browser suite had run. All four failures are strict conversation-locator scope errors; see [E2E_SELECTOR_AUDIT.md](E2E_SELECTOR_AUDIT.md) for individual diagnoses and evidence limits.

After adding a named accessible group conversation region and scoped strict tests: lint passed, TypeScript passed, **201 unit/PostgreSQL tests passed in 17 files**, and the production build passed. The requested connected rerun discovered 18 cases but this agent shell failed to spawn the Playwright worker (`spawn EPERM`), before any test started. The user's normal-terminal rerun remains pending. **18/18 is not claimed.** Authentication, RLS and product behavior remain unchanged; no deployment occurred.

The sections below are historical records, not evidence that the new connected suite has passed completely.

## Product implementation — September 14, 2026

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

| Check                              | Result                                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ESLint                             | Passed, exit 0                                                                                                                                                                 |
| TypeScript                         | Passed, exit 0                                                                                                                                                                 |
| Full unit/PostgreSQL suite         | **201 tests passed in 17 files**, exit 0                                                                                                                                       |
| New auth regression cases          | 10 cases covering sign-in, signup confirmation/session outcomes, invalid input, returned/thrown sensitive errors and sign-out without logging                                  |
| Production build                   | Passed, exit 0; Next.js 16.3.5, webpack and the existing constrained-build setting                                                                                             |
| Built configuration                | Both Server Function tracing and browser-to-terminal forwarding are false                                                                                                      |
| Connected development HTTP sign-in | Passed: invalid synthetic password rejected; real seeded Alex account signed in through the Next server action; session cookie received; authenticated Profile survived reload |
| Fresh server log scan              | Passed: no synthetic password marker, configured credential/secret values, returned cookie values, access token or refresh token; no `authenticate(...)` argument trace        |
| Browser production bundle scan     | No configured Supabase server key, analytics signing secret, or seed-password values found                                                                                     |

The runtime verification invoked the actual development server action over HTTP. Calling the exported function directly would not exercise the framework logger. A generated invalid password marker was checked first, before sending the private seed credential. Credentials and response cookies stayed in the local checker's memory and were never printed. Both captured stdout/stderr and Next's fresh development log were inspected; ordinary GET/POST `/profile` status lines remained.

The normal `next dev --webpack` launcher hit the existing child-process `spawn EPERM` restriction. Localhost was restarted using the installed Next development server directly with `NODE_ENV=development`, `__NEXT_DEV_SERVER=1`, and the existing worker-thread build workaround. This preserves the development action-logging path under test. The direct development server remains on port 3000. No deployment occurred.

This establishes connected password sign-in and session persistence on localhost against the configured Supabase project. It does not establish email confirmation, all hosted RLS flows, a Vercel deployment, or Playwright success. Playwright was not rerun in this pass.

Changed files: `next.config.ts`, `eslint.config.mjs`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`, `src/proxy.ts`, `scripts/seed.ts`, `tests/unit/auth-logging.test.ts`, and this verification record. Next may regenerate the uncommitted `next-env.d.ts` development type paths; that generated change is excluded from the security commit.
