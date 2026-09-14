# Application notes

## Development log

- Phase 1: started from an empty workspace. Chose the current stable Next.js version returned by npm (16.3.5), App Router, TypeScript and Tailwind. Built an intentionally text-led Discover feed and chronological group pages using 60 authored messages across six groups and ten fictional people.
- Kept creator conversation separate from viewer participation in the page structure. Browsing never requires an account.
- Used generated initials instead of stock portraits to keep the prototype lightweight and avoid implying that fictional conversations belong to real people.
- Planned two explicit execution modes: a browser-local reviewer demo and a real Supabase mode. Live failures must never silently turn into demo data.
- Deployment target is Vercel as requested; no deployment has been performed.

This document is updated as features and verification are completed. Seed data is fictional and is not evidence of product traction.
