# Circles

Circles is a conversation-first social platform where people discover communities by reading interesting group conversations. Read a preview, find a circle you enjoy, and join to keep following it.

**Status:** an implemented MVP with a local reviewer demo and a Supabase integration. Hosted Supabase and Vercel are not connected or deployed. Sample conversations and historical metrics are fictional. No production adoption or real experiment traffic is claimed. Current verification results belong in [VERIFICATION.md](VERIFICATION.md).

## What it is

Circles makes the conversation the content. Browse a short exchange, open a group, read along, and join when you want to keep following. Creators publish messages. Readers can react and submit questions for creators to answer publicly.

The reader experience includes Discover with six categories, chronological conversations, free memberships, six reactions, Groups, a private one-to-one Inbox, and a profile with an editable display name and optional handle. People can create groups and invite other creators by handle. Email/password authentication is provided in connected mode. Creator publishing and internal growth analysis have separate entry points and permissions.

## Why I built it

Many social platforms reward image and video creation. Some people communicate and create better through text and conversation. This prototype explores whether those conversations can be interesting content in their own right, while keeping discovery accessible without an account.

## Core Product Loop

**Discover → Preview → Open → Join → Read creator conversation → React / Ask**

All groups are free to discover and join. Browsing is public. Reacting requires an account; asking requires membership. Viewers cannot post directly into the main group conversation. A creator's answer becomes a message in that conversation. The separate Inbox supports private one-to-one messages between signed-in people. Membership language stays consistent: **Join**, **Joined**, and **Members** describe the same relationship throughout the product.

### Product surfaces and access

| Surface         | Entry and purpose                                                                                                                   | Access                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Consumer        | Discover, Groups, Inbox, Profile; reading, joining, reacting, questions and private messages | All roles see these four navigation items. Anonymous visitors encounter sign-in prompts within Groups, Inbox and Profile before account actions. |
| Creator         | Contextual creator tools at `/creator`; group creation, creator invitations, publishing, question review, basic settings, and Members/Questions/Reactions | A signed-in person can create a group; its creators manage that group's content and invite collaborators. This never grants internal platform access. |
| Internal growth | `/internal/growth`; experiment configuration and cross-group conversion reporting                                                   | A separately authorized internal platform account. No consumer navigation or profile link points here.             |

The legacy `/experiments` entry enforces the same internal guard. Hiding a link is not authorization: the server checks internal access, and connected SQL functions independently check `growth_admins`. Being present in `group_admins` does not grant platform access. `/demo` is a direct reviewer utility, outside ordinary consumer navigation.

### Reader and creator reviewer walkthrough

1. Open Discover and read a preview. Open **Roommates After Midnight**.
2. Choose **Sign in to join** and use a demo sign-in identity. A safe return path brings you back to the selected circle.
3. Join, add a reaction, and submit a question.
4. Open `/demo` directly and choose the fictional creator, Rahul. Follow the contextual creator-tools entry to `/creator`.
5. Answer the question. Open the conversation to see the published response.
6. Switch to the project-owner identity at `/demo`. In Groups, choose **Create a group** to open `/creator?create=1`. If this identity already manages a group, open Creator studio and choose **New circle**. Create the group and publish its first message. Every circle uses the same free joining flow.
7. From the new group's creator team, invite `@rahul`, `@priya` and `@arjun`. Switch to each invited demo identity, open Groups and accept or decline. Accepted people appear in the creator roster and can manage the group; three or more collaborators are supported.
8. Open Inbox and enter another person's handle, such as `@alex`, to start a private thread. Send a text message, switch to that recipient at `/demo`, and open Inbox to reply. Inbox holds private messages; creator invitations stay in Groups and viewer questions stay in Creator studio.

