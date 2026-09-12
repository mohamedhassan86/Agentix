# Agentix

**Multi-tenant, spec-driven AI delivery platform.** Register → create an organisation → invite
members with roles → create projects, each mapped to a repository → an agent runs each SDLC phase
(specify → clarify → plan → tasks → implement) and commits its artifact through GitHub. Every human
decision happens in the repository. Every LLM call is metered to the cent.

> Built with [Spec Kit](https://github.com/github/spec-kit). This repo is both the product and the
> dogfood: every feature starts as `specs/NNN-feature/spec.md` and is governed by
> [.specify/memory/constitution.md](.specify/memory/constitution.md).

---

## What the product does

| Capability | Behaviour |
| --- | --- |
| **Tenancy** | Organisations, members with roles `owner` / `admin` / `member` / `viewer`, projects mapped to a repo. Shared schema, `org_id` on every tenant table, ORM-level global query filters. |
| **Agent pipeline** | One agent per phase. Per-phase selection of provider (Anthropic / OpenAI / Azure OpenAI / Gemini / OpenRouter / **Mock**), model, temperature, rules, and skills from a library (built-in Spec Kit skills + org-authored skills). |
| **Hooks as the bus** | `before` hooks gather read-only repo context (tree, README, constitution, specs, search, commits). `after` hooks run the **Judge** — score = mean of Completeness, Correctness, Specificity, Measurability — with a bounded feedback loop back to the producing agent. Every hook run and inter-agent event lands on the run timeline. |
| **GitHub as the UI for approval** | Issue labelled `sdlc` (or a `/specify` comment) starts a run; the bot commits `specs/NNN-feature/*.md`, opens a **draft PR**, and asks for `/approve`, `/revise <feedback>`, `/reject`, `/answer`, `/status`, `/cost`, `/retry`. Merging the PR = delivered. The console has **no approve button**; its simulator posts through the exact same HMAC-verified webhook path. |
| **Money** | Every call metered (in / out / cached tokens, latency, cost, status) attributed org → project → run → phase → agent. Org and project budgets are hard stops. Dashboards break spend down by phase, model, role, day, project; pricing table has system defaults plus per-org overrides. |
| **Secrets** | LLM keys, GitHub tokens, webhook secrets stored with AES-256-GCM envelope encryption: per-org DEK wrapped by a master KEK in a KMS. Plaintext never logged, never returned, never committed. Every read is audited. |
| **Source providers** | Everything behind a typed `ISourceProvider` contract. GitHub is the first implementation; Azure DevOps ships as a capability-declaring stub. |

## Architecture

```
┌────────────────────────── Vercel (Next.js app) ───────────────────────────────────────┐
   browser ───▶ │ UI: App Router · React · typed client · design tokens      /api/v1: thin route handlers│
   GitHub ────▶ │ webhook ingress (HMAC-verified) · tenant middleware · authz policies · OpenAPI · OTel │
   ADO ───────▶ │   ├── application    commands/queries + handlers · ports · policies                   │
                │   ├── domain         rich aggregates · value objects · domain events                  │
                │   └── infrastructure Prisma · Postgres · LLM providers · ISourceProvider (GitHub /    │
                │        AzureDevOps stub) · AES-GCM + KMS · outbox · metering · budgets                │
                └───────────────────────────────────────────┬───────────────────────────────────────────┘
                                                            │
            worker (same TypeScript codebase — Node process locally; Vercel function/cron or
            container in prod): outbox dispatch · hook/agent/Judge execution · metering · budgets
                                                            │
                                 ┌─────────────────────────────────────────────────────────────────┐
                                 ▼                                                                  ▼
                PostgreSQL (Neon / Supabase / RDS)                                                  KMS / secret manager
```

Clean architecture, DDD with a rich domain model, CQRS-style dispatch, thin route handlers — one
Next.js codebase for the UI and the API, worker for durable background work — the binding rules
are in the [constitution](.specify/memory/constitution.md) (Principles II–IV).

## Repository layout

```
.specify/          Spec Kit scaffolding: memory/constitution.md, templates/, scripts/, skills wiring
.claude/skills/    /speckit-* skills (specify, clarify, plan, tasks, implement, analyze, checklist,
                   converge, taskstoissues) + /speckit-git-* (branch, commit, validate)
specs/             one directory per feature: spec.md plan.md research.md data-model.md contracts/ tasks.md
docs/              SPEC-DRIVEN-PLAYBOOK.md (how we build), governance/exceptions.md
Public/Desgin/     index.html — the canonical UI design guideline (path intentionally as-is)
src/domain         entities · value objects · domain events · errors (pure TypeScript)
src/application    commands/queries + handlers · ports · DTOs · policies
src/infrastructure Prisma · Postgres · LLM providers · ISourceProvider · crypto · outbox · telemetry
src/app            Next.js App Router: pages · route handlers · middleware · server actions
src/worker         hook/agent execution host · outbox dispatch
tests/             unit + integration (Vitest + Testcontainers)
```

## Prerequisites

- Node 22 LTS and npm; Next.js 16+ is scaffolded per project with `create-next-app` (no global CLI)
- Prisma (per project, via `npx prisma`) for the ORM, client, and migrations
- Docker Desktop (Testcontainers for integration tests) *or* a Neon/Supabase branch database
- Python 3.11+ and `uv` for the Spec Kit CLI: `uv tool install -q --from git+https://github.com/github/spec-kit.git specify-cli`
- A KMS/secret manager for the KEK (local dev falls back to a file-backed protector with a fake key)
- `gh` CLI authenticated, and a test GitHub repo with webhook rights (optional until spec `006`)

## Local development

```bash
# 1. database — pick one
docker run -d --name agentix-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=agentix postgres:16

# 2. app (UI + /api/v1 + webhook ingress, runs on http://localhost:3000)
npm install && npx prisma migrate deploy && npm run dev

# 3. worker (hooks, agent runs, metering, budget enforcement)
npm run worker
```

Verification gates (all must be green before a phase is called complete):

```bash
npm run lint && npm test && npm run build
```

## How we build features (Spec Kit)

```bash
/speckit-constitution      # amend governance (rare) — .specify/memory/constitution.md
/speckit-specify <intent>  # creates branch NNN-name + specs/NNN-name/spec.md
/speckit-clarify           # optional: resolve ambiguities, answers appended to spec.md
/speckit-plan              # plan.md, research.md, data-model.md, contracts/, quickstart.md
/speckit-tasks             # tasks.md, phases of ≤10 tasks with [P] parallelisable markers
/speckit-analyze           # optional: spec/plan/tasks consistency report (run after tasks)
/speckit-implement         # execute one phase at a time, build+test gate between phases
/speckit-converge          # reconcile what is missing after implementation
/speckit-taskstoissues     # optional: publish tasks as GitHub issues
```

`/speckit-clarify`, `/speckit-analyze` and `/speckit-checklist` are **optional enhancement** commands
(upstream Spec Kit classifies them that way): run them where the spec carries state machines, money,
authorization or UI deviation; skip and note the reason otherwise.

Full guidance, spec sequence, and quality gates: [docs/SPEC-DRIVEN-PLAYBOOK.md](docs/SPEC-DRIVEN-PLAYBOOK.md).
Product behaviour awaiting its spec (approval commands, role matrix, webhook protocol values):
[docs/business-rules/github-approval-surface.md](docs/business-rules/github-approval-surface.md).

## Roadmap (planned specs)

| # | Spec | Why this order |
| --- | --- | --- |
| 001 | Solution skeleton, host wiring, design-token layer | Nothing else compiles without the layer boundaries |
| 002 | Tenancy & identity: register → org → roles, `org_id` + global query filters | Isolation must precede any tenant data |
| 003 | Secret vault: AES-256-GCM envelope + KMS KEK, provider keys, audit log | Everything downstream reads keys |
| 004 | Projects ↔ repository mapping, `ISourceProvider` + Simulated repository | Provider contract before any GitHub code |
| 005 | Agent profiles: per-phase provider/model/temperature/rules + skill library | Pipeline needs selectable agents |
| 006 | Metering ledger + pricing table + org overrides + budget hard stops | Cost is enforced where calls happen |
| 007 | Run engine: phase state machine, Mock agent, run timeline | Whole pipeline on mocks |
| 008 | Hooks: before-hooks (read-only repo tools) + Judge after-hook + bounded loop | Quality loop on mocks |
| 009 | Webhook ingress: per-connection URL, HMAC-SHA256, replay protection, idempotency | Real events start here |
| 010 | GitHub provider: commits, draft PRs, commands `/approve` `/revise` `/reject` `/answer` `/status` `/cost` `/retry` | Approval surface |
| 011 | Console: dashboard, runs, usage dashboards, simulator reusing the webhook path | Operator experience |
| 012 | Azure DevOps typed stub + provider capability docs | Prove the contract generalises |

## Security posture (summary)

Envelope encryption with per-org DEKs under a KMS-held KEK; plaintext only transiently in memory;
masked metadata on every read path; webhook signatures compared in constant time inside a 300 s
replay window; cross-tenant access fails closed; approvals reachable only through the signed
webhook ingress. Details: constitution Principles V–VII.

## Governance

The [constitution](.specify/memory/constitution.md) is the supreme engineering authority for this
repo: 11 principles, global constraints, delivery workflow, and governance. Amendments go through
`/speckit-constitution` with a semver bump. Exceptions require an owner, an expiry date, and an
entry in [docs/governance/exceptions.md](docs/governance/exceptions.md).
