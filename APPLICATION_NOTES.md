# Application notes

## Project elevator pitch

Circles is a prototype for discovering interesting group conversations. Readers browse short exchanges, open a circle and join when they want to follow it. Creators publish; readers react and submit questions for creators to answer. The content is conversation, without needing photos or video.

## Feature to discuss

**Conversation Preview Experiment:** compare four-message and eight-message previews to learn whether more context increases joining.

A random browser UUID maps consistently to a variant using a versioned hash. Connected mode signs the identity cookie and persists the assignment in PostgreSQL. Server-rendered previews avoid a visible variant switch. Signing in keeps the same assignment; other devices and cleared cookies create new identities.

The dashboard reports unique visitors, opens, joins, conversion and lift. Simulated history, browser-local activity and connected measured traffic are separate.

## Technical challenge

A first implementation measured visibility using a fraction of the entire preview. Eight-message previews are taller, so that rule would make eligibility depend on the treatment. Both variants now observe the same fixed 64px area: half visible for one second while the tab is active. This measures an opportunity to see the preview, not proof of reading.

Other issues addressed during review:

- Database uniqueness and event deduplication prevent retries from creating extra memberships or converted visitors.
- Server actions emit successful participation outcomes; browsers submit only reading events. RLS independently enforces creator access.
- Receipt timestamps are captured before asynchronous analytics work. Reports match browser, group and experiment within seven days.
- A database outage can render baseline A while the visitor has a stored B assignment. Ingestion now checks the rendered context instead of labeling the fallback as B.
- Stopping enrollment retains attribution for existing participants. Analytics failure never undoes a successful product action.

## Product tradeoff

Too little preview may fail to create interest; too much may satisfy curiosity before opening. Joining is the primary activation metric, with opens as a secondary diagnostic.

Reading stays public. Joining adds a saved circle and questions. Premium membership is explicitly a non-billing demo. Creators control the main conversation; viewers use a question queue. This preserves readability but creates moderation work for creators.

## How success would be measured

Primary: distinct browsers that join a circle within seven days after a qualifying preview of that circle, divided by distinct preview browsers. Each browser counts once per variant even if it joins multiple circles.

Secondary: preview-to-open using the same identity/group/window rules. The experiment does not require a separately recorded open before a join, because that browser event may be lost. The creator dashboard additionally shows an ordered preview → open → join funnel.

Before real evaluation, define a useful effect size and sample plan, inspect assignment balance, let seven-day windows mature, and measure return reading. Automated sample planning, retention analysis and significance testing are not implemented.

## Results and what I learned

The generated example has 1,000 visitors per variant. A has 326 opens and 112 joins; B has 401 opens and 147 joins. Simulated join rates are 11.2% and 14.7%: **+3.5 percentage points** and **+31.25% relative lift**.

Those values test the reporting, not the product hypothesis. There is no real user-behavior result or established winning variant.

The implementation lesson is that a small UI change can alter its own measurement denominator. Exposure definitions, identity and attribution deserve the same care as the treatment. The fixed observation area, unique-browser reports and explicit data-source labels address that problem.

## 30-second explanation

“I built Circles, a prototype where people discover interesting group conversations by reading them. Its growth feature compares four-message and eight-message previews to learn whether extra context helps readers join. I implemented persistent assignment, first-party events and SQL conversion reports. A key challenge was fair impression measurement because the longer preview is taller. The dashboard separates demo and measured data. Its example results are simulated; no winning variant has been established with real users.”

## 2-minute explanation

“Circles is for people who enjoy creating and discovering through conversation. Readers browse freely, join groups, react and submit questions. Creators publish and choose which questions to answer.

The feature I would discuss is the preview experiment. A preview needs enough context to make someone care, but showing more might remove their reason to open. I implemented four-message and eight-message variants, using preview-to-join as the primary metric and preview-to-open as a diagnostic.

The work went beyond changing a message limit. Each browser gets persistent identity and assignment. In connected mode, PostgreSQL stores the assignment, the cookie is signed, and the server verifies identity. Successful joins are tracked on the server. Unique keys and SQL reports prevent repeated clicks from inflating converted visitor counts.

Review caught an impression bug: observing half of the whole preview makes the eight-message treatment harder to qualify. Both variants now use the same fixed area, visible for one second in an active tab. I also isolated analytics failures so a failed event cannot undo a successful join.

The dashboard demonstrates generated results, visibly labeled as simulated. They do not prove the hypothesis. My learning so far is that defining exposure, identity and conversion is as important as implementing the treatment. The next step is validating the hosted installation and running a planned test with real people, including whether additional joins lead to repeat reading.”

## Likely interview follow-up questions

**Why browser identity instead of user identity?**

Discovery starts before signup. Keeping the browser assignment preserves the treatment through login. Cross-device reconciliation is not implemented; this is not person-level measurement.

**How are concurrent joins or answers handled?**

Membership has a composite unique key. Answering runs in a PostgreSQL function that locks the pending question, verifies that group's admin, inserts an answer/public message, and changes status atomically. A repeat review is rejected.

**Can someone impersonate a creator?**

Server identity verification and RLS both check access. Posting and answering require administration of that specific group. Global experiments require a separate growth-admin role. Role-based PostgreSQL tests exercise these boundaries.

**How do percentage-point and relative lift differ?**

In the simulation, 14.7% minus 11.2% is 3.5 percentage points. Dividing the difference by 11.2% gives 31.25% relative lift. Neither is a measured product improvement here.

**Is the experiment statistically significant?**

No significance test is implemented. The dashboard presents descriptive rates and lift with a directional-result notice. Generated data cannot validate the hypothesis.

**What happens when analytics fails?**

The product action succeeds independently. Events can be lost because there is no durable retry queue. Signed cookies do not make browser reading events bot-proof, and the per-visitor cap is only lightweight abuse control.

**What was actually validated?**

Lint, TypeScript, 54 tests, a constrained production build, SQL seed/funnel parity, HTTP A/B rendering, and browser reviewer flows. The Playwright CLI was blocked by local worker-process restrictions; its 12 cases are prepared for CI. Hosted Supabase Auth, email confirmation and Vercel have not been validated. See [VERIFICATION.md](VERIFICATION.md).

**Is it deployed or used by paying customers?**

No. It is a local working prototype with Vercel instructions. No production adoption, revenue, real experiment traffic or payment collection is claimed.

**What would you do next?**

Validate the connected deployment, observe the core loop with real people, and add retention measurement. Add recommendations, real-time updates, notifications or billing only when product needs justify them.

## Development evidence

[DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) records the five phases, actual review findings and checks. Git history preserves the incremental implementation.

Before interviewing, walk through the code yourself. Describe your product decisions and code review accurately, including where AI assisted implementation; do not imply unaided authorship.