The reviewer-only `/demo` route switches between reader **Alex Morgan**, fictional creators **Rahul Mehta**, **Priya** and **Arjun**, and project owner **Chidambar Rao Serusanagandla**. Owner and reader use distinct identities (`uid(901)` and `uid(900)` respectively); the owner is not presented as a fictional conversation creator. Choosing any of these identities does **not** grant internal access. Profile stays focused on the signed-in account.

Demo messages and invitations are stored in the shared browser's localStorage. Switching demo identities demonstrates the flows; it is not secure private communication, and no messages are delivered externally. Use fictional content for review. Connected Inbox privacy is enforced by participant-based PostgreSQL RLS, including for ordinary signed-in internal platform administrators.

### Internal demo walkthrough

1. Configure `DEMO_INTERNAL_ACCESS_KEY` with a private value of at least 24 characters and `DEMO_SESSION_SECRET` with a random value of at least 32 characters, then restart the app.
2. Open `/internal/sign-in` directly and provide your configured internal key. There is no default or committed key.
3. Open `/internal/growth`. Compare explicitly labeled **Demo data** and browser-local activity, and use its protected controls to start the four/eight-message experiment.

Internal demo authorization uses a signed, HTTP-only session cookie with an eight-hour lifetime. A localStorage edit or the `/demo` account switch cannot promote a reader or creator to internal access. The separate connected-mode authorization uses Supabase Auth plus `growth_admins`, not the demo key.

## Growth Experiment

**Conversation Preview Length**

The default configuration is **draft**: ordinary Discover previews show four messages, and the app does not claim the experiment is running. Only an internal platform administrator can start the 50/50 four/eight-message treatment from `/internal/growth`. Experiment controls and reports do not appear in consumer navigation.

Hypothesis: an eight-message preview gives people enough context to become interested and increases joining compared with four messages. More content may also satisfy curiosity and reduce the incentive to open.

| Measure           | Definition                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------- |
| Assignment        | 50/50 deterministic hash of a random browser UUID with a versioned experiment salt                             |
| Persistence       | One-year browser cookie; signed in connected mode; unique PostgreSQL assignment per browser and experiment     |
| Qualified preview | Half of a fixed 64px area at the preview's start is visible for one continuous second while the tab is visible |
| Primary metric    | Distinct preview visitors who join a circle they previewed within seven days / distinct preview visitors       |
| Secondary metric  | Distinct preview visitors who open a circle they previewed within seven days / distinct preview visitors       |
| Analysis unit     | Browser, not person, account, click or membership row                                                          |

The same observation area is used in both variants so preview height does not change entry into the denominator. The preview and outcome must match browser, circle, experiment and variant. Each converted browser counts once per arm, even if it joins multiple circles. The experiment join metric does not require a separate open event, which may be missed. Conversion reporting stays in the protected internal Growth area; the creator dashboard shows only Members, Questions and Reactions for the selected group.

Results from generated data only:

| Variant | Messages | Visitors | Opens | Joins | Preview → Open | Preview → Join |
| ------- | -------: | -------: | ----: | ----: | -------------: | -------------: |
| A       |        4 |    1,000 |   326 |   112 |          32.6% |          11.2% |
| B       |        8 |    1,000 |   401 |   147 |          40.1% |          14.7% |

Simulated absolute lift: **+3.5 percentage points**. Simulated relative lift: **+31.25%** (the UI rounds to 31.3%). These intentionally generated outcomes validate the report, not the product hypothesis. **No statistical significance test is implemented and no real winner is declared.**

With real traffic, predefine a useful effect size and sample plan, check allocation, allow seven-day windows to mature, and examine subsequent reading/retention before choosing a variant. Those decision procedures and retention metrics are future work. Cookie clearing and multiple devices create multiple visitors.

The internal controls change the experiment among `draft`, `running`, and `completed`. In connected mode, the protected `set_preview_experiment_status` RPC checks internal growth access before changing configuration. Demo configuration uses a signed cookie scoped to the current browser; it demonstrates the control without changing every reviewer's browser. The simulated report remains available regardless of enrollment status. An assignment failure serves baseline A without experimental exposure. Ingestion checks the actual rendered context so recovery cannot mislabel a fallback A preview as B.

