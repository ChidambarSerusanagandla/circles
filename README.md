# Circles

A working prototype for discovering interesting group conversations. Built with Next.js, TypeScript, Supabase and PostgreSQL, with a small first-party growth experiment.

**Status:** local demo implemented and verified; hosted Supabase and Vercel are not connected. All sample content and historical metrics are fictional. No production adoption, revenue or paying customers are claimed.

## What it is

Circles makes the conversation the content. Browse a short exchange, open a group, read along, and join when you want to keep following. Creators publish messages. Readers can react and submit questions for creators to answer publicly.

Included: Discover and six category filters, chronological conversation pages, free and premium-demo memberships, six reactions, a creator question inbox and composer, My Groups, email/password authentication in connected mode, and an internal experiment report.

## Why I built it

Many social platforms reward image and video creation. Some people communicate and create better through text and conversation. This prototype explores whether those conversations can be interesting content in their own right, while keeping discovery accessible without an account.

## Core Product Loop

**Discover → Preview → Open → Join → React / Ask**

Browsing is public. Reacting requires an account; asking requires membership. Viewers do not get an unrestricted chat box. A creator's answer becomes a message in the group's conversation.

### Two-minute reviewer walkthrough

1. Open Discover and read a preview. Open **Roommates After Midnight**.
2. Choose **Sign in to join → Explore as a reader**. You return to the selected circle.
3. Join, add a reaction, and submit a question.
4. Open Profile, choose **Switch to creator**, then open Admin.
5. Answer the question. Open the conversation to see the published response.
6. Open Experiments: compare **Demo data** with **This browser**.
7. Try creating a circle and publishing its first message, or joining **The Next Chapter**. Premium joining is a demo and never collects payment.

Use **Reset demo activity** on Profile to start again.

## Growth Experiment

**Conversation Preview Length**

Hypothesis: an eight-message preview gives people enough context to become interested and increases joining compared with four messages. More content may also satisfy curiosity and reduce the incentive to open.

| Measure           | Definition                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Assignment        | 50/50 deterministic hash of a random browser UUID with a versioned experiment salt                             |
| Persistence       | One-year browser cookie; signed in connected mode; unique PostgreSQL assignment per browser and experiment     |
| Qualified preview | Half of a fixed 64px area at the preview's start is visible for one continuous second while the tab is visible |
| Primary metric    | Distinct preview visitors who join a circle they previewed within seven days / distinct preview visitors       |
| Secondary metric  | Distinct preview visitors who open a circle they previewed within seven days / distinct preview visitors       |
| Analysis unit     | Browser, not person, account, click or membership row                                                          |

The same observation area is used in both variants so preview height does not change entry into the denominator. The preview and outcome must match browser, circle, experiment and variant. Each converted browser counts once per arm, even if it joins multiple circles. The experiment join metric does not require a separate open event, which may be missed; the creator dashboard uses an ordered preview → open → join funnel.

Results from generated data only:

| Variant | Messages | Visitors | Opens | Joins | Preview → Open | Preview → Join |
| ------- | -------: | -------: | ----: | ----: | -------------: | -------------: |
| A       |        4 |    1,000 |   326 |   112 |          32.6% |          11.2% |
| B       |        8 |    1,000 |   401 |   147 |          40.1% |          14.7% |

Simulated absolute lift: **+3.5 percentage points**. Simulated relative lift: **+31.25%** (the UI rounds to 31.3%). These intentionally generated outcomes validate the report, not the product hypothesis. **No statistical significance test is implemented and no real winner is declared.**

With real traffic, predefine a useful effect size and sample plan, check allocation, allow seven-day windows to mature, and examine subsequent reading/retention before choosing a variant. Those decision procedures and retention metrics are future work. Cookie clearing and multiple devices create multiple visitors.

To stop new experimental enrollment, update the experiment's status to `completed` through trusted SQL. Existing participants retain their assigned preview and attribution while their windows mature; new browsers receive A. New experimental exposures stop. During an assignment failure, serve baseline A without experimental exposure. Ingestion checks the actual rendered context so a recovery cannot mislabel an A preview as B.

## Technical Architecture

