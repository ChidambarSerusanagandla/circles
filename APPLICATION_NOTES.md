# Application notes

## What Circles is

Circles is a conversation-first social platform where people discover communities by reading interesting group conversations. Readers browse short exchanges, open a circle and join when they want to follow it. Creators publish; readers react and submit questions for creators to answer. This MVP explores creating through text without needing photos or video.

The product leads with reading and joining. All roles see Discover, Groups, Inbox and Profile in the main navigation. Anonymous visitors encounter sign-in prompts before account actions within Groups, Inbox and Profile. Creator tools appear in the context of managed circles, and internal growth tools are separate from the consumer experience.

## Core user loop

**Discover → Preview → Open → Join → Read creator conversation → React / Ask**

All groups are free to discover and join. People can read before creating an account. Joining saves a circle to Groups and enables questions; a signed-in reader can also react. Only creators publish to the main conversation. Answers enter that conversation after a creator reviews the question.

## Consumer surface

- Discover: six categories of short conversation previews and a clear Continue watching action.
- Group conversations: creator identities, chronological messages, lightweight reactions, joining and viewer questions.
- Groups: joined circles, group creation, received creator invitations and contextual links to circles the account manages.
- Inbox: private one-to-one text conversations started by another person's existing handle, with participant names, timestamps and earlier-message loading.
- Profile: the signed-in account's display name and optional unique handle.

Main navigation is Discover, Groups, Inbox and Profile for anonymous and signed-in users. Experiment labels, configuration and platform analytics do not appear there. The project-owner profile is Chidambar Rao Serusanagandla; fictional creators remain separate people in the seeded conversations.

Inbox is separate from public group messages, creator invitations and viewer questions. Start a thread by handle; no public-profile pages were added. Incoming messages require refreshing the page. There are no real-time updates, unread indicators or delivery/read receipts. Demo messages remain in the shared browser's localStorage and are not secure private communication or externally delivered messages. In connected mode, RLS limits each thread and its messages to its two participants; internal platform access does not grant access to other people's threads.

## Creator surface

Any signed-in person can create a group from Groups → Create a group (`/creator?create=1`); existing creators can also use New circle in Creator studio. Creation makes that person the owner and first creator. Creator studio at `/creator` supports managing the account's own circles, posting messages, editing basic group settings, inviting collaborators, and answering or skipping pending questions. An answer is published in the group's conversation; a skipped question stays private.

Creators invite existing people by unique handle. The recipient sees the invitation in Groups and chooses Accept or Decline. Acceptance adds that person as a creator of the group, with no internal Growth grant. The team supports three or more creators; several seeded circles already have three. Pending duplicate invitations are rejected. There are no email invitations or team-removal controls.

The dashboard keeps engagement simple: Members, Questions and Reactions. One note identifies simulated metrics for the section. It does not show conversion funnels or platform-wide experiment reports. Creator permission applies to a particular group and does not grant internal platform access.

## Internal Growth surface

`/internal/growth` holds preview-experiment configuration, visitor/open/join counts, conversion rates and lift. It separates simulated history from browser-local demo activity or connected measured traffic. Only an authorized internal platform account can open the page or change experiment configuration; the legacy `/experiments` route enforces the same boundary.

The experiment infrastructure remains underneath Discover. The consumer experience defaults to four-message previews, and internal controls can start or stop the four/eight-message experiment. In demo mode, configuration applies only to the current browser. Connected mode stores it in PostgreSQL.

## Architecture

Next.js App Router renders routes and previews on the server. TypeScript defines domain models and validation boundaries; React client components handle participation and browser visibility. Supabase supplies email/password authentication and PostgreSQL storage in connected mode. RLS protects profile ownership, memberships and group-specific creator actions; `growth_admins` separately authorizes internal reporting and configuration.

Database access, input rules, analytics and experiment assignment live in separate modules. PostgreSQL stores relationships, event deduplication keys and persistent experiment assignments, and calculates conversion reports. Demo mode uses browser-local participation with server-signed identity cookies so localStorage cannot authorize internal access.