## Technical Architecture

- **Next.js 16.3.5 / App Router**: server-rendered routes and server actions. This stable version was selected at project setup and is locked.
- **TypeScript + React**: typed domain models; client components for participation, demo storage and browser visibility.
- **Tailwind CSS 4 + custom CSS**: responsive reading layout, initials avatars, visible keyboard focus and loading/error/empty states. No remote assets are required.
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
src/lib/auth/            Signed demo sessions and internal-access checks
src/lib/creators/        Creator invitation rules, demo state and reads
src/lib/inbox/           Private thread/message rules, demo state and reads
src/lib/demo.ts          Browser-local reviewer participation state
supabase/migrations/     Schema, privileges, RLS, RPCs and indexes
supabase/reports/        SQL examples for conversion and engagement
scripts/seed.ts          Repeatable connected development seed
tests/unit/              Domain, analytics and assignment tests
tests/database/          Executable PostgreSQL role/RLS and seed tests
tests/e2e/               Desktop/mobile Playwright reviewer flows
APPLICATION_NOTES.md     Interview explanations and development evidence
```

The Discover query fetches at most 60 circles with batched first-eight-message previews. Account pages query their own memberships/admin links independently of that feed limit. Group history uses 50-message pages. Inbox lists the most recently active 100 participant threads and loads messages in 50-message pages, with a timestamp/ID cursor for earlier history. Queries use group/time, membership, reaction, question-queue, inbox participant/time and visitor/time indexes. No real-time sockets or background jobs are required; refresh Inbox to retrieve incoming messages. There are no unread counts or delivery/read receipts.

## Database Design

- `profiles`: Auth user ID, display name, optional handle and avatar URL. Created by the Auth trigger. Handles are unique, lowercase, 3–30 characters, start with a letter, and contain letters, digits or underscores. Null handles let existing profiles remain valid.
- `groups`, `group_admins`: groups and their many-to-many creator relationship.
- `creator_invitations`: group, inviter, invitee and pending/accepted/declined status; at most one pending invitation per group/person.
- `group_memberships`: unique group/person membership; new memberships use `active` status.
- `messages`, `message_reactions`: creator messages and unique message/person/emoji reactions.
- `questions`, `question_answers`: private pending/skipped questions; one answer per question.
- `inbox_threads`, `inbox_messages`: a unique ordered pair of distinct participants, plain-text messages of up to 2,000 characters, sender identity and timestamps. Separate from group messages, questions and invitations.
- `experiments`, `experiment_assignments`: versioned experiment and unique browser assignment.
- `analytics_events`: event identity, optional account/group, experiment attribution, JSONB metadata, demo flag, deduplication key and timestamp.
- `growth_admins`: explicit internal reporting access, separate from being a group creator.

A database function creates a group and its first creator atomically; `created_by` identifies its owner. Existing creators invite registered people by handle. Only the recipient can accept or decline. The acceptance function locks the group and invitation, verifies that the inviter is still a creator, and adds the recipient to `group_admins` without touching `growth_admins`. Creator collaboration supports three or more people without a fixed team-size cap. Answering a viewer question locks its pending row, verifies that group's creator, inserts its answer and public message, and changes status in one transaction.

### Authorization and RLS

| Entity/action                       | Database rule                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Public reading                      | Groups, public display names, creator roster and messages                                            |
| Profile editing                     | Own profile; display name, optional handle and avatar columns; handle format and uniqueness enforced |
| Group editing/posting               | Admin of that group; posts must use own author ID                                                    |
| Creator invitations                 | Only that group's creators invite; only the recipient responds through RPC; duplicate pending invitations rejected |
| Private Inbox                       | Only the two thread participants read messages; senders must be the signed-in participant. Internal growth access adds no access to other people's threads |
| Membership                          | Insert/read own; unique group/person; new memberships must use active status                                 |
| Reactions                           | Insert/delete/read own rows; public aggregate counts via RPC                                         |
| Questions                           | Members submit as themselves; author/admin can read pending/skipped; answered questions are public   |
| Answers/skips                       | Authorized RPC only; ordinary users cannot directly change moderation status                         |
| Global growth reports/configuration | Explicit growth-admin account only; group administration does not grant access                       |
| Assignments/event writes            | Trusted server service role only                                                                     |

The service key is used only by isolated server analytics modules and the development seed. Product mutations use the signed-in user's client and RLS. Migration 003 explicitly grants service-role table privileges: bypassing RLS alone does not confer table access.

Migration 004 adds optional handles, removes the former internal grant from the fictional Rahul seed account, defaults the preview experiment to draft, and provides the protected experiment-configuration RPC. The connected seed gives the separate project-owner account internal access without making it a creator of the fictional groups.

Migration 005 normalizes existing groups to free access and memberships to active, and enforces the current free group creation/update and active joining rules. Migration 006 adds participant-protected Inbox tables and thread/history functions. Migration 007 adds creator invitations and transactional responses; authenticated users cannot write creator membership links directly. These application roles do not limit a database operator or server service-role credential, which must remain private.

## Analytics

Events: `discover_viewed`, `group_preview_seen`, `group_opened`, `group_joined`, `reaction_added`, `question_submitted`, `experiment_exposed`.

Browser ingestion accepts reading events only. It validates origin, body size, shape and rendered preview context, derives identity on the server, and uses a lightweight per-visitor rate cap. Successful membership, reaction and question mutations emit their events on the server.

Event retry keys and unique exposure keys prevent duplicate delivery. Event receipt time is captured before asynchronous ingestion work; SQL uses event time and distinct visitors, never arrival order. Signed visitor cookies prevent choosing an arbitrary existing identity, but reading events and the rate cap are **not comprehensive bot protection**.

An event delivery failure does not undo a successful product action. There is no durable retry queue; outages, blockers, immediate navigation and network reordering can undercount events. The one-second preview rule intentionally excludes faster glances.

`is_demo=true` historical events are excluded from measured reports. Connected actions against fictional seeded groups are still observed actions and have `is_demo=false`; use a separate Supabase project for production traffic if reviewers are testing. Browser-local actions never claim to be production traffic.

## Technical Challenges

These were encountered and addressed during implementation/review:

- The first impression observer depended on preview height, biasing cohort entry. Both variants now use a fixed observation area.
- A maximum-length question plus answer could overflow the public-message limit. The answer limit is now 1,400 characters.
- Assignment outages followed by recovery could label a fallback preview with the wrong arm. The route provides fresh rendered context and ingestion validates it.
- Demo memberships and reactions initially followed only the currently selected account when displaying totals. Identity-specific selection and aggregate totals are now separate.
- Creator inbox limits originally applied before pending filtering, and account lists inherited the feed limit. Queries now apply the appropriate scope first.
- Service-role grants needed to be explicit for current Supabase projects. PostgreSQL tests exercise actual service-role access.
- Local restrictions blocked Node child processes. Unit/database tests use worker threads; an optional constrained build uses webpack and Next's worker-thread path. The verification record distinguishes browser inspection from automated Playwright execution.
- A product review exposed a role-design problem: reader navigation and profile switching mixed consumer, creator and internal tools. The application now gives them separate routes, contextual entries and server-side authorization, while keeping reviewer utilities outside the normal journey.

## Product Tradeoffs

- **Preview context vs curiosity:** measure joins, with opens as a diagnostic, rather than assuming more engagement is always better.
- **Open reading vs account actions:** every group is free to discover and join. Reading stays public; joining saves a circle and enables questions. Account requirements apply when a reader participates.
- **Creator conversation vs unrestricted chat:** a readable conversation with a question queue creates creator moderation work.
- **Private conversation vs shared group content:** Inbox gives two people a separate text conversation. It does not publish into groups or mix personal messages with creator invitations and viewer questions.
- **Product clarity vs reviewer convenience:** normal navigation serves readers, contextual tools serve creators, and a direct reviewer route supplies demo identities without granting internal privileges.
- **Simple reporting vs advanced analytics:** one internally controlled experiment, browser identity, all-time descriptive reports, and a seven-day window; no cross-device stitching, retention platform, significance testing or automatic winner.

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

Unit tests cover creation rules, duplicate memberships, reactions, question permissions/moderation, creator invitation transitions, private thread pairing and message validation, stable assignment, signed cookies, event validation/failure isolation, conversion windows, demo isolation and lift.

PGlite runs the actual migrations in embedded PostgreSQL, with mock Auth identity and anonymous/authenticated/service roles. It checks cross-user permissions, private membership lists, creator invitation access, Inbox participant isolation, admin impersonation, transactional answers, explicit service privileges, and the full connected seed's SQL results.

Playwright scenarios cover desktop/mobile reviewer flows. GitHub Actions is configured to install Chromium and run the check/build/browser pipeline. A configured workflow is not evidence of a successful CI run. See [VERIFICATION.md](VERIFICATION.md) for the actual commands, results and limitations of the current revision; this README does not claim a test pass count.

## Running Locally

Use **Node.js 22.19+** and npm.

```bash
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). With no Supabase configuration, the reviewer demo starts automatically with public Discover and four-message previews. Participation data lives in localStorage on that browser/origin; account identity and internal authorization are derived from a signed HTTP-only session, not localStorage.

