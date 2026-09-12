# Agentix — Agent Context

Read this before doing anything in this repository.

## The ritual (mandatory, in order, every time)

1. **Read the constitution**: `.specify/memory/constitution.md`. It is the supreme engineering
   authority; where any other guidance conflicts, it wins.
2. **Read prior specs**: list `specs/*/spec.md` and `specs/*/plan.md` (plus `data-model.md`,
   `contracts/`) for every delivered feature, before writing a new spec or plan.
3. **Re-read the current spec's directory** at the start of every phase (`spec.md`, `plan.md`,
   `tasks.md`) — do not rely on chat history or memory of an earlier run.
4. For UI work, also read the design guideline: `Public/Desgin/index.html`.

Agents that skip step 1 or 2 produce the failure modes catalogued in
`docs/SPEC-DRIVEN-PLAYBOOK.md` §1. Do not skip them.

## Hard rules

- One spec = one branch (`NNN-short-name`, created by the `before_specify` hook) = one PR.
- Implementation runs **one phase at a time, ≤ 10 tasks**. A phase is not complete until
  `dotnet build`, `dotnet test`, `dotnet format --verify-no-changes` and (for client work)
  `npm run lint`, `npm test`, `npm run build` are green. Red tree → next phase does not start.
- Commit each phase's artifacts separately from code (`docs(NNN): …`, `feat(NNN): …`).
- No code without a spec; no spec with implementation detail in it.
- Never introduce a dependency without a license check (permissive OSS only) and, if it is
  architecture-relevant, a `plan.md` §Complexity Tracking entry.
- Never log, return, or commit a secret value. Never approve a run outside the webhook ingress.
- Do not open, approve, or merge your own PR.

## Where things live

| Need | Path |
| --- | --- |
| Governance / principles | `.specify/memory/constitution.md` |
| Workflow templates | `.specify/templates/` (resolve via `.specify/scripts/bash/resolve-template.sh`) |
| Feature artifacts | `specs/NNN-feature/` |
| How to build & Spec Kit advice | `docs/SPEC-DRIVEN-PLAYBOOK.md` |
| Exception register | `docs/governance/exceptions.md` |
| UI design guideline | `Public/Desgin/index.html` |
| Layer layout | `src/Agentix.{Domain,Application,Infrastructure,Api,Worker}`, `client/agentix-web`, `tests/` |

## Commands

`/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` →
`/speckit-implement` (per phase) → `/speckit-converge`. Governance changes: `/speckit-constitution`.