`src/lib/creators` isolates invitation rules, reads and demo transitions. The `creator_invitations` table and response RPC add creator membership transactionally after the recipient accepts; direct authenticated writes to `group_admins` are disallowed. `src/lib/inbox` isolates private conversation reads, validation and demo behavior. A thread stores a canonical ordered pair of profile IDs so two people share one thread, whichever person starts it. Sender checks and participant RLS protect connected messages. Inbox fetches the most recent 100 threads and pages history in batches of 50 using a timestamp/ID cursor. Demo storage deliberately remains inspectable within the shared browser; signed sessions protect internal role assignment, not the privacy of local demo content.

Apply migrations in numeric order: 001–004 establish the original schema and roles, 005 makes the current group and membership rules uniformly free/active, 006 adds private Inbox storage, and 007 adds creator invitations. All current collaboration and messaging remains separate from internal Growth authorization.

The repository supports Vercel's Next.js build and documents its environment variables. Hosted Supabase and Vercel have not been deployed or validated in this project. The local demo is an implementation review surface, not evidence of production traffic.

## Feature to discuss in interviews

**Conversation Preview / Discovery:** help readers decide whether a circle interests them, with an internal experiment comparing four-message and eight-message previews.

The default is a four-message preview with the experiment in draft. Starting the treatment is a protected internal decision at `/internal/growth`. The experiment and its controls are not consumer features or consumer navigation items.

A random browser UUID maps consistently to a variant using a versioned hash. Connected mode signs the identity cookie and persists the assignment in PostgreSQL. Server-rendered previews avoid a visible variant switch. Signing in keeps the same assignment; other devices and cleared cookies create new identities.

The internal dashboard reports unique visitors, opens, joins, conversion and lift. Simulated history, browser-local activity and connected measured traffic are separate. Group creators have their own group's engagement metrics; that permission does not grant cross-group reporting or experiment control.

## Feature purpose

Help someone understand whether a group is interesting before joining. The preview supplies enough conversation to make a choice, while opening the group offers the rest of the exchange. The experiment measures whether adding context changes that decision rather than assuming a longer preview is better.

## Product tradeoff

Too little preview may fail to create interest; too much may satisfy curiosity before opening. Joining is the primary activation metric, with opens as a secondary diagnostic.

Reading stays public and every group is free. Joining adds a saved circle and questions. Creators control the main conversation; viewers use a question queue. This preserves readability but creates moderation work for creators.

Private one-to-one Inbox messages give people a separate place to talk. They do not change who can publish to the main group conversation. Requiring an invitation recipient to accept adds a step, but prevents a creator from assigning another person a group role without that person's choice. A small handle-based workflow keeps collaboration practical without adding email invitations, public profile pages or a contact-discovery system.

Reader-facing terminology stays consistent: Join is the action, Joined is the account's state, and Members is the group count.

The reviewer tools have their own route so reviewers can inspect multiple roles without turning Profile into a development control panel. This adds a small amount of session and access code, but makes the product easier to understand and keeps the internal privilege boundary explicit.

## Technical challenge

A first implementation measured visibility using a fraction of the entire preview. Eight-message previews are taller, so that rule would make eligibility depend on the treatment. Both variants now observe the same fixed 64px area: half visible for one second while the tab is active. This measures an opportunity to see the preview, not proof of reading.

Other issues addressed during review:

- Database uniqueness and event deduplication prevent retries from creating extra memberships or converted visitors.
- Server actions emit successful participation outcomes; browsers submit only reading events. RLS independently enforces creator access.
- Receipt timestamps are captured before asynchronous analytics work. Reports match browser, group and experiment within seven days.
- A database outage can render baseline A while the visitor has a stored B assignment. Ingestion now checks the rendered context instead of labeling the fallback as B.
- Stopping enrollment retains attribution for existing participants. Analytics failure never undoes a successful product action.

A later product review identified a separate challenge: the prototype initially placed administrative and experiment tools alongside ordinary reader navigation. Merely removing those links would not protect the data. The implementation separates consumer, creator and internal surfaces and checks internal permission on the server and in PostgreSQL. `/experiments` retains the internal guard rather than becoming a back door to the report.