For repeatable demo sessions, copy `.env.example` to `.env.local`, keep `NEXT_PUBLIC_DEMO_MODE=true`, and set a random `DEMO_SESSION_SECRET` of at least 32 characters. Without it, a single local process generates a temporary signing secret and sessions may expire when that process restarts. Set a separate `DEMO_INTERNAL_ACCESS_KEY` of at least 24 characters only if you want to review the internal tools. The application provides no default internal key. Demo cookies are Secure by default in production: leave `DEMO_SECURE_COOKIES` unset or `true` on hosted HTTPS. The environment template sets it to `true`.

To run the production build locally:

```bash
npm run build
npm run start
```

If that local production server is accessed over HTTP, set `DEMO_SECURE_COOKIES=false` in your ignored `.env.local` for this local test only. Do not copy the override to a hosted deployment. Development mode does not require the override.

### Connect Supabase

Use a fresh **development** Supabase project.

1. In the SQL editor, execute these files in order, once each:
   - `supabase/migrations/001_core.sql`
   - `supabase/migrations/002_analytics.sql`
   - `supabase/migrations/003_service_access.sql`
   - `supabase/migrations/004_profiles_roles.sql`
   - `supabase/migrations/005_free_groups.sql`
   - `supabase/migrations/006_private_inbox.sql`
   - `supabase/migrations/007_creator_invitations.sql`
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_DEMO_MODE=false`, your project URL, publishable key, server service-role key and a random cookie-signing secret.
3. In Supabase Auth, enable the email provider. Set Site URL to `http://localhost:3000/profile` for local development. If email confirmation is enabled, confirm the email and then sign in with the password; this MVP does not implement magic-link or automatic post-confirmation login.
4. Optional: set `SEED_PASSWORD` to at least 12 characters for fictional reader/creator accounts, and set a different `SEED_INTERNAL_PASSWORD` of at least 16 characters for the private project-owner account. Then run `npm run seed`. Both are local seed-command inputs; neither belongs in a public demo configuration or source file.
5. Start/restart the application. Partial configuration produces an error, never a silent fallback to demo data.