- **Next.js 16.3.5 / App Router**: server-rendered routes and server actions. This stable version was selected at project setup and is locked.
- **TypeScript + React**: typed domain models; client components for participation, demo storage and browser visibility.
- **Tailwind CSS 4 + custom CSS**: responsive reading layout, initials avatars, visible keyboard focus and loading/error/empty states. No paid or remote assets.
- **Supabase Auth**: email/password signup, login, logout and SSR cookies. Server identity verification uses `getUser()`; the proxy refreshes claims/cookies.
- **PostgreSQL**: constraints, RLS, transactional creator functions, event storage and SQL conversion reports.
- **Vercel**: standard Next.js build and runtime. No localhost dependency in application code.

```text
src/app/                 Routes, server actions, event endpoint, styles
src/components/          Focused UI and interactive client components
src/lib/data.ts          Supabase reads and data mapping
src/lib/rules.ts         Domain input and participation rules
src/lib/analytics/       Events, ingestion, funnels, simulated fixture
src/lib/experiments/     Assignment, signed identity, experiment lifecycle
src/lib/demo.ts          Explicit browser-local reviewer state
supabase/migrations/     Schema, privileges, RLS, RPCs and indexes
supabase/reports/        SQL examples for conversion and engagement
scripts/seed.ts          Repeatable connected development seed
tests/unit/              Domain, analytics and assignment tests
tests/database/          Executable PostgreSQL role/RLS and seed tests
tests/e2e/               Desktop/mobile Playwright reviewer flows
APPLICATION_NOTES.md     Interview explanations and development evidence
```

The Discover query fetches at most 60 circles with batched first-eight-message previews. Account pages query their own memberships/admin links independently of that feed limit. Group history uses 50-message pages. Queries use group/time, membership, reaction, question-queue and visitor/time indexes. No real-time sockets or background jobs are required.

## Database Design

- `profiles`: Auth user ID, display name and optional avatar URL. Created by the Auth trigger.
- `groups`, `group_admins`: groups and their many-to-many creator relationship.
- `group_memberships`: unique group/person membership; `active` or `premium_demo`.
- `messages`, `message_reactions`: creator messages and unique message/person/emoji reactions.
- `questions`, `question_answers`: private pending/skipped questions; one answer per question.
- `experiments`, `experiment_assignments`: versioned experiment and unique browser assignment.
- `analytics_events`: event identity, optional account/group, experiment attribution, JSONB metadata, demo flag, deduplication key and timestamp.
- `growth_admins`: explicit internal reporting access, separate from being a group creator.

A database function creates a group and its first admin atomically. Answering locks a pending question, verifies that group's admin, inserts its answer and public message, and changes status in one transaction.

### Authorization and RLS

| Entity/action            | Database rule                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| Public reading           | Groups, public display names, creator roster and messages                                          |
| Profile editing          | Own profile; only display name/avatar columns                                                      |
| Group editing/posting    | Admin of that group; posts must use own author ID                                                  |
| Membership               | Insert/read own; unique group/person; status must match group access                               |
| Reactions                | Insert/delete/read own rows; public aggregate counts via RPC                                       |
| Questions                | Members submit as themselves; author/admin can read pending/skipped; answered questions are public |
| Answers/skips            | Authorized RPC only; ordinary users cannot directly change moderation status                       |
| Global growth reports    | Explicit growth-admin account only                                                                 |
| Assignments/event writes | Trusted server service role only                                                                   |

The service key is used only by isolated server analytics modules and the development seed. Product mutations use the signed-in user's client and RLS. Migration 003 explicitly grants service-role table privileges: bypassing RLS alone does not confer table access.

## Analytics

Events: `discover_viewed`, `group_preview_seen`, `group_opened`, `group_joined`, `reaction_added`, `question_submitted`, `experiment_exposed`.

Browser ingestion accepts reading events only. It validates origin, body size, shape and rendered preview context, derives identity on the server, and uses a lightweight per-visitor rate cap. Successful membership, reaction and question mutations emit their events on the server.

Event retry keys and unique exposure keys prevent duplicate delivery. Event receipt time is captured before asynchronous ingestion work; SQL uses event time and distinct visitors, never arrival order. Signed visitor cookies prevent choosing an arbitrary existing identity, but reading events and the rate cap are **not comprehensive bot protection**.

An event delivery failure does not undo a successful product action. There is no durable retry queue; outages, blockers, immediate navigation and network reordering can undercount events. The one-second preview rule intentionally excludes faster glances.

