# Email Assistant

AI-powered email assistant that **classifies**, **protects**, and **extracts information** from the user's inbox — delivered inside Gmail itself, so the user doesn't have to leave the tool they already use.

> **Status:** early development. Scaffolding on Next.js 16 + React 19 + TypeScript + Tailwind 4 + Jest Teste Vercel.

---

## Overview

The product adds an intelligence layer on top of the user's inbox.

### MVP scope (current focus)

- **Gmail only.**
- Connect via **Google OAuth** and pull received emails through the Gmail API.
- Read **headers + body** of each incoming email.
- **Classify with OpenAI function calling**, using a schema built from the user's categories.
- **Guide the user** while they create/edit categories, so the resulting function call is effective.
- Let the user **personalize categories** (CRUD).
- Store emails **encrypted at rest** in Postgres.
- Collect **LGPD consent** before any email is processed.
- Safety analysis (phishing / scam).

### Post-MVP (not in scope now)

- Extraction of user-defined fields.
- Chatbot with email context.
- Multi-account aggregation.
- Plan-based limit enforcement (Free / Pro / Business).

## Plans

| Plan | Core idea |
| --- | --- |
| Free | Low analysis volume, few custom categories, essential features only. |
| Pro | More emails/month, more categories, advanced extraction. |
| Business | Generous limits, multi-account aggregation, full feature set. |

Exact per-plan limits are still TBD — see **Milestones** below.

## Stack

Technology decisions already agreed:

- **Framework / language:** Next.js `16.2.4` (App Router, Turbopack) + TypeScript (strict)
- **UI:** React `19.2.4`, Tailwind CSS 4, **shadcn/ui** (Radix primitives) _(to install)_
- **LLM:** **OpenAI** _(to integrate)_
- **Database:** **Postgres** on **NeonDB**, **Drizzle ORM** _(to provision)_
- **Auth:** **Google OAuth** _(to implement)_
- **Dev env:** **Docker** _(to set up)_
- **Tests:** Jest 30 + Testing Library (jsdom)
- **Lint:** ESLint 9 with the official Next config
- **CI/CD:** **GitHub Actions**
- **Hosting:** **Vercel**

_Items marked "to …" don't exist in the repo yet — see **Milestones**._

## Running locally

**Requirements:** Node.js 20+ and npm.

```bash
# install dependencies
npm install

# dev server at http://localhost:3000
npm run dev

# production build
npm run build

# run the build
npm run start

# tests
npm test
npm run test:watch

# lint
npm run lint
```

## Project structure

```
src/
  app/          # App Router (layout, page, globals.css)
  lib/          # pure utilities
  __tests__/    # unit tests
```

## Note for contributors (humans and LLMs)

This project uses **Next.js 16**, which has API changes compared to earlier versions. Before writing Next-specific code, check `node_modules/next/dist/docs/` and read `AGENTS.md`.

## Milestones

Source of truth is the GitHub milestone list on the repo. The breakdown below mirrors it.

### Milestone 0 — Setup Project
- Setup Docker for dev environment (#3)
- Setup Google OAuth
- Setup Postgres NeonDB + Drizzle ORM (#5)
- Setup Vercel + deploy CI/CD (#7)
- Setup shadcn/ui + Tailwind CSS (#17)

### Milestone 1 — Gmail Integration
- Setup email pulling (#6)

### Milestone 2 — Category Classification
- Setup OpenAI platform API communication (#4)
- CRUD Categories (#10)
- CRUD Users (#11)

### Not yet scoped to a milestone (flagged for discussion)

- LGPD consent flow (blocker for M2 — no classification before consent is captured)
- Envelope encryption for email body + credentials (blocker for M1/M2)
- Product discovery: name, visual identity, benchmark of similar products
- Email safety analysis (phishing / scam)


### Post-MVP
- Extraction of user-defined fields
- Chatbot with email context
- Multi-account aggregation
- Per-plan limits (Free / Pro / Business)
