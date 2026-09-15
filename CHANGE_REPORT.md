# Circles refinement report

The existing application and visual design were preserved. Every current group is free. Main navigation is **Discover → Groups → Inbox → Profile**.

## Group creation and creator invitations

Open Groups → Create a group, enter its name/address/description/category, then invite existing users by handle. The creator is the Owner/Creator. Each invitation appears in the recipient's Groups page with Accept and Decline. Acceptance grants only creator access for that group. Pending and declined invitations grant no posting permission. At least three collaborators are supported; a four-person group was verified in the browser.

Creator tools stay contextual: Groups and Manage circle lead to Creator studio. Creators can publish, review/answer/skip viewer questions, update basic settings and invite collaborators. Viewers still cannot post directly into the main group conversation.

## Private Inbox

Inbox contains only private person-to-person threads: a conversation list, start-by-handle control, text messages, timestamps and earlier-message pagination. The two people share one thread regardless of who starts it. Refresh retrieves incoming messages; unread receipts and realtime presence were intentionally omitted. There are no group DMs, attachments, calls or message payments. Viewer questions and creator invitations remain outside Inbox.

## Paid functionality removed or disabled

- Removed premium badges and the premium card CSS branch; cards show free joining.
- Removed monthly-price join buttons and all conditional paid-group UI.
- Removed simulated payment/membership confirmation copy and the premium join branch.
- Deleted `membershipStatus()` and its `premium_demo` entitlement creation. Server joining always inserts `active` membership.
- Removed the premium seed flag; all six seeded groups use `free` and a null price. Seeded memberships are active.
- Migration005 converts existing groups and legacy premium-demo memberships, and prevents creators from activating pricing through current database access.
- Stripe, paid-question and creator-revenue/earnings implementations were not present in this checkout; no such UI or integration remains.
- Dormant schema fields/legacy constraints remain for extensibility. They do not gate current reading or joining. README and application notes mention monetization only in Future possibilities and state it is unimplemented.

## Roles and navigation

All roles see Discover, Groups, Inbox and Profile.

| Role                            | Available actions                                                                                               | Boundaries                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Anonymous                       | Browse Discover and public group conversations; sign in from account/action prompts                             | Cannot join, react, ask, use private Inbox or access internal reports                                                |
| Signed-in viewer                | Join, react, ask creators, manage profile, use private Inbox, create a group and respond to creator invitations | Cannot publish in someone else's group without accepted creator access                                               |
| Group creator                   | Viewer features plus managed-group posting, question review, settings, invitations and simple group metrics     | No automatic internal Growth access                                                                                  |
| Internal platform administrator | Separately protected `/internal/growth` report and experiment configuration                                     | No consumer navigation link; internal role does not grant access to unrelated private messages or creator privileges |

Normal users cannot see Experiments in navigation and cannot directly access either protected report route. Creator status does not grant Growth access. The experiment infrastructure and seeded results remain available to authorized internal platform administrators.

## Schema and authorization

- **004_profiles_roles.sql:** unique optional handles, independent internal role and protected experiment configuration.
- **005_free_groups.sql:** free group/membership conversion and current free-only creator/join permissions.
- **006_private_inbox.sql:** canonical two-person threads, messages, indexes, participant RLS, thread-start and history functions.
- **007_creator_invitations.sql:** invitations, pending uniqueness, creator/invitee RLS and atomic accept/decline functions. Authenticated clients cannot directly add group creators.

Signed HttpOnly demo sessions determine the active identity and protect internal access. Hosted mode uses Supabase Auth and RLS. Browser-local demo content remains inspectable and should contain only fictional review messages.

## Verification and remaining work

191 automated tests passed in 16 files. ESLint, TypeScript and the constrained production build passed. 47 HTTP access assertions passed. Browser walkthroughs covered the core loop, collaboration, private messages, internal configuration and mobile layouts. Playwright discovered 18 tests but worker creation was blocked by `spawn EPERM`; no E2E pass is claimed.

Hosted Supabase integration and normal-environment Playwright/CI still need execution. No Vercel deployment was attempted. See VERIFICATION.md for exact commands and evidence.
