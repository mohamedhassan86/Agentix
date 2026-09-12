# Spec-Driven Delivery Playbook

How Agentix gets built, and how to use Spec Kit so the output holds up. The binding rules are in
[`.specify/memory/constitution.md`](../.specify/memory/constitution.md); this document is the
operating manual: **what to do, in what order, and what to write into each command**.

---

## 1. Why the first attempt produced poor output

Every item below is a known failure mode of Spec Kit usage on a large product brief, and each has a
mechanical fix. The fixes are already wired into this repo's constitution.

| # | What goes wrong | Root cause | Fix adopted here |
| --- | --- | --- | --- |
| 1 | The spec is a re-telling of the idea, not a specification | One prompt asked to "spec the whole app" → the model compresses a 12-subsystem product into a wish list | **One spec = one shippable vertical slice** (Principle I). The 12-slice sequence in §3. |
| 2 | `plan.md` invents architecture the brief never asked for, and later specs contradict each other | The constitution was advisory prose, not re-read per phase | Mandatory pre-spec ritual: re-read constitution + prior `spec.md`/`plan.md`/`data-model.md`, then fill **Constitution Check** (Principle I) |
| 3 | Controllers fill up with logic; "clean architecture" becomes a folder diagram | Nothing enforces layer direction or thin actions | Principle II (dependency rule) + Principle IV (action body = one dispatch line) — both reviewable in seconds |
| 4 | Anemic `Entity` classes + `Service` layers; invariants duplicated per endpoint | `plan.md` was allowed to skip the domain model | Principle III: behaviour-named aggregate methods, closed state machines, value objects; `data-model.md` is a required artifact |
| 5 | Multi-tenancy added at the end as "filter everything" | Tenancy treated as a feature instead of a substrate | Spec `002` lands before any tenant data exists; cross-tenant test required per endpoint (Principle V) |
| 6 | Secrets end up in a `SecretDto`, a log line, or an error payload | Encryption was described, not constrained | Principle VI with a *zero-redaction test* requirement, AAD binding, and no-plaintext-in-response gates |
| 7 | Approvals implemented in the console "for convenience" | The invariant "GitHub is the approval surface" wasn't testable | Principle VII: no approval endpoint at all; simulator posts to the same signed ingress (verifiable by a test that the route doesn't exist) |
| 8 | Agents "just work" in the demo, metering and budgets bolted on later | Cost enforcement was a reporting feature | Principle IX: budgets enforced in the dispatch path; `LlmCallRecord` is part of the agent port, not a callback |
| 9 | `tasks.md` → 120 tasks → agent burns context, half-implements, tests never green | Single mega-implement run | `/speckit-implement` runs **one phase at a time, ≤ 10 tasks**, with the build+test gate as the phase exit criterion (Principle I, X) |
| 10 | Everything looks finished; `dotnet test` doesn't run | "Done" was defined by the agent | Principle X is the only definition of done; a red tree blocks the next phase |
| 11 | Real GitHub + real LLM keys used from day one → flaky, costly, untestable | Integration-first ordering | **Mock-first**: engine complete on Mock agent + Simulated repository (specs 004–008) before spec 009/010 touch GitHub |
| 12 | UI drifts from `Public/Desgin/index.html`, one-off colours, new component names | Design reference treated as inspiration | Principle XI: token names/values copied verbatim, component inventory honored, a11y gaps in the mock closed explicitly, deviations need a **Design Delta** note |
| 13 | The constitution grows into a product spec, then contradicts it after the first UX change | No scope boundary between governance and functional requirements | Principle I scope rule: governance keeps the invariant ("no approval path but the verified ingress"), product detail moves to `specs/` via `docs/business-rules/`. Applied in v1.1.0 |

If output quality ever drops again, work the table top-to-bottom — it is diagnostic in that order.

---

## 2. Ground rules that make Spec Kit work here