Seeded accounts:

| Account                      | Email                    | Access                                                                         |
| ---------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| Rahul Mehta                  | `demo01@circles.example` | Fictional Roommates creator; no internal growth access                         |
| Alex Morgan                  | `demo11@circles.example` | Reader                                                                         |
| Chidambar Rao Serusanagandla | `demo12@circles.example` | Separate project-owner/internal platform account; no fictional group ownership |

The fictional reader/creator accounts use your supplied `SEED_PASSWORD` (12+ characters). The internal project-owner account, `demo12@circles.example`, uses only the separate private `SEED_INTERNAL_PASSWORD` (16+ characters), which must differ from the reviewer password. Sharing reader/creator credentials must not share internal access.

The seed creates 11 fictional confirmed Auth accounts plus the project owner, 6 groups with 3 admins each, 60 authored messages, 60 memberships, 114 reactions, 2 pending questions and analytics for 2,000 simulated visitors. Connected Auth UUIDs are mapped by the seed; the demo `uid(900)`/`uid(901)` identifiers are fixture identities, not promises about hosted Auth UUIDs.

Seed insertion is repeatable via stable IDs/composite keys and does not reset modified demo content or existing fictional reader/creator passwords. The known seed owner's password is deliberately updated to the supplied `SEED_INTERNAL_PASSWORD` on every run, including when that account already exists, so an old shared reviewer password cannot continue signing in as the internal owner. This is a credential update, not a claim that hosted session revocation has been tested. Use a fresh development project for a completely fresh seed. Browser fixture member/reaction totals are illustrative; connected group counts derive from the actual seeded relational rows and therefore differ.

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