Demo account identity is now a signed HTTP-only, eight-hour session. Browser-local participation remains convenient for review, but it is not trusted for internal authorization. `/demo` switches reader, creator and owner identities without granting internal access; `/internal/sign-in` requires a separately configured private key, with no default value.

The connected seed also separates credentials: fictional reader/creator accounts use `SEED_PASSWORD` (at least 12 characters), while the internal owner uses a different `SEED_INTERNAL_PASSWORD` (at least 16 characters). Rerunning the seed updates the known owner's password to the private value so an old shared reviewer password cannot keep authenticating as the internal owner. Hosted password rotation and session behavior remain separate verification tasks.

The collaboration extension needs a different authorization boundary from platform access. Invitation responses lock the group and invitation, recheck that the inviter still has creator access, and reject a repeat response. Acceptance writes only the group creator link. Private messaging needs another boundary: a unique ordered participant pair prevents duplicate threads, and RLS checks membership in that pair on reads and sends rather than trusting a requested thread ID. These are implemented design decisions; hosted behavior still requires validation.

## Measurement

Primary: distinct browsers that join a circle within seven days after a qualifying preview of that circle, divided by distinct preview browsers. Each browser counts once per variant even if it joins multiple circles.

Secondary: preview-to-open using the same identity/group/window rules. The experiment does not require a separately recorded open before a join, because that browser event may be lost. Conversion reporting belongs to the protected internal Growth surface. Creators see only their group's Members, Questions and Reactions in the simple dashboard.

Before real evaluation, define a useful effect size and sample plan, inspect assignment balance, let seven-day windows mature, and measure return reading. Automated sample planning, retention analysis and significance testing are not implemented.

The generated example has 1,000 visitors per variant. A has 326 opens and 112 joins; B has 401 opens and 147 joins. Simulated join rates are 11.2% and 14.7%: **+3.5 percentage points** and **+31.25% relative lift**.

Those values test the reporting, not the product hypothesis. There is no real user-behavior result or established winning variant.

## What I learned

The implementation lesson is that a small UI change can alter its own measurement denominator. Exposure definitions, identity and attribution deserve the same care as the treatment. The fixed observation area, unique-browser reports and explicit data-source labels address that problem.

The product-refinement lesson is that a portfolio project should first work as a believable product. Showing every engineering feature in the main navigation made the reader's task less clear. Separating reader, creator and internal tools let the consumer journey stay simple while preserving the backend and analytics work for an authorized review. This is an implementation lesson, not a measured usability result from real users.

The collaboration work reinforced that roles are scoped to an action and resource. Accepting a group invitation enables collaboration in that group; it does not authorize global analytics or another pair's private messages. A convenient browser demo also needs an explicit privacy boundary: identity signing does not make its localStorage contents confidential.

## 30-second explanation

“I built Circles, a prototype where people discover interesting group conversations by reading them. Readers browse, join, react and ask questions; creators run the conversation. Behind that simple journey is an internally controlled experiment comparing four-message and eight-message previews. I implemented persistent assignment, first-party events and SQL conversion reports, including a fair impression rule for previews of different heights. The example results are simulated; no winning variant has been established with real users.”

## 2-minute explanation

“Circles is for people who enjoy creating and discovering through conversation. Readers browse freely, join groups, react and submit questions. Creators publish and choose which questions to answer.

The feature I would discuss is the preview experiment. A preview needs enough context to make someone care, but showing more might remove their reason to open. The normal product defaults to four messages. An authorized internal administrator can start the four/eight-message experiment, using preview-to-join as the primary metric and preview-to-open as a diagnostic.

The work went beyond changing a message limit. Each browser gets persistent identity and assignment. In connected mode, PostgreSQL stores the assignment, the cookie is signed, and the server verifies identity. Successful joins are tracked on the server. Unique keys and SQL reports prevent repeated clicks from inflating converted visitor counts.

Review caught an impression bug: observing half of the whole preview makes the eight-message treatment harder to qualify. Both variants now use the same fixed area, visible for one second in an active tab. I also isolated analytics failures so a failed event cannot undo a successful join. Reader navigation stays focused on the product, creators get contextual tools, and internal experiment access requires a separate role.