1. **Never skip straight to `/speckit-implement`.** The pipeline's value is the artifacts; skipping
   the writing step is what makes agent output shallow.
2. **Write intent, not implementation, into `/speckit-specify`.** User-visible behaviour,
   measurable outcomes, edge cases, and non-goals. Library names, tables, and class shapes belong in
   `/speckit-plan` — a spec that prescribes them locks the plan into a bad shape.
3. **Use `/speckit-clarify` on every spec with a state machine, a money rule, or an auth boundary.**
   It is 5–8 questions and takes minutes; it is the cheapest place to catch the tenancy and budget
   semantics that later cost a rewrite.
4. **One spec = one branch = one PR.** Created automatically by the mandatory `before_specify` hook
   (`/speckit-git-feature`, branch `NNN-short-name`). Nothing for that feature is committed outside it.
5. **Commit per phase, artifacts separated from code.** `docs(001): spec` → `docs(001): plan` →
   `docs(001): tasks` → `feat(001): implement phase 1` … so a reviewer (and the bot's own PR
   commits) can see exactly what each phase produced.
6. **Keep `tasks.md` execution scoped.** `/speckit-implement p2` (or "implement phase 2 only") per
   run. Between phases: `dotnet build`, `dotnet test`, `npm test`, `npm run lint` green, no
   suppressed warnings.
7. **`/speckit-analyze` is optional — use it after `/speckit-tasks` when drift risk is real** (state
   machines, metering maths, multi-artifact contracts). It catches the spec ↔ plan ↔ tasks drift
   agents produce when they improvise mid-run. Skip it on small mechanical slices, note the skip in
   `plan.md`, and never let an optional step block a phase gate.
8. **`/speckit-converge` at the end of a spec** — it turns "what we ran out of room for" into
   explicit tasks instead of silent gaps or a new unnumbered spec.
9. **The agent must re-read, not remember.** At the start of each command, the constitution and the
   relevant prior specs are read from disk in that run. Prior chat context is a hint, never a
   source of truth (AGENTS.md enforces this).
10. **Scope creep becomes a new spec.** New ideas found while implementing go to `clarify` notes or
    `specs/NNN+1`, not extra tasks in the current list.
11. **Every principle needs a checkable consequence.** If a plan can't say which test, review
    checklist line, or lint rule enforces it, the plan is rejected at the Constitution Check gate.
12. **Governance stays governance.** If a proposed constitution clause describes a screen, a command
    string, a role matrix, or a customer-visible threshold, it belongs in `spec.md`. Keep durable
    "never do X" rules in the constitution and park the detail in `docs/business-rules/` until its
    spec exists (the v1.1.0 amendment moved the webhook/approval protocol out for exactly this reason).

---

## 3. Build order: the twelve specs

Each row is one spec directory, one branch, one PR. Ordering is by dependency, and the first eight
never require a real GitHub token or a paid LLM call.

