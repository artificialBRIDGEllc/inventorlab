# InventorLab

> **Defensible inventorship, from conception to filing.**
>
> A tamper-evident platform that captures inventor conception, orchestrates AI‑assisted
> claim drafting, preserves priority under USPTO §§ 119(e) / 120, and produces
> court‑admissible invention records signed with RFC 3161 trusted timestamps.

[![Build](https://img.shields.io/badge/build-vite%20%2B%20esbuild-blue)]()
[![Runtime](https://img.shields.io/badge/runtime-Node.js%20%E2%89%A520-brightgreen)]()
[![DB](https://img.shields.io/badge/db-PostgreSQL%20%2B%20Drizzle-blue)]()
[![License](https://img.shields.io/badge/license-Proprietary-lightgrey)]()

---

## Table of Contents

1. [What is InventorLab?](#what-is-inventorlab)
2. [Core Capabilities](#core-capabilities)
3. [Architecture](#architecture)
4. [Data Model](#data-model)
5. [Provenance Ledger & Crypto Model](#provenance-ledger--crypto-model)
6. [Project Layout](#project-layout)
7. [Getting Started](#getting-started)
8. [Environment Variables](#environment-variables)
9. [NPM Scripts](#npm-scripts)
10. [API Surface](#api-surface)
11. [Security Posture](#security-posture)
12. [Compliance Notes](#compliance-notes)
13. [Deployment](#deployment)
14. [Operations & Observability](#operations--observability)
15. [Development Conventions](#development-conventions)
16. [Troubleshooting](#troubleshooting)

---

## What is InventorLab?

InventorLab is a multi‑tenant SaaS platform that walks an inventor and outside counsel
through a disciplined, legally defensible patent conception‑to‑filing workflow:

1. **Conception Capture** – The inventor authors a narrative describing the invention
   *before* any AI assistance. The narrative is locked (hashed and timestamped) to
   establish a clean human authorship baseline.
2. **AI‑Assisted Claim Drafting** – After lock, an Anthropic‑backed agent proposes
   claim elements. Every proposal, acceptance, rejection, and modification is logged.
3. **Prior‑Art & Counsel Review** – Counsel annotates claims, flags concerns, and
   signs the matter off as *ready to file*.
4. **Invention Record** – A deterministic, cryptographically hashed PDF/HTML invention
   record is generated; the document hash is RFC 3161 timestamped via a commercial
   TSA (DigiCert / Entrust).
5. **Priority Guard** – For continuations, CIPs, and divisionals, the platform
   diffs claim elements against the parent's locked conception to surface §112
   new‑matter risk *before* filing.

Every step — human or AI — writes to an append‑only **Provenance Ledger** whose
chain hashes make silent tampering detectable.

---

## Core Capabilities

| Capability | Summary |
|---|---|
| **Tamper‑evident provenance** | Hash‑chained ledger of every event (human, AI, system). |
| **RFC 3161 timestamping** | Trusted‑timestamp authority anchoring for hashes. |
| **AI claim drafting** | Anthropic Claude via `@anthropic-ai/sdk`, bounded to locked conception context. |
| **Priority Guard** | Parent/child claim‑element diffing for continuations, CIPs, divisionals. |
| **Joint inventorship** | Multi‑inventor conception narratives + dispute tracking. |
| **Counsel workflow** | Claim annotations, concern flags, ready‑to‑file sign‑off. |
| **Invention Record** | Deterministic HTML/PDF with embedded hash + timestamp token. |
| **Multi‑tenant + white‑label** | Tenant isolation, data‑residency hint, brand override. |
| **Bayh‑Dole guardrails** | AI drafting is disabled on federally‑funded matters. |
| **WebAuthn / ID.me ready** | Schema support for FIDO2 credentials and ID.me identity claims. |

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        Browser (React + Vite)                      │
│  wouter · TanStack Query · Radix UI · Tailwind · shadcn patterns   │
└───────────────────────────┬────────────────────────────────────────┘
                            │  fetch / JSON · session cookie
┌───────────────────────────▼────────────────────────────────────────┐
│                    Express 5 API (server/app.ts)                   │
│  helmet · rate‑limit · express‑session (PG store) · passport‑local │
│                                                                    │
│  routes.ts ── auth, matters, conception, AI, claims, prior art,    │
│               counsel, priority‑guard, invention record, ledger    │
│                                                                    │
│  ai.ts · counsel.ts · priority-guard.ts · pdf-generator.ts         │
│  ledger.ts (hash chain) · crypto.ts (SHA‑256 + RFC 3161 TSA)       │
└───────┬──────────────────────────┬────────────────────────┬────────┘
        │                          │                        │
        ▼                          ▼                        ▼
 PostgreSQL 15+            Anthropic API              RFC 3161 TSA
 (Drizzle ORM,           (claim drafting,             (DigiCert /
  shared/schema.ts)       prior‑art analysis)          Entrust)
```

**Runtime boundaries.** A single Node process serves both the JSON API and, in
production, the built React SPA as static assets (`server/index.ts`). In development,
Vite dev‑serves the client independently and proxies `/api`.

**Why not Next.js?** The surface is a classic SPA + stateful API with session
cookies and a long‑lived Postgres session store; Express 5 keeps the auth + ledger
model explicit and the cold‑start cost low.

---

## Data Model

Defined in [`shared/schema.ts`](shared/schema.ts) with Drizzle + `drizzle-zod`.

Core entities:

| Table | Purpose |
|---|---|
| `tenants` | Tenant, tier (`solo` / `professional` / `enterprise`), region, white‑label. |
| `users` | Email, bcrypt hash, role (`inventor` / `counsel` / `admin`), FIDO2, ID.me. |
| `matters` | Patent matter; `application_type`, `matter_status`, `session_state`, parent link. |
| `matter_inventors` | Joint‑inventorship join table with `inventor_role` enum. |
| `conception_narratives` | Per‑inventor narrative; locked hash is the "pre‑AI" baseline. |
| `claim_elements` | Numbered elements with `aiProposedText` + `humanFinalText` + status. |
| `prior_art_references` | Search results, relevance annotations. |
| `inventorship_disputes` | Conflict records for joint inventorship. |
| `invention_records` | Generated artifact metadata + content hash + TSA token. |
| `provenance_ledger` | Append‑only hash‑chained event log. **Never updated, never deleted.** |

**State machine (`matters.session_state`):**
```
conception_open → conception_locked → ai_open → ai_locked → complete
```
Each transition is guarded at the route layer and recorded in the ledger. AI drafting
is rejected unless the matter is in `ai_open` / `ai_locked` **and** the calling
inventor's narrative is locked.

---

## Provenance Ledger & Crypto Model

File: [`server/ledger.ts`](server/ledger.ts), [`server/crypto.ts`](server/crypto.ts).

Each ledger row contains:

- `payloadHash` — `SHA‑256(canonical JSON payload)`
- `prevChainHash` — chain hash of the previous entry for the same `matterId`
- `chainHash` — `SHA‑256(payloadHash ‖ prevChainHash)`
- `tsaToken` — RFC 3161 timestamp token (DER, base64)
- `actorType` — `human` | `ai` | `system`, plus `aiModelId` when applicable

Tampering with any historical row invalidates every subsequent `chainHash`.
`GET /api/matters/:id/ledger/verify` walks the chain and returns a pass/fail report;
invention‑record PDFs embed the final chain hash + TSA token so a third party can
verify authenticity without access to the database.

Event types (enum `ledger_event_type`) are exhaustive — see `shared/schema.ts`.

---

## Project Layout

```
.
├── api/                     Vercel serverless entrypoint ([...path].ts → server/app.ts)
├── client/                  Vite + React SPA
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── pages/           auth · dashboard · matter · conception · claims · …
│       ├── components/      shadcn/Radix UI primitives + domain components
│       ├── hooks/ · lib/
│       └── index.css
├── server/                  Express 5 API
│   ├── index.ts             process entry (serves SPA in production)
│   ├── app.ts               middleware stack, session, rate‑limit, helmet
│   ├── routes.ts            HTTP endpoints
│   ├── auth.ts              bcrypt + session guards (requireAuth/requireCounsel/requireAdmin)
│   ├── ai.ts                Anthropic claim drafting + prior‑art analysis
│   ├── counsel.ts           counsel annotations, sign‑off, concerns
│   ├── priority-guard.ts    §119/§120 parent/child claim diff
│   ├── pdf-generator.ts     invention record (HTML + jsPDF)
│   ├── ledger.ts            append‑only hash chain
│   └── crypto.ts            SHA‑256 + RFC 3161 client
├── shared/
│   └── schema.ts            Drizzle schema + Zod validators (single source of truth)
├── drizzle.config.ts
├── vite.config.ts · tailwind.config.ts · postcss.config.js
├── railway.toml · vercel.json
└── .env.example
```

---

## Getting Started

### Prerequisites

- **Node.js ≥ 20** (for native `fetch`, Web Crypto, ESM).
- **PostgreSQL ≥ 14** (Neon, Supabase, RDS, or local).
- An **Anthropic API key** (Claude).
- Optional: outbound HTTP access to an **RFC 3161 TSA** (DigiCert / Entrust).

### Install & run

```bash
git clone https://github.com/artificialBRIDGEllc/inventorlab.git
cd inventorlab
npm install
cp .env.example .env                # then fill in real values

npm run db:push                     # sync Drizzle schema to Postgres
npm run dev                         # tsx watch on server/index.ts, Vite dev on the client
```

The API listens on `PORT` (default `5001`). The Vite dev client proxies `/api`
through the same origin — configure `vite.config.ts` if you split ports.

### Production build

```bash
npm run build      # vite build → dist/public  AND  esbuild server → dist/server/index.js
npm run start      # node dist/server/index.js (serves dist/public in production)
```

---

## Environment Variables

Loaded from `.env` (never commit secrets). See [`.env.example`](.env.example).

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | `postgres://…` — used by Drizzle **and** `connect-pg-simple`. |
| `SESSION_SECRET` | ✅ (prod) | ≥ 32 chars; app refuses to boot in production without it. |
| `ANTHROPIC_API_KEY` | ✅ | Powers `server/ai.ts`. |
| `TSA_URL` | Recommended | e.g. `http://timestamp.digicert.com`. |
| `TSA_POLICY_OID` | Optional | TSA‑specific policy OID. |
| `NEWS_API_KEY` | Optional | Reserved for prior‑art news feeds. |
| `PORT` | Optional | Default `5001`. |
| `NODE_ENV` | Optional | `development` / `production` — toggles secure cookies + static serving. |

---

## NPM Scripts

| Script | What it does |
|---|---|
| `npm run dev` | `tsx watch server/index.ts` — dev server with hot reload. |
| `npm run build` | Vite client build **and** esbuild server bundle to `dist/`. |
| `npm run build:server` | Server‑only esbuild (`--platform=node --packages=external`). |
| `npm run start` | Run the production bundle from `dist/server/index.js`. |
| `npm run db:push` | Push Drizzle schema to the database (dev/first‑boot). |
| `npm run db:migrate` | Run generated Drizzle migrations. |
| `npm run typecheck` | `tsc --noEmit` across client + server + shared. |

---

## API Surface

All endpoints under `/api`. Auth endpoints are throttled to **20 req / 15 min**;
all other `/api` routes to **120 req / minute** (`server/app.ts`). JSON only,
`express.json({ limit: "2mb" })`.

### Auth
| Method | Path | Guard | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Create account (bcrypt, cost 12). |
| `POST` | `/api/auth/login` | — | Password login, sets session. |
| `POST` | `/api/auth/logout` | auth | Destroy session. |
| `GET`  | `/api/auth/me` | auth | Current user profile. |

### Matters & Conception
| `GET`    | `/api/matters` | auth |
| `POST`   | `/api/matters` | auth |
| `GET`    | `/api/matters/:id` | auth |
| `PATCH`  | `/api/matters/:id/parent` | auth |
| `GET`    | `/api/matters/:id/conception` | auth |
| `POST`   | `/api/matters/:id/conception` | auth |
| `POST`   | `/api/matters/:id/conception/lock` | auth |

### AI Session & Claims
| `POST`   | `/api/matters/:id/ai-session/open` | auth — requires `conception_locked` |
| `GET`    | `/api/matters/:id/claims` | auth |
| `POST`   | `/api/matters/:id/claims/draft` | auth — blocked on Bayh‑Dole matters |
| `PATCH`  | `/api/matters/:id/claims/:elementId` | auth |

### Prior Art, Disputes, Records
| `GET`    | `/api/matters/:id/prior-art` | auth |
| `POST`   | `/api/matters/:id/prior-art/search` | auth |
| `GET`    | `/api/matters/:id/disputes` | auth |
| `POST`   | `/api/matters/:id/disputes` | auth |
| `POST`   | `/api/matters/:id/invention-record` | auth |
| `POST`   | `/api/matters/:id/invention-record/generate` | auth |
| `GET`    | `/api/matters/:id/invention-record/html` | auth |

### Ledger & Priority Guard
| `GET`    | `/api/matters/:id/ledger` | auth |
| `GET`    | `/api/matters/:id/ledger/verify` | auth |
| `GET`    | `/api/matters/:id/priority-guard` | auth |

### Counsel
| `GET`    | `/api/counsel/matters/:id` | counsel/admin |
| `POST`   | `/api/counsel/matters/:id/annotate-claim` | counsel/admin |
| `POST`   | `/api/counsel/matters/:id/ready-to-file` | counsel/admin |
| `POST`   | `/api/counsel/matters/:id/flag-concern` | counsel/admin |

### Ops
| `GET`    | `/api/health` | — | Liveness, used by Railway/Vercel. |

---

## Security Posture

- **Helmet** with an explicit CSP (`server/app.ts`).
- **Session cookies**: `httpOnly`, `sameSite=lax`, `secure` in production, 8 h TTL,
  stored in Postgres via `connect-pg-simple` (auto‑created table).
- **Passwords**: bcrypt @ cost 12 (`server/auth.ts`).
- **Authorization guards**: `requireAuth`, `requireCounsel`, `requireAdmin` —
  session fields `userId`, `userRole`, `tenantId`, `email` are statically typed
  via an `express-session` module augmentation.
- **Rate limiting**: stricter on `/api/auth`, baseline on `/api`.
- **`trust proxy = 1`**: correct client IPs behind Railway/Vercel edges.
- **SPA rewrites** (Vercel) exclude `/api/*` so the SPA never shadows the API.
- **CSP note**: `'unsafe-inline'` / `'unsafe-eval'` are enabled for the Vite‑built
  bundle; tighten with nonces if you remove inline scripts.
- **Secrets**: never commit `.env`; production refuses to start without
  `SESSION_SECRET`.

### Identity (roadmap‑ready)

The `users` table carries `fido2CredentialId` / `fido2PublicKey` and an `idmeSubject`
claim, enabling WebAuthn step‑up and ID.me identity proofing without a schema
migration.

---

## Compliance Notes

- **USPTO §§ 119(e) / 120 priority** — enforced by `priority-guard.ts`; continuation
  matters with novel claim elements are flagged before filing.
- **35 U.S.C. § 112 new‑matter** — same diff also surfaces new‑matter risk on
  continuations/divisionals.
- **Bayh‑Dole (federally‑funded research)** — when `matters.hasFederalFunding` is
  true, `POST /api/matters/:id/claims/draft` returns HTTP 403 with code
  `BAYH_DOLE_RESTRICTION`; inventors must draft manually.
- **Evidence of conception** — locked conception hash + TSA token supply the
  inventor's earliest verifiable date of conception.
- **Data residency** — `tenants.awsRegion` is carried through for regional
  deployments; honor it at the infrastructure layer.

---

## Deployment

### Railway (primary target — [`railway.toml`](railway.toml))

```toml
[build]  builder = "NIXPACKS", buildCommand = "npm install && npm run build"
[deploy] startCommand = "npm run db:push && node dist/server/index.js"
         healthcheckPath = "/api/health"
```

Set `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `TSA_URL`, `NODE_ENV=production`.

### Vercel (SPA + serverless API — [`vercel.json`](vercel.json))

The entire Express app is mounted from [`api/[...path].ts`](api/) so each `/api/*`
request is handled by the same router used in the long‑running server. The SPA
is served from `dist/public` with a rewrite that excludes `/api/`. Hardening headers
(`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`) are applied at the edge.

> **Caveat (Vercel):** Postgres‑backed sessions are fine on Vercel, but cold starts
> can add latency to ledger writes. Use Railway (or any persistent Node host) if
> latency on `/api/matters/:id/claims/*` matters.

### Database migrations

- **Prototype / first boot** → `npm run db:push`.
- **Production change management** → generate with `drizzle-kit generate`, commit
  the SQL, and apply with `npm run db:migrate`.

---

## Operations & Observability

- **Liveness**: `GET /api/health` → `{ status: "healthy", service, version }`.
- **Chain integrity**: schedule `GET /api/matters/:id/ledger/verify` (or
  `verifyChainIntegrity` from `ledger.ts`) as a cron per tenant; alert on any
  `mismatch` result — it is the canonical tamper signal.
- **TSA availability**: failures in `requestRfc3161Timestamp` should degrade to a
  queued retry; do **not** silently drop ledger entries.
- **Rate‑limit 429s**: expected and safe to count as SLO exclusions; auth burst
  beyond 20/15m is an abuse signal.

---

## Development Conventions

- **TypeScript everywhere.** `typecheck` must be clean before PR.
- **Single schema source of truth.** All DB types + Zod validators live in
  [`shared/schema.ts`](shared/schema.ts); do **not** duplicate types across
  `client/` and `server/` — import from `shared/`.
- **Route handlers stay thin.** Business logic belongs in `server/*.ts` modules
  (`ledger`, `priority-guard`, `counsel`, `ai`, `pdf-generator`). Routes handle
  validation, auth, and serialization only.
- **Session types.** `express-session` `SessionData` is augmented with `userId`,
  `userRole`, `tenantId`, `email` in `server/auth.ts`; use those fields directly
  in handlers.
- **Client routing**: `wouter`. **Server state**: TanStack Query. **UI**: Radix +
  Tailwind + `class-variance-authority` + `tailwind-merge` — follow shadcn patterns
  already present in `client/src/components`.
- **Ledger discipline.** Anything that is auditable — human action, AI call,
  system transition — writes a ledger entry *in the same request*. A successful
  mutation that does not write to the ledger is a bug.
- **Never update or delete** rows in `provenance_ledger`, `conception_narratives`
  (once locked), or `invention_records`. Append new rows instead.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `SESSION_SECRET environment variable is required in production` | Set `SESSION_SECRET` (≥ 32 chars) before `NODE_ENV=production`. |
| `Conception must be locked before opening AI session` (409) | Call `/api/matters/:id/conception/lock` first. |
| `AI-assisted claim drafting is disabled for federally-funded matters` (403 `BAYH_DOLE_RESTRICTION`) | Expected — draft claims manually. |
| `Rate limit exceeded` (429) | Back off; baseline is 120/min (`/api`) and 20/15m (`/api/auth`). |
| Ledger `verify` reports a broken link | Chain tampering or a missed write — investigate the surrounding events; never "repair" by editing past rows. |
| TSA token missing on new ledger entries | `TSA_URL` unreachable; the app continues but entries lose trusted time. Restore connectivity and backfill if your process allows. |

---

© InventorLab / artificialBRIDGE LLC. All rights reserved.