The dashboard demonstrates generated results, visibly labeled as simulated. They do not prove the hypothesis. My learning so far is that defining exposure, identity and conversion is as important as implementing the treatment. The next step is validating the hosted installation and running a planned test with real people, including whether additional joins lead to repeat reading.”

## Likely interview questions

**Why browser identity instead of user identity?**

Discovery starts before signup. Keeping the browser assignment preserves the treatment through login. Cross-device reconciliation is not implemented; this is not person-level measurement.

**How are concurrent joins or answers handled?**

Membership has a composite unique key. Answering runs in a PostgreSQL function that locks the pending question, verifies that group's admin, inserts an answer/public message, and changes status atomically. A repeat review is rejected.

**Can someone impersonate a creator?**

Server identity verification and RLS both check access. Posting and answering require administration of that specific group. Global experiments require a separate growth-admin role. Role-based PostgreSQL tests exercise these boundaries.

**Is a creator also an internal platform administrator?**

No. `group_admins` authorizes work on a particular group's conversation. `growth_admins` authorizes internal reports and experiment configuration. Both `/internal/growth` and the legacy `/experiments` route enforce internal access. The connected configuration RPC also checks that role, so hiding the navigation link is not the security boundary.

**Who are the demo accounts?**

Alex Morgan is the fictional reader with fixture ID `uid(900)`. Rahul Mehta, Priya and Arjun are fictional creators available at `/demo`, allowing a reviewer to try multiple invitation acceptances and both sides of a private thread. Chidambar Rao Serusanagandla is the separate project-owner profile with fixture ID `uid(901)`, not one of the fictional conversation creators. The reviewer route can choose those identities, but even choosing the owner there does not grant internal access. Connected seed accounts use separate Auth IDs, and the seed explicitly provisions internal access to `demo12@circles.example` with the private `SEED_INTERNAL_PASSWORD`, not the reader/creator password.

**How does a group gain multiple creators?**

A signed-in person creates a group and becomes its owner/first creator. A current creator invites another registered handle; the recipient accepts or declines in Groups. A partial unique index prevents duplicate pending invitations, and the response RPC accepts only the intended recipient. Acceptance atomically adds a `group_admins` link and changes invitation status. It never writes `growth_admins`. Three or more creators are supported, without a fixed team-size cap.

**Can an internal administrator read every private message?**

No application role grants that ability. Connected Inbox RLS only permits the two thread participants to read messages and send as themselves; internal Growth access does not bypass it. Database operators and the private server service-role credential are separate trusted capabilities, so this is not a claim of end-to-end encryption. The browser demo uses shared localStorage and is only suitable for fictional review messages.

**How does Inbox remain small?**

It supports text, participant names, UTC timestamps and 50-message history pages. A unique ordered participant pair reuses a thread when either person starts it. Threads are started by existing handle; questions, group conversations and invitations use their own models. The list is limited to the 100 most recently active threads. Incoming messages need page refresh; real-time delivery, unread indicators, attachments, public profile pages and delivery/read receipts are not implemented.

**How does internal access work without a hosted backend?**

Demo mode has a direct `/internal/sign-in` route that checks the server-only `DEMO_INTERNAL_ACCESS_KEY`, at least 24 characters, and issues a signed HTTP-only session lasting eight hours. There is no default key. `DEMO_SESSION_SECRET` should be configured with at least 32 random characters for stable or hosted demo sessions. Editing localStorage or selecting an account at `/demo` cannot produce an internal session. This demo mechanism does not replace Supabase Auth and database role checks in connected mode.

Demo session cookies are Secure by default in production. Hosted HTTPS keeps `DEMO_SECURE_COOKIES` unset or `true`. An explicit `false` override is only for a local production build served over HTTP and belongs in the ignored local environment file, not hosted configuration.

**Why does the seed change the owner's password on reruns?**

A previous shared seed password must not remain a way into an account that now has internal privileges. The seed requires a separate private password and updates the known seed owner's credential even if that account already exists. It leaves ordinary existing reader/creator passwords unchanged. This prevents reusing the old password for new sign-ins; it does not by itself demonstrate that previously issued hosted sessions have been revoked.

**How do handles work?**