| Spec | Scope (in) | Explicitly out | Exit proof |
| --- | --- | --- | --- |
| **001** `solution-foundation` | .NET 10 solution (Domain/Application/Infrastructure/Api/Worker), xUnit test projects, Serilog + OpenTelemetry wiring, `ProblemDetails`, health endpoints, EF + Npgsql + migration pipeline, Next.js 16 (App Router) workspace + `@agentix/tokens` from the mock, CI with the gate commands | Business entities, auth, tenancy | `dotnet build`/`dotnet test` green on a hello-world vertical (health + `GET /api/v1/ping` + Next.js page rendering tokens) |
| **002** `tenancy-identity` | Register → organisation → members + roles (owner/admin/member/viewer), invitations, `org_id` on every tenant table + convention-driven global query filters, JWT access + refresh cookie, authorization policies, tenant middleware fail-closed | Projects, agents, billing | Cross-tenant test suite: every endpoint returns 403/404 for a foreign tenant; permission matrix test |
| **003** `secret-vault` | Envelope crypto (AES-256-GCM, per-org DEK, KEK via `ISecretProtector` + KMS, file-backed dev protector), secret CRUD with masked reads, versioning, rotation, revocation, access audit log, zero-redaction tests | Real provider calls | Tamper/replay/round-trip tests; no plaintext in logs/response assertions |
| **004** `projects-and-source-contract` | Project ↔ repository mapping, `ISourceProvider` port + capability model, **Simulated repository** provider (in-memory/DB-backed git fake: branches, commits, trees, blobs, search, PR/comment state), Azure DevOps typed stub skeleton | GitHub HTTP integration | Pipeline can commit/read against the Simulated repo; capability-driven 501 path tested |
| **005** `agent-profiles-and-skills` | Per-phase agent profile (provider, model, temperature, rules), skill library (built-in Spec Kit skills + org skills), profile snapshot onto a run, role-aware validation | Live provider calls | Snapshot immutability test; profile resolution tests; skills CRUD with role matrix |
| **006** `metering-and-budgets` | `LlmCallRecord` ledger (in/out/cached tokens, latency, cost, status), pricing table with system defaults + per-org overrides and immutable price versions, org/project budgets, hard-stop gate in the dispatch path, 80 % warning, `/cost` data source | Dashboards, invoices | Deterministic cost maths (property tests), budget-block test using Mock pricing |
| **007** `run-engine-mock-pipeline` | Run aggregate + phase state machine, orchestrator, **Mock agent** (deterministic outputs per phase), timeline event store (seq-ordered), retry/`/status` semantics, idempotent job execution | Judge, webhooks, GitHub | Full run specify → implement on Mock + Simulated repo, with committed artifacts in the simulated branch; timeline + ledger asserted in one integration test |
| **008** `hooks-and-judge` | Before-hooks (read-only tools: tree, README, constitution, specs, search, commits), after-hook Judge (four dimensions + mean, threshold, bounded loop ≤ 3), hook-run records on timeline, feedback context into the producer | Real LLM scoring | Loop terminates on threshold / attempt limit / budget, each attempt on timeline |
| **009** `webhook-ingress` | Per-connection webhook URL (high-entropy), HMAC-SHA256 verify, 300 s replay window, delivery-id dedupe, raw-body capture, outbox, **console simulator posts to this same path**, `sdlc` label + `/specify` trigger | GitHub API writes | Signature fixture tests; double-delivery no-op; simulator ≡ real-event parity test |
| **010** `github-provider` | Real GitHub: branch/commit via API, draft PR open/ready, PR comment commands `/approve` `/revise` `/reject` `/answer` `/status` `/cost` `/retry`, delivery/merge → `Delivered`, retries + rate-limit handling | Azure DevOps | Replay-based tests against recorded payloads; end-to-end on a scratch repo |
| **011** `console` | Dashboard, Runs + timeline, Usage dashboards (phase/model/role/day/project), Members & roles, Connections & vault, Agents & skills, Simulator, Settings + budgets, Danger zone — all per `Public/Desgin/index.html` | New visual language | Playwright golden path; a11y + state coverage (empty/loading/error/no-permission/budget-blocked) |
| **012** `azure-devops-stub-hardening` | Complete the typed stub to contract parity where cheap, capability matrix docs, provider conformance test suite shared by GitHub | ADO webhook completeness | Same conformance suite green for both providers (with `NotSupported` assertions) |

**Minimum viable demo** = specs 001–009 (whole pipeline, hooks, Judge, metering, budgets, and the
webhook-shaped approval path, all runnable with no key and no spend). Specs 010–012 are the
"wire the real world" increment — which is exactly the ordering the brief asks for.

---

## 4. Per-command playbook

### `/speckit-constitution` — done (v1.0.0)
Re-run only to amend. Bring an explicit argument: *which principle, what changes, what must be
re-verified in delivered specs*. Semver rules live in the constitution's Governance section.