`is_demo=true` historical events are excluded from measured reports. Connected actions against fictional seeded groups are still observed actions and have `is_demo=false`; use a separate Supabase project for production traffic if reviewers are testing. Browser-local actions never claim to be production traffic.

## Technical Challenges

These were encountered and addressed during implementation/review:

- The first impression observer depended on preview height, biasing cohort entry. Both variants now use a fixed observation area.
- PostgreSQL CHECK constraints accept NULL; premium price validation needed an explicit non-null check.
- A maximum-length question plus answer could overflow the public-message limit. The answer limit is now 1,400 characters.
- Assignment outages followed by recovery could label a fallback preview with the wrong arm. The route provides fresh rendered context and ingestion validates it.
- Demo memberships and reactions initially followed only the currently selected account when displaying totals. Identity-specific selection and aggregate totals are now separate.
- Creator inbox limits originally applied before pending filtering, and account lists inherited the feed limit. Queries now apply the appropriate scope first.
- Service-role grants needed to be explicit for current Supabase projects. PostgreSQL tests exercise actual service-role access.
- Local restrictions blocked Node child processes. Unit/database tests use worker threads; an optional constrained build uses webpack and Next's worker-thread path. Browser flows were checked separately from the blocked Playwright CLI.

## Product Tradeoffs

- **Preview context vs curiosity:** measure joins, with opens as a diagnostic, rather than assuming more engagement is always better.
- **Open discovery vs monetization:** reading stays open; joining saves a circle and enables questions. Premium entitlement is a transparent non-billing demo.
- **Creator conversation vs unrestricted chat:** a readable conversation with a question queue creates creator moderation work.
- **Simple reporting vs advanced analytics:** one experiment, browser identity, all-time descriptive reports, and a seven-day window; no cross-device stitching, retention platform, significance testing or automatic winner.

## Testing

```bash
npm run lint
npm run typecheck
npm test
npm run seed:check
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover creation rules, duplicate memberships, reactions, question permissions/moderation, stable assignment, signed cookies, event validation/failure isolation, conversion windows, demo isolation and lift.

PGlite runs the actual migrations in embedded PostgreSQL, with mock Auth identity and anonymous/authenticated/service roles. It checks cross-user permissions, private membership lists, admin impersonation, transactional answers, explicit service privileges, and the full connected seed's SQL results.

Playwright contains six scenarios at both desktop and mobile sizes. GitHub Actions installs Chromium and runs the full check/build/browser pipeline. CI has not run on GitHub yet. See [VERIFICATION.md](VERIFICATION.md) for actual local results and environment limitations; authored tests are not described as passed when execution was blocked.

## Running Locally

Use **Node.js 22.19+** and npm.

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). With no configuration, the explicit reviewer demo starts automatically. Demo state lives in localStorage and is shared only across tabs on that browser/origin. It is not an authorization boundary or a substitute for Supabase.

To run the production build locally:

```bash
npm run build
npm run start
```

### Connect Supabase

Use a fresh **development** Supabase project.

1. In the SQL editor, execute these files in order, once each:
   - `supabase/migrations/001_core.sql`
   - `supabase/migrations/002_analytics.sql`
   - `supabase/migrations/003_service_access.sql`
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_DEMO_MODE=false`, your project URL, publishable key, server service-role key and a random cookie-signing secret.
3. In Supabase Auth, enable the email provider. Set Site URL to `http://localhost:3000/profile` for local development. If email confirmation is enabled, confirm the email and then sign in with the password; this MVP does not implement magic-link or automatic post-confirmation login.
4. Optional: set a `SEED_PASSWORD` of at least 12 characters and run `npm run seed`.
5. Start/restart the application. Partial configuration produces an error, never a silent fallback to demo data.

Seeded accounts:

| Account | Email                    | Access                              |
| ------- | ------------------------ | ----------------------------------- |
| Rahul   | `demo01@circles.example` | Roommates creator + internal growth |
| Alex    | `demo11@circles.example` | Reader                              |

Both use your supplied seed password. The seed creates 11 fictional confirmed Auth accounts, 6 groups with 3 admins each, 60 authored messages, 60 memberships, 114 reactions, 2 pending questions and analytics for 2,000 simulated visitors.