Handles are optional, lowercase, 3–30 characters, start with a letter, and contain letters, numbers or underscores. PostgreSQL enforces format and uniqueness, and a user can update only their own profile. Leaving handles nullable avoids inventing handles for existing accounts when migration 004 is applied.

**Why does the experiment start in draft?**

The default reader experience should be deliberate. Draft serves four-message previews without claiming an active experiment. Internal controls can start the treatment; creators and readers cannot change it. In the reviewer demo, that configuration is browser-scoped, while connected configuration is stored in PostgreSQL through a protected function.

**How do percentage-point and relative lift differ?**

In the simulation, 14.7% minus 11.2% is 3.5 percentage points. Dividing the difference by 11.2% gives 31.25% relative lift. Neither is a measured product improvement here.

**Is the experiment statistically significant?**

No significance test is implemented. The dashboard presents descriptive rates and lift with a directional-result notice. Generated data cannot validate the hypothesis.

**What happens when analytics fails?**

The product action succeeds independently. Events can be lost because there is no durable retry queue. Signed cookies do not make browser reading events bot-proof, and the per-visitor cap is only lightweight abuse control.

**What was actually validated?**

The repository includes lint and TypeScript commands, unit tests, PostgreSQL/RLS tests that execute the migrations, seed/report checks, and desktop/mobile Playwright scenarios. The current revision's actual executions and environment limits belong in [VERIFICATION.md](VERIFICATION.md); an authored test is not automatically a passed test. Hosted Supabase Auth, email confirmation, private owner password rotation, cookie transport and Vercel have not been validated. Do not quote an earlier phase's pass count as evidence for later refinements.

**Is it deployed or used in production?**

No. It is a local working prototype with Vercel instructions. No production adoption or real experiment traffic is claimed.

**What would you do next?**

Validate the connected deployment, observe the core loop with real people, and add retention measurement. Add recommendations, real-time updates or notifications only when product needs justify them.

## Implemented behavior and limits

- Consumer journey: public previews and conversations; account-based Join/Joined state, reactions, questions, Groups, private Inbox and editable profile details. Every group is free.
- Creator surface: group creation and ownership, contextual `/creator` tools for managed groups, handle-based invitations and recipient acceptance/decline, message publishing, question review and group metrics.
- Internal surface: separately guarded reports and configuration at `/internal/growth`, with the same guard on legacy `/experiments` and no consumer links.
- Reviewer identities: `/demo` can switch reader, Rahul, Priya, Arjun and project owner without promoting internal permissions. Inbox and invitation content is shared browser demo data, not secure private communication.
- Simulated evidence: generated sample memberships/reactions, historical analytics and the 11.2%/14.7% example are demonstration data, not production adoption or a measured improvement.
- External limits: no hosted Supabase validation, no Vercel deployment, no real experiment winner, no statistical-significance calculation.

## Development evidence

[DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) records the five phases, actual review findings and checks. Git history preserves the incremental implementation.

The subsequent product refinement separates consumer, creator and internal routes; introduces signed demo sessions and private internal sign-in; separates project owner from fictional seed creators; adds optional unique handles in migration 004; and starts the preview experiment in draft. Those changes preserve the original preview-measurement work while making the primary reading journey clearer. Final checks for this refinement are recorded separately in the verification file.

The credential refinement gives the connected seed owner a private password separate from reviewer credentials and updates that password on seed reruns. Production demo cookies default to Secure, with an explicit local-only HTTP test override. No hosted deployment or externally validated password/session outcome is claimed.

The current product pass makes all groups free, keeps Discover / Groups / Inbox / Profile navigation, and adds explicit creator collaboration and separate one-to-one text threads. Migrations 005–007 apply the free membership rules, participant-only Inbox policies and invitation workflow. Local source and authored tests are evidence of implementation; exact executed checks are recorded in [VERIFICATION.md](VERIFICATION.md).

Before interviewing, walk through the code yourself. Describe your product decisions and code review accurately, including where AI assisted implementation; do not imply unaided authorship.

## Future possibilities

Possible future monetization includes paid group membership, paid questions and creator subscriptions. None is implemented in the current MVP. Dormant database fields leave room for later decisions, while every current group is free and no pricing, checkout, subscription or earnings flow exists.