### `/speckit-specify`
Input quality decides spec quality. Use this shape:

```text
/speckit-specify 002 tenancy-identity: Organisations, members with roles, tenant-scoped access.
Users: SaaS owner, admin, member, viewer. Flow: register → create org → invite by email with role →
accept → switch org. Roles: owner (billing, delete org, all rights), admin (members, keys,
projects, budgets), member (projects, runs, approve/revise via GitHub), viewer (read-only).
Measurable: cross-tenant reads 0 leakage; org switch < 200 ms perceived; invitation expires 7d.
Non-goals: SSO, SAML, projects, billing plans.
```

Rules: 3–5 user stories max, each independently testable; functional requirements numbered and
testable ("FR-012: viewer MUST receive 403 on member invitation"); explicit **Out of Scope**;
acceptance scenarios with concrete numbers; no tech names (no "EF Core filter", no "JWT").
Then read the drafted spec once and cut anything that names a library — that is the fastest single
quality win available.

### `/speckit-clarify`
Run it whenever a spec has state, money, or an authorization boundary. Answer its questions in
`spec.md` (the command appends a Clarifications section) rather than only in chat — later phases
read files, not history.

### `/speckit-plan`
Bring the constraints that the model would otherwise guess:
- layer layout + dependency rule (Principle II) and the one-line-action rule (Principle IV);
- tenancy approach (Principle V) and the exact crypto envelope (Principle VI);
- the `ISourceProvider` capability list (Principle VIII);
- design fidelity + a11y obligations (Principle XI);
- **Mock-first**: infrastructure must not require a real token in this spec.

Required artifacts: `plan.md` (with **Constitution Check** and, if needed, **Complexity Tracking**),
`research.md` (decisions + alternatives rejected), `data-model.md` (aggregates, invariants, state
machines, indexes with `org_id` leading), `contracts/openapi.yaml` + `contracts/events.md`,
`quickstart.md` (the exact commands a reviewer runs). Prefer filling `plan.md`'s structure by hand
where the brief already dictates an answer — the more you pre-fill, the less the model invents.

### `/speckit-tasks`
Ask for phases of ≤ 10 tasks, `[P]` where parallelisable, each task naming its file(s) and its test.
Order the phases: contracts/DTOs → domain + tests → persistence/migrations → handlers → endpoints →
client wiring → integration tests → docs. Enforce: **no task may reference a file outside the spec's
scope**; add a "constitution compliance" phase (Principle Governance).

### `/speckit-analyze` + `/speckit-checklist` (both optional)

Upstream Spec Kit classifies `clarify`, `analyze` and `checklist` as *enhancement* commands, and this
repo treats them that way: run them on the specs that carry risk, skip and note the reason otherwise.
`/speckit-analyze` after tasks — fix drift in the artifacts, not in code. Use
`/speckit-checklist` for the high-risk axes only: tenant isolation, secret handling, webhook
signature/replay, budget enforcement, judge loop termination. A 10-item focused checklist beats a
40-item generic one, because a generic one is skimmed.

### `/speckit-implement`
One phase per run. Between phases:

```bash
dotnet build && dotnet test && dotnet format --verify-no-changes
cd client/agentix-web && npm run lint && npm test && npm run build
```

If a phase ends red, the run stops there: fix, commit, then continue. Do not let the agent "finish
the remaining tasks and fix tests at the end" — that is how the poor-output loop restarts. When a
task reveals a plan error, first amend `plan.md` + `tasks.md`, then code.

### `/speckit-converge`
Run once the spec's phases end. It reads the repo against `spec.md` and appends the remaining work
as tasks; anything beyond this spec's scope becomes a new spec, not a task.

---

## 5. Definition of Ready / Done

**A spec may enter `/speckit-plan` when:** every FR is testable; Out of Scope is explicit; the
Constitution Check has no unexamined line; each user story has at least one acceptance scenario with
a number in it; and a Mock/simulated path exists for everything external.

