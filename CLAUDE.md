@AGENTS.md

# Claude Code notes

Claude is the coding agent used for planning and implementation on this repo
(`/speckit-plan`, `/speckit-implement`). The Spec Kit command prompts are installed as Claude
skills under `.claude/skills/speckit-*`. The project constitution at
`.specify/memory/constitution.md` overrides any convention or preference stated here.

Do not reuse developer credentials, `~/.claude` config, or local model API keys as the application's
runtime agent configuration — the app's own provider keys live in the tenant secret vault.