Only when process spawning is restricted, the available PowerShell alternative is:

```powershell
$env:CIRCLES_CONSTRAINED_BUILD="true"
npm run build -- --webpack
```

It keeps TypeScript checking enabled and changes how build work is executed. Do not set this variable on Vercel. The normal production command remains `npm run build`.

## Environment Variables

| Variable                               | When required                                                                                    | Exposure                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------ |
| `NEXT_PUBLIC_DEMO_MODE`                | `true` for demo; `false` for connected                                                           | Public, fixed at build   |
| `NEXT_PUBLIC_SUPABASE_URL`             | Connected                                                                                        | Public                   |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Connected                                                                                        | Public; protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY`            | Connected analytics/assignment and seed                                                          | **Server only**          |
| `ANALYTICS_COOKIE_SECRET`              | Connected; random 32+ characters                                                                 | **Server only**          |
| `DEMO_SESSION_SECRET`                  | Stable/hosted demo sessions; random 32+ characters                                               | **Server only**          |
| `DEMO_INTERNAL_ACCESS_KEY`             | Internal demo sign-in; private 24+ characters, no default                                        | **Server only**          |
| `DEMO_SECURE_COOKIES`                  | Production default is Secure; omit/`true` on HTTPS, `false` only for local HTTP production tests | Server cookie settings   |
| `SEED_PASSWORD`                        | Seed command; fictional reader/creator password, 12+ characters                                  | Local command only       |
| `SEED_INTERNAL_PASSWORD`               | Seed command; private owner password, 16+ characters and different from `SEED_PASSWORD`          | Local command only       |
| `CIRCLES_CONSTRAINED_BUILD`            | Optional local workaround                                                                        | Build only               |
| `PLAYWRIGHT_EXTERNAL_SERVER`           | Optional test reuse of an existing server                                                        | Tests only               |

Generate a signing secret locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and store it in the environment. Never prefix a service key, cookie secret or password with `NEXT_PUBLIC_`. The repository ignores all environment files except the empty template.

## Deployment

**Vercel-ready, not deployed.**

For deployment through your own accounts, follow [DEPLOYMENT.md](DEPLOYMENT.md): the complete 001–007 migration order, seed process, five runtime variables, Auth URLs/email delivery, GitHub import, and hosted role/privacy checklist. The current handoff stops after you create the Supabase project. Node is pinned to `22.x` to match the tested runtime and avoid Vercel selecting a newer major from an open-ended range.

1. Create a GitHub repository and push this repository. No GitHub remote or upload is created automatically.
2. In Vercel, import the GitHub repository. If you publish this folder as the repo root, leave Root Directory unset; if you publish the parent workspace, select `outputs/circles`.
3. Select the **Next.js** framework preset, Node.js **22.x**, install command `npm ci`, and build command `npm run build`. Leave the output setting at the Next.js default.
4. For a public reviewer demo, set `NEXT_PUBLIC_DEMO_MODE=true` and a random 32+ character `DEMO_SESSION_SECRET`. Leave `DEMO_SECURE_COOKIES` unset or `true`; production cookies are Secure by default. No backend credentials are required. Add a private 24+ character `DEMO_INTERNAL_ACCESS_KEY` only when internal demo access is needed; share it privately rather than publishing it in the repository or UI.
5. For connected mode, first apply all migrations to the intended Supabase project. Set the five connected-mode values above in Vercel's intended Preview/Production environment. Do not upload `SEED_PASSWORD` or `SEED_INTERNAL_PASSWORD`, disable Secure cookies, or set the constrained-build flag.
6. Deploy. Check the build logs and visit every main route. Update Supabase Auth's Site URL to `https://YOUR-DOMAIN/profile`, and configure any exact local/preview redirect destinations you intend to use.
7. Test signup, email confirmation, login, joining, group creation, creator invitation acceptance/decline, moderation, Inbox sending/history/privacy, profile/handle changes, and direct access to both `/internal/growth` and legacy `/experiments` on the hosted installation. Reader and creator accounts must be denied internal reports and configuration; nonparticipants, including internal accounts, must not read another pair's Inbox messages. Validate these behaviors before describing the installation as live.
8. Environment changes require a new deployment; Next.js public environment values are embedded at build time. Keep preview/reviewer traffic separate from your real experiment project.

