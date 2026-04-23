# Roadmap — MVP in 2 weeks

**Start:** Thursday 2026-04-23
**End:** Thursday 2026-05-07

Goal: ship the MVP as scoped in the README — Gmail-only, OAuth, encrypted storage, classification with OpenAI function calling, custom categories, LGPD consent, and phishing/scam safety analysis.

This is the **planning tracker** for the 2-week push. Task execution lives in GitHub issues; use the checks here for pacing.

---

## Week 1 — Foundations

**Ends:** Thu 2026-04-30
**Goal:** a deployed Next app with Google OAuth working end-to-end and encrypted refresh tokens in Postgres.

Day-by-day detail for the OAuth slice: `docs/roadmap-google-oauth.md`.

### Infra
- [ ] Docker dev environment (#3)
- [ ] shadcn/ui + Tailwind (#17)
- [ ] NeonDB + Drizzle ORM (#5)
- [ ] Vercel + GitHub Actions CI/CD (#7)

### Auth & crypto
- [ ] Google OAuth — login + `gmail.readonly` scope
- [ ] AES-256-GCM crypto helper (master key from env)
- [ ] Refresh token stored encrypted at rest
- [ ] CRUD Users — profile, sign-out, delete account (#11)

### Exit criteria (Thu 04-30)
- [ ] Signed-in user persisted in Neon
- [ ] Refresh token ciphertext in DB (verified by inspecting the row)
- [ ] App deployed on Vercel preview URL
- [ ] E2E login works on the deployed URL

---

## Week 2 — Product features

**Ends:** Thu 2026-05-07
**Goal:** user signs in, accepts consent, sees Gmail classified into their own categories with a safety badge.

### Compliance — must land before any email is pulled for a real user
- [ ] LGPD consent flow (block all email processing until accepted)
- [ ] Persist `ConsentRecord` (version, timestamp, IP, user agent)
- [ ] Account deletion path — right to erasure (LGPD Art. 18)

### Email pipeline
- [ ] Gmail email pulling (incremental sync via `historyId`)
- [ ] Email persistence with **encrypted body + subject**
- [ ] Scheduled pull (cron / Vercel scheduled function) every N minutes

### Categories & classification
- [ ] OpenAI platform setup — API key, usage alerts, cap (#4)
- [ ] CRUD Categories (#10)
- [ ] Guided category builder — UI that helps write effective descriptions
- [ ] Function-call schema generated from the user's categories
- [ ] Classify each pulled email, persist `Classification`

### Safety analysis
- [ ] Phishing/scam risk via a separate function call
- [ ] UI badge: safe / suspicious / dangerous

### Exit criteria (Thu 05-07)
- [ ] New user flow end-to-end: sign in → consent → Gmail pulled → classified → safety badge visible
- [ ] Every stored email body is ciphertext in the DB
- [ ] Categories are editable and classifications reflect the change on next pull
- [ ] Deployed on Vercel, at least 2 test users have completed the full flow

---

## Decisions needed up front (close this week)

- [ ] Product name
- [ ] Visual identity (color palette + logo placeholder is enough for MVP)
- [ ] Auth.js v5 vs v4 (v5 preferred if adapter situation is stable)
- [ ] OpenAI model for classification (default: `gpt-4o-mini` for cost/quality)
- [ ] Email-pull strategy: polling via `historyId` vs Gmail Pub/Sub push (MVP: polling)

## Out of scope (post-MVP)

- Extraction of user-defined fields
- Chatbot over emails
- Multi-account aggregation
- Per-plan limits enforcement (Free / Pro / Business)
- Google app verification for production `gmail.readonly` — weeks-long process, start planning before opening to non-test users

## Risks to this timeline

1. **OAuth Testing mode caps at 100 users.** Fine for MVP; production verification must start before real launch.
2. **LGPD consent text needs a legal review.** `docs/lgpd-consent.md` is a starting draft; budget time for a lawyer pass before any non-dev user accepts it.
3. **OpenAI cost exposure.** Body + classification per email can stack up. Cap per-user monthly request count from day one, even without formal paid plans.
4. **Two-week MVPs routinely slip 30–50%.** Cut order if you fall behind: **safety analysis first**, then **guided category builder** (a plain form is enough), then **scheduled pulls** (manual "Pull now" button covers demo).
5. **Small team (apenasetore + Lee3007).** Parallelize on Week 1: one takes OAuth + crypto, the other takes Docker + shadcn + Neon.
