# Deploy Circles using your accounts

Prepared September 14, 2026. This is a setup runbook, not a deployment record. No Supabase project, GitHub remote, or Vercel deployment has been created by this pass. Application behavior is unchanged. The only build configuration change pins Node to `22.x` in the manifest and lockfile, matching the tested runtime and CI.

**Current stopping point: create your Supabase project, then return before running migrations or deploying.** The later steps below are the complete sequence for when you continue.

## 1. Create your Supabase project

1. Sign into [Supabase Dashboard](https://supabase.com/dashboard) using your own account. Select your organization and choose **New project**. If needed, create your organization first.
2. Use a recognizable name such as `circles-review`. This first installation contains fictional accounts and simulated analytics, so treat it as a hosted review environment.
3. Generate a strong database password and save it privately. Choose a region close to the intended reviewers. Record the actual region; no particular region is assumed by the app.
4. Review the selected plan and create the project. Wait for provisioning to finish.
5. Keep the Data API enabled with the `public` schema exposed. If it was disabled, enable it under **Integrations → Data API**. The migrations provide explicit grants; no broad automatic table grants are needed. Do not create tutorial tables or scaffold another app. [Supabase project and Data API setup](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
6. Open **Connect** to obtain the project URL. Under **Settings → API Keys**, obtain the publishable key and a server secret key. Keep secrets in your password manager or local environment file. [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)

The URL resembles `https://YOUR_PROJECT_REF.supabase.co`. Your Supabase dashboard account is separate from a Circles application account. No existing email address is assumed for your Circles login.

**Stop here for this phase.** Return with the project name and project URL if you want help with the next step. Do not send the database password, server key, seed passwords, or signing secret in chat.

## 2. Apply all seven migrations

Use this existing repository, whose local root is:

```text
C:\Users\chida\Documents\Codex\2026-09-14\yes-paste-the-following-into-codex\outputs\circles
```

In the new project's **SQL Editor**, create a query, paste one complete file, and run it. Check for success before proceeding to the next file. Save each successful query with its filename. Supabase supplies `auth.users`, `auth.uid()`, and the `anon`, `authenticated`, and `service_role` database roles.

| Order | File under `supabase/migrations/` | Purpose |
| --- | --- | --- |
| 1 | `001_core.sql` | Profiles, groups, creator links, memberships, messages, reactions, questions, Auth trigger, RLS and creator RPCs |
| 2 | `002_analytics.sql` | Analytics, assignments, experiment, independent internal role and reporting RPCs |
| 3 | `003_service_access.sql` | Explicit server service-role privileges |
| 4 | `004_profiles_roles.sql` | Unique handles, role separation and experiment configuration; default experiment to Draft |
| 5 | `005_free_groups.sql` | Free groups and active memberships; current creation/join rules |
| 6 | `006_private_inbox.sql` | Private participant pairs, messages, RLS and history RPC |
| 7 | `007_creator_invitations.sql` | Pending invitations, recipient decisions and atomic creator acceptance |

Apply **001 through 007**, not just 004–007. These files are not an idempotent reset script. On any error, stop and inspect the error and existing objects before retrying; do not delete tables or continue past a failed migration. No `supabase/config.toml` or automatic CLI migration deployment is configured. SQL Editor execution also does not create a Supabase CLI migration-history record; retain the successful-file checklist before adopting CLI migrations later.

After 007, this read-only SQL must return 15 rows, each with `exists` and `rls_enabled` true:

```sql
with expected(name) as (values
  ('profiles'), ('groups'), ('group_admins'), ('group_memberships'),
  ('messages'), ('message_reactions'), ('questions'), ('question_answers'),
  ('growth_admins'), ('experiments'), ('experiment_assignments'),
  ('analytics_events'), ('inbox_threads'), ('inbox_messages'),
  ('creator_invitations')
)
select e.name, c.oid is not null as exists,
       coalesce(c.relrowsecurity, false) as rls_enabled
from expected e
left join pg_namespace n on n.nspname = 'public'
left join pg_class c on c.relnamespace = n.oid
  and c.relname = e.name and c.relkind = 'r'
order by e.name;
```

This checks installation, not user isolation. SQL Editor runs with privileged access. Hosted authorization must also be exercised through ordinary user sessions in step 10. Table privileges and RLS are separate requirements; leave both as defined in the migrations. [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)

## 3. Configure local environment variables

The existing `.env.local` contains local demo settings. Edit it privately; do not overwrite it blindly or commit it. On a fresh clone only, copy `.env.example` to `.env.local`.

These are the **five connected runtime variables**. Use the same names in Vercel later:

| Variable | Value | Visibility |
| --- | --- | --- |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Public / build configuration |
| `NEXT_PUBLIC_SUPABASE_URL` | Your project URL | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your `sb_publishable_...` key | Public; database access remains subject to RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Your server `sb_secret_...` key | **Server-only secret** |
| `ANALYTICS_COOKIE_SECRET` | A random value of at least 32 characters | **Server-only secret** |

The environment variable retains its existing `SUPABASE_SERVICE_ROLE_KEY` name, but its value can be the current Supabase **secret key**. The application and seed pass it directly to `supabase-js`; neither parses a legacy JWT nor injects it into browser code. Supabase recommends publishable/secret keys for new projects; a legacy `service_role` key is also compatible while enabled. Do not use a JWT signing secret or database password here. A secret key maps to the database `service_role` and bypasses RLS. [Supabase key types](https://supabase.com/docs/guides/getting-started/api-keys)

Generate the cookie secret in your own terminal and paste its output only into the private configuration:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For seed loading, add two more values **locally only**:

| Variable | Requirement |
| --- | --- |
| `SEED_PASSWORD` | A private password of at least 12 characters for fictional reader/creator accounts |
| `SEED_INTERNAL_PASSWORD` | A different private password of at least 16 characters for the separate internal owner |

Do not add seed passwords to Vercel. Connected deployment does not require `DEMO_SESSION_SECRET`, `DEMO_INTERNAL_ACCESS_KEY`, or `DEMO_SECURE_COOKIES`. Do not copy `DEMO_SECURE_COOKIES=false`, `CIRCLES_CONSTRAINED_BUILD`, `PLAYWRIGHT_EXTERNAL_SERVER`, or `ACCESS_TEST_URL` into Vercel. They are demo/local-test settings. No `DATABASE_URL`, Supabase management token, GitHub token, Vercel token, SMTP password, `NEXT_PUBLIC_SITE_URL`, or OAuth secret is read by the application.

### Secret-boundary inspection

- The privileged client is in `src/lib/supabase/admin.ts`, guarded by `import "server-only"`. Its consumers are server analytics, server assignment and the server event route.
- Ordinary product reads and mutations use the public-key SSR client plus the authenticated user's session, so RLS governs those operations.
- The seed reads the server key only in the local script. No service key or seed password is passed as a client component prop or response value in the inspected paths.
- `.env.local` is ignored; only the empty `.env.example` is tracked. The lockfile is tracked.
- The current browser bundle contains neither configured demo secret value. A demo help string names `DEMO_INTERNAL_ACCESS_KEY`, but does not contain its value. No hosted Supabase key is configured yet, so scanning a built artifact for that actual value must be repeated after connected deployment.

## 4. Configure Supabase Auth

In **Authentication → Sign In / Providers**, enable Email and allow new signups. Keep **Confirm email** on. Set the minimum password length to 8, matching the app's minimum; use longer passwords for the seed as required above. Supabase's password flow supports verification followed by password sign-in. [Password Auth configuration](https://supabase.com/docs/guides/auth/passwords)

In **Authentication → URL Configuration**, use:

| Stage | Site URL | Additional Redirect URLs |
| --- | --- | --- |
| Local setup now | `http://localhost:3000/profile` | `http://localhost:3000/profile` |
| Hosted production later | `https://YOUR_ACTUAL_PRODUCTION_HOST/profile` | Keep the exact localhost entry; add the exact production `/profile` URL |
| Trusted Vercel previews | Keep the production Site URL | Add each actual trusted preview's `https://PREVIEW_HOST/profile` |

Copy the actual Vercel hosts after creation; placeholders are not usable URLs. Exact preview entries are sufficient for this pass. If you later need many previews, Supabase supports an account-scoped wildcard such as `https://*-YOUR_VERCEL_ACCOUNT_OR_TEAM_SLUG.vercel.app/**`; it permits every matching deployment under that slug, so prefer exact entries for now. Never allow all `*.vercel.app` tenants. The Site URL is the default redirect destination when code does not supply one. [Redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls)

**Match the current implementation:** `authenticate()` does not send `emailRedirectTo`, and there is no `/auth/callback` or `/auth/confirm` route. Keep the confirmation email link using `{{ .ConfirmationURL }}`, which goes through Supabase verification. Do not replace it with a nonexistent application callback. The intended flow is confirm the email, land on Profile, then explicitly sign in with the password. Automatic post-confirmation login is not implemented. [Confirmation email templates](https://supabase.com/docs/guides/auth/auth-email-templates)

Consequently, after the Site URL is set to production, a signup started on localhost or a preview still returns to production for confirmation. An allowlist alone does not dynamically select the starting host. After confirming, open the intended local/preview Profile page and sign in there. Hosted confirmation and session behavior still require a real test.

### Email delivery prerequisite

Supabase's built-in SMTP only delivers to authorized organization team addresses, currently with a two-email/hour limit. For initial testing, use your own authorized account email. Before accepting signups from arbitrary addresses, configure custom SMTP in Authentication settings: sender address/name and your mail provider's SMTP host, port, username and password. These credentials belong in Supabase, not Vercel. Follow the provider's sender/domain verification steps and disable email-link tracking. Do not disable email confirmation to disguise a delivery problem. [Supabase SMTP requirements](https://supabase.com/docs/guides/auth/auth-smtp)

Creator invitations are in-app invitations to existing handles, not Supabase email invites. They require no SMTP delivery. The seed creates already-confirmed Auth accounts and therefore does not test email confirmation or SMTP.

## 5. Load seed data once migrations and local configuration are ready

Run from the app repository in a normal PowerShell terminal with Node 22.19+ within the 22.x line:

```powershell
Set-Location 'C:\Users\chida\Documents\Codex\2026-09-14\yes-paste-the-following-into-codex\outputs\circles'
npm ci
npm run seed:check
npm run seed
npm run dev
```

`seed:check` builds the seed plan without writing to Supabase. `seed` reads `.env.local`, creates Auth users through the admin API, maps their real UUIDs, and inserts relational data. There is no standalone SQL seed to paste. Do not create those Auth accounts manually first or run the seed in a Vercel build.

If this restricted local environment reports `spawn EPERM` starting `tsx`, the seed has **not** completed. Run the same commands in your normal local terminal; retain the error if it persists. Do not infer success from the dry run or local SQL tests.

Expected on a fresh seed: 12 profiles/Auth accounts (11 fictional people plus the separate owner), 6 free groups, 18 creator links, 60 messages, 60 memberships, 114 reactions, 2 pending questions and 2,000 simulated experiment visitors. Inbox and invitation tables start empty. The preview experiment remains Draft.

| Purpose | Account | Handle | Password source |
| --- | --- | --- | --- |
| Viewer | `demo11@circles.example` | `@alex` | `SEED_PASSWORD` |
| Creator | `demo01@circles.example` | `@rahul` | `SEED_PASSWORD` |
| Creator invite recipient | `demo02@circles.example` | `@arjun` | `SEED_PASSWORD` |
| Creator invite recipient | `demo03@circles.example` | `@priya` | `SEED_PASSWORD` |
| Separate internal owner | `demo12@circles.example` | `@chidambar` | `SEED_INTERNAL_PASSWORD` |

The owner profile keeps **Chidambar Rao Serusanagandla**. The seed's internal access is separate from fictional group ownership. Reviewer credentials are for fictional test content only; never use shared accounts for real private conversations or share the internal password with reviewers.

Rerunning the seed preserves existing content and ordinary seed-account passwords; it fills missing handles and rotates the known seed owner's password to `SEED_INTERNAL_PASSWORD`. It is not a database reset or verified session-revocation procedure. Use a fresh project for a clean rehearsal.

Inspect the following read-only counts immediately after seeding, before user activity:

```sql
select 'profiles' as entity, count(*) from public.profiles
union all select 'groups', count(*) from public.groups
union all select 'creators', count(*) from public.group_admins
union all select 'messages', count(*) from public.messages
union all select 'memberships', count(*) from public.group_memberships
union all select 'reactions', count(*) from public.message_reactions
union all select 'questions', count(*) from public.questions
union all select 'assignments', count(*) from public.experiment_assignments;

select key, status from public.experiments;
select is_demo, event_name, count(*) from public.analytics_events
group by is_demo, event_name order by is_demo, event_name;
```

All initial seeded events must be `is_demo=true`. Recorded actions after connection are observed review activity and must not be described as organic production traffic. Measured experiment conversion stays empty until the experiment runs and qualifying attributed actions occur; demo results remain available separately.

If you later register a separate personal email account, use Profile to set your real display name and an available handle. After verifying its Auth UUID in the dashboard, the database operator can explicitly grant internal access:

```sql
insert into public.growth_admins(profile_id)
values ('REPLACE_WITH_YOUR_VERIFIED_AUTH_USER_UUID')
on conflict do nothing;
```

This is an intentional administrative grant, never a signup default or creator-invitation effect. Do not publish real seed or personal passwords in the repository.

## 6. Validate connected localhost before uploading

Restart any existing demo server so it reads the connected environment. Open `http://localhost:3000/profile` and sign in using a seeded email/password. The connected build must not expose `/demo` or the internal demo-key sign-in flow. Run the role and feature checks in step 10 against localhost first; they will exercise hosted Supabase even though the web server is local.

Record the actual output and exit status for these commands in a normal terminal:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

The existing Playwright suite and GitHub CI target the local reviewer demo; they do not establish hosted Supabase integration. A connected environment may need a separate terminal/build from those demo tests. Keep hosted manual verification evidence separate.

## 7. Create and push your GitHub repository

The app already has Git history on `main`, a committed lockfile, `.gitignore`, and CI. No remote was configured at inspection. Publish **the app folder**, not the enclosing Documents/Codex workspace.

In your GitHub account create an empty repository, for example `circles`. Choose its visibility deliberately; do not initialize it with a README, license or gitignore because the local history already exists. Then run the following locally, replacing the account/repository URL with the one GitHub shows:

```powershell
git status --short
git check-ignore .env.local
git ls-files .env.local
git remote -v
git remote add origin https://github.com/YOUR_ACCOUNT/circles.git
git push -u origin main
```

Before pushing, `git ls-files .env.local` must print nothing. Inspect any uncommitted changes before committing or uploading them. Authenticate through your normal GitHub credential manager/browser; do not put a token in the remote URL. These commands are future account steps, not commands executed during this preparation. [GitHub existing-repository instructions](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)

Open the repository's **Actions** tab and inspect the actual run. CI is configured for lint, TypeScript, tests, seed dry run, build and Playwright. No successful GitHub Actions run is currently claimed.

## 8. Import into your Vercel account

After connected testing and your GitHub upload, sign into your Vercel account, select your intended account/team, and choose **Add New → Project**. Connect GitHub, allow access to your Circles repository, and select **Import**. Use:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root directory | Repository root (`./`) |
| Production branch | `main` |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Leave the Next.js default |
| Node.js | `22.x` |

The manifest now pins `22.x`: Vercel gives `package.json` engine settings precedence, and the old `>=22.0.0` range could select Node 24. No dependency versions were changed. [Vercel Node selection](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

Before clicking Deploy, enter the five runtime variables from step 3 for **Production**. Mark the server key and cookie secret sensitive where offered. Keep `NEXT_PUBLIC_DEMO_MODE=false`. Choose Preview scope only for trusted branches using a review database; later preview traffic must use a separate Supabase project when real production traffic exists. Do not expose privileged production values to untrusted preview code. No automatic Supabase marketplace provisioning is needed. [Vercel project import](https://vercel.com/docs/projects/managing-projects), [environment scopes](https://vercel.com/docs/environment-variables)

## 9. Deploy only after the preceding account steps are complete

When you are ready to proceed with deployment, click **Deploy**, inspect the build logs and copy the actual stable production URL from Vercel. A successful upload is not evidence of working application flows.

Set Supabase's Site URL and Redirect URLs using step 4 with that real host. If any Vercel environment value changes, trigger a fresh deployment; existing deployments keep their previous configuration, and Next.js public values are embedded at build time. Auth dashboard URL changes alone do not require rebuilding application code. [Vercel environment behavior](https://vercel.com/docs/environment-variables)

Inspect the deployed browser's JavaScript and requests to confirm no privileged key value is present, then run the checklist below. Record the deployment URL, commit, date, accounts/roles used, observed result and any error without recording secrets. No deployment action is authorized for this preparation pass.

## 10. Hosted verification checklist

Use isolated browser profiles/sessions for the different people. Account switching must use real Supabase sign-out/sign-in, not the demo selector. A dashboard owner or service key bypasses RLS, so it cannot prove ordinary user isolation. [Supabase RLS behavior](https://supabase.com/docs/guides/database/postgres/row-level-security)

The migration and server-path review found the following rules in the current implementation. These are code-review findings; the hosted checks remain pending.

| Role/surface | Enforced access |
| --- | --- |
| Anonymous | Public profiles, groups, creator messages, answered questions and aggregate counts; no account writes or private Inbox |
| Viewer | Own profile edits and memberships; own reactions; member-only question submission; participant-only private messages |
| Creator | Posting, settings, question review and simple metrics only for groups they administer |
| Creator invitation | Group creators invite; only the recipient responds; acceptance checks the inviter still has the role and adds the creator atomically |
| Inbox | Only the two participants read; inserts require the authenticated participant's sender ID; no global Growth override |
| Internal platform admin | Separate `growth_admins` grant; server pages/actions and database reporting/configuration RPCs independently check it |

### Public and viewer flows

- [ ] Anonymous: Discover → four-message preview while Draft → open a group → read chronological creator messages. All groups are free.
- [ ] Navigation remains Discover → Groups → Inbox → Profile; no Growth or Experiments links appear.
- [ ] New real-email signup sends a confirmation email; following it confirms the account; manual password sign-in works. Verify logout and a fresh login/reload too.
- [ ] Viewer: sign in as Alex, join a group, reload and see membership in Groups. Repeating a join creates no duplicate membership.
- [ ] Add/remove a reaction; reload and confirm persistence. Submit a question after joining. It enters the creator's pending queue, not the main conversation or Inbox.
- [ ] Profile: edit your display name and handle; verify persistence and duplicate-handle rejection. New invitees must have saved handles.

### Group creation and collaboration

- [ ] As a viewer, Groups → Create Group. Creation adds that person as owner/first creator, with no internal Growth grant.
- [ ] Invite `@rahul`, `@arjun`, and `@priya` to that new group. Before acceptance, it still has one creator; invitees cannot publish there.
- [ ] Sign in separately as each recipient, open Groups and accept. The group has four creators. Each can post as themselves.
- [ ] Send a further invitation to another existing handle and decline it; decline creates no creator link. A repeated pending invitation/response does not duplicate roles.
- [ ] Creator posts a conversation message, reviews a viewer question, answers it and sees the answer in the public group. Skip another question and confirm it is not published.
- [ ] An unrelated creator cannot manage that group's settings, publish there or answer its questions.
- [ ] A different person cannot accept someone else's invitation. Direct inserts into `group_admins` and direct invitation status updates through the user API are denied.
- [ ] Acceptance still fails if the inviter no longer has the group role. Check this with a disposable test group and controlled database-operator removal; there is no team-removal UI.

### Private Inbox

- [ ] Start a thread by another person's existing handle, send plain text, and check timestamps and persistence after reload.
- [ ] Recipient sees the thread and replies. Refresh the sender's Inbox to retrieve the reply; no real-time/read-receipt behavior is promised.
- [ ] Starting from either direction returns the same one-to-one thread. Self-thread creation is rejected.
- [ ] A third user, including a signed-in internal Growth administrator, sees no other pair's thread or messages through direct table reads or `inbox_message_page` RPC.
- [ ] That third user cannot insert into the private thread; a participant cannot spoof another sender ID. Test these with the publishable key and the respective user's Auth session, never the server key.
- [ ] Group conversations, viewer questions and creator invitations remain outside Inbox.

### Internal authorization and analytics

- [ ] Anonymous visitors, viewers and group creators receive a denied/not-found result at both `/internal/growth` and `/experiments`, including direct navigation.
- [ ] The explicit internal owner can open Growth and configure the experiment; viewer/creator calls to reporting and configuration RPCs are denied.
- [ ] An accepted creator invitation does not grant access to Growth. Internal access also does not permit editing unrelated groups or reading other people's private threads.
- [ ] The simulated report retains 1,000 visitors per arm, 112/147 joins and 11.2%/14.7% conversion, labeled once as Demo data. Measured reports exclude those seeded events.
- [ ] Start the experiment only for the controlled hosted test; observe a preview for at least one second, then open/join with an eligible account. Confirm non-demo events/assignment persist and refreshing keeps that browser's variant. Restore Draft afterward if testing is complete.
- [ ] Public UI never shows assignment labels, experiment controls or pricing. No real production traction or statistical significance is inferred from reviewer activity.

## Verification status at preparation

The prior implementation record reports **191 tests passed**, ESLint passed, TypeScript passed, a constrained local production build passed, and **47 local HTTP assertions passed**. These are existing results, not rerun or hosted results from this documentation pass. See [VERIFICATION.md](VERIFICATION.md).

**Playwright did not pass:** 18 cases were discovered, but local worker startup failed with `spawn EPERM`. GitHub Actions, hosted Supabase Auth/PostgREST, email confirmation, real server-key access and Vercel deployment remain unverified. Local PostgreSQL tests use PGlite with mocked Auth identities; they do not substitute for the hosted checks above.