Optional CLI path from the repository: `npx vercel` for a preview, then `npx vercel --prod` after validation. No deployment has been attempted in this workspace.

Hosted cookie behavior, Supabase email confirmation, private owner sign-in/password rotation and role enforcement still need validation against the configured installation. Local code and database checks do not establish that these hosted flows have passed or that existing hosted sessions are revoked by a password update.

Official references: [Supabase Next.js Auth](https://supabase.com/docs/guides/auth/quickstarts/nextjs), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side), [explicit database grants](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically), [Vercel environments](https://vercel.com/docs/deployments/environments), [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Engineering Areas Demonstrated

- Full-stack product development with Next.js and TypeScript
- PostgreSQL relational data modeling and SQL reports
- Supabase authentication, authorization and Row Level Security
- Analytics event design and failure isolation
- Growth experimentation and conversion analysis
- Automated unit and database testing
- Product tradeoffs around discovery, participation and creator tools

See [APPLICATION_NOTES.md](APPLICATION_NOTES.md) for a truthful interview explanation and the development log.

## Future Improvements

Real-time conversation updates, recommendations, notifications, retention measurement, a more complete experimentation platform, durable event delivery, AI-assisted moderation and AI creator tools are possible next steps. None is implemented in this MVP.

Known MVP bounds: the first 60 Discover circles, up to 100 pending creator questions and 100 incoming creator invitations at a time, the most recent 100 Inbox threads, browser-level experiment identity, lightweight abuse controls, and no automated significance/retention analysis. Creator invitations require an existing registered handle; there are no email invitations or team-removal controls. Inbox starts by handle and has no public-profile discovery, real-time updates, unread indicators, delivery/read receipts or attachments. Demo content is shared browser storage, not secure private communication.

## Future possibilities

Possible future monetization includes paid group membership, paid questions and creator subscriptions. None is implemented in the current MVP. Dormant database fields remain extensible, but all current groups are free and the product has no pricing, checkout, subscription or earnings flow.