**A phase is done when:** code compiles, tests green, analyzers clean, the phase's tasks are checked
off in `tasks.md`, and the commit contains only that phase's work.

**A spec is done when:** the PR merges, `quickstart.md` was executed against a running stack by
someone other than the author, the constitution's PR review checklist is filled in (one line per
principle it touches), migrations are reviewed, and any exception is logged in
`docs/governance/exceptions.md` with an expiry.

---

## 6. Anti-patterns (reject on sight)

- Spec text containing "we will use X library" or "a `Controllers` folder".
- A `tasks.md` where one task spans three subsystems.
- Handlers that mutate entities directly instead of calling aggregate behaviour.
- Controllers with `if`, `try`, or a `DbContext` field.
- `IgnoreQueryFilters()` in Application/Api; a tenant id accepted from a query string.
- Secrets readable through any GET; a DTO with a `KeyValue` field; keys in logs/timeline.
- An `/api/v1/runs/{id}/approve` endpoint (Principle VII forbids approval outside webhook ingress).
- Costing done "in the client" or reconstructed by summing other tables instead of the ledger.
- Judge loop with no attempt ceiling or no timeline record for a failed attempt.
- Real GitHub tokens in CI for a spec that could have used the Simulated repository.
- Screens styled with literal hex, or components invented outside the mock's inventory.
- "Tests pass locally" as a completion claim, with no command output.

---

## 7. This repo's Spec Kit setup

- Installed with `specify init --here --integration claude --script sh` (spec-kit `1.0.7.dev0`), so
  commands are Claude skills: `/speckit-specify`, `/speckit-clarify`, `/speckit-plan`,
  `/speckit-tasks`, `/speckit-implement`, `/speckit-analyze`, `/speckit-checklist`,
  `/speckit-converge`, `/speckit-taskstoissues`, `/speckit-constitution`.
- The `git` extension is installed from source (`specify extension add --dev`), which registers
  `/speckit-git-feature`, `/speckit-git-commit`, `/speckit-git-validate`, `/speckit-git-remote`,
  `/speckit-git-initialize`, and the hooks in `.specify/extensions.yml`:
  - `before_specify` → **mandatory** feature-branch creation (the "code branch per spec first" rule);
  - `after_*` → optional auto-commit, so each phase can land its `specs/NNN-*/` artifacts alone.
- Templates are the real upstream ones in `.specify/templates/`; resolve them through
  `.specify/scripts/bash/resolve-template.sh` and never fork a template into a new format.
- To refresh after a spec-kit release: re-run `specify init --here --force --integration claude
  --script sh` (and re-add the git extension with `--dev` / `--force`).
- Agents that prefer dot-form slash commands (`.claude/commands/speckit.specify.md`) can be added
  alongside the skills; the skill content is the same upstream prompt.
- Model choice for building: Claude for planning and implementation, per the constitution's
  Delivery Workflow section. Never reuse developer credentials for the app's own runtime agent
  profiles.

---

## 8. Judging whether the process is working

Track these per spec (they are also the product's own metrics, which is the point of dogfooding):

- **Revision rounds per phase** — Judge mean after 1 attempt ≥ 85 without a second round means the
  spec was clear; chronic second rounds mean the spec is vague.
- **Clarification count** — 0–2 per spec is healthy; 8+ means specify under-specified the problem.
- **Phase gate failures** — a phase ending red is a plan/tasks defect, not a coding defect.
- **Spec churn after implement starts** — edits to `spec.md` after `/speckit-implement` began should
  be rare; each one is a plan-quality signal.
- **Task→file drift** — if implemented files don't match `tasks.md` file lists, task generation is
  too coarse.
- **Tenancy/secret findings in review** — anything here is a Principle V/VI violation: stop and fix
  the mechanism (test + convention), not just the instance.