Seed insertion is repeatable via stable IDs/composite keys; existing rows and passwords are not overwritten. It does not reset modified demo content. Use a fresh development project for a completely fresh seed. Browser fixture member/reaction totals are illustrative; connected group counts derive from the actual seeded relational rows and therefore differ.

To grant another account internal reporting access, use the SQL editor with its real profile UUID:

```sql
insert into public.growth_admins(profile_id)
values ('REPLACE-WITH-REAL-PROFILE-UUID')
on conflict do nothing;
```

To regenerate database types after schema changes with your installed Supabase CLI:

```bash
supabase gen types typescript --project-id YOUR_PROJECT_REF > src/lib/database.types.ts
```

### Restricted local build environment

Only when process spawning is restricted, the tested PowerShell alternative is:

```powershell
$env:CIRCLES_CONSTRAINED_BUILD="true"
npm run build -- --webpack
```

It keeps TypeScript checking enabled and changes how build work is executed. Do not set this variable on Vercel. The normal production command remains `npm run build`.

## Environment Variables

| Variable                               | When required                             | Exposure                 |
| -------------------------------------- | ----------------------------------------- | ------------------------ |
| `NEXT_PUBLIC_DEMO_MODE`                | `true` for demo; `false` for connected    | Public, fixed at build   |
| `NEXT_PUBLIC_SUPABASE_URL`             | Connected                                 | Public                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Connected                                 | Public; protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY`            | Connected analytics/assignment and seed   | **Server only**          |
| `ANALYTICS_COOKIE_SECRET`              | Connected; random 32+ characters          | **Server only**          |
| `SEED_PASSWORD`                        | Seed command only; 12+ characters         | Local command only       |
| `CIRCLES_CONSTRAINED_BUILD`            | Optional local workaround                 | Build only               |
| `PLAYWRIGHT_EXTERNAL_SERVER`           | Optional test reuse of an existing server | Tests only               |

Generate a signing secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it in the environment. Never prefix a service key, cookie secret or password with `NEXT_PUBLIC_`. The repository ignores all environment files except the empty template.

## Deployment

**Vercel-ready, not deployed.**

1. Create a GitHub repository and push this repository. No GitHub remote or upload is created automatically.
2. In Vercel, import the GitHub repository. If you publish this folder as the repo root, leave Root Directory unset; if you publish the parent workspace, select `outputs/circles`.
3. Select the **Next.js** framework preset, Node.js **22.x**, install command `npm ci`, and build command `npm run build`. Leave the output setting at the Next.js default.
4. For a public reviewer demo, set `NEXT_PUBLIC_DEMO_MODE=true`; no backend credentials are required.
5. For connected mode, first apply all migrations to the intended Supabase project. Set the five connected-mode values above in Vercel's intended Preview/Production environment. Do not upload `SEED_PASSWORD` or set the constrained-build flag.
6. Deploy. Check the build logs and visit every main route. Update Supabase Auth's Site URL to `https://YOUR-DOMAIN/profile`, and configure any exact local/preview redirect destinations you intend to use.
7. Test signup, email confirmation, login, joining, moderation, and internal-report authorization on the hosted installation before describing it as live.
8. Environment changes require a new deployment; Next.js public environment values are embedded at build time. Keep preview/reviewer traffic separate from your real experiment project.

Optional CLI path from the repository: `npx vercel` for a preview, then `npx vercel --prod` after validation. No deployment has been attempted in this workspace.

Official references: [Supabase Next.js Auth](https://supabase.com/docs/guides/auth/quickstarts/nextjs), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side), [explicit database grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [Vercel environments](https://vercel.com/docs/deployments/environments), [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Engineering areas demonstrated

Product experimentation, conversion analytics, backend data modeling, SQL, authentication/authorization, growth metrics, testing and product tradeoffs.

See [APPLICATION_NOTES.md](APPLICATION_NOTES.md) for a truthful interview explanation and the development log.

## Future Improvements

Real-time conversation updates, Stripe payments, creator payouts, recommendations, notifications, retention measurement, a more complete experimentation platform, durable event delivery, AI-assisted moderation and AI creator tools are possible next steps. None is implemented in this MVP.

Known MVP bounds: the first 60 Discover circles, up to 100 pending creator questions at a time, browser-level identity, lightweight abuse controls, manual creator-team provisioning, and no automated significance/retention analysis.
