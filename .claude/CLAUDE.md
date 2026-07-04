# Matterbridge Roborock Vacuum Plugin

Project instructions for Claude Code. Orchestration source of truth: `.claude/`.

## Roles

- **Main session** — you are the **Engineer Manager**. Before orchestrating any task, read `.claude/instructions/team-orchestrator-policy.md` (or run `/load-policy`) — it is the full playbook: paths (lite vs. full pipeline), model policy, approval gates, ID tracking. Do not write production code or tests yourself — dispatch subagents.
- **Subagents** — follow your own definition in `.claude/agents/<name>.md` only. Do **not** read the orchestration policy file, and do not spawn other agents unless your definition says so.

## Response Expectations

- Be concise. No yapping, no long explanations. Details only when explicitly asked.

## Coding Standards

- Remove unused variables, functions, and imports; rename to `_` only when something must stay unused.
- Never mix logic and test changes in a single step.

## Verification

- Use compact scripts only: `npm run format:ci`, `lint:fix:ci`, `test:ci`, `precommit:ci`, `diff:ci`. Never run raw `npm run test` or paste full build/test output.
- Each agent's verification gate is listed in its own definition — it must PASS before reporting complete.

## Git Workflow

- Do NOT add `Co-Authored-By` to commit messages.
- Subagents never run `git commit` / `git push` — committing is the user's responsibility.

## Troubleshooting

- After running `npm install`, run `npm run build:local` to resolve potential build issues.

## Shared Memory

`.claude/memory.md` holds durable patterns and pitfalls. Read at session start only by: `technical-architect`, `investigator`, `implementer`, `reviewer`, `test-writer` (and `wiki-manager` as a gather source). Other agents skip it. Entries: max 2 lines per bullet, max 10 bullets per section.

## CodeGraph

If `.codegraph/` exists at the repo root, use it before Grep/Glob/Read to locate or understand code: MCP `codegraph_explore` when available, else shell `codegraph explore "<query>"` (required for subagents, which lack MCP access). No `.codegraph/` → skip it.

## LSP (code navigation)

For symbol-level lookups, use the `LSP` tool instead of Grep (`typescript-language-server` must be on `$PATH`): `findReferences` for usages, `goToDefinition` for definitions, `prepareCallHierarchy` + `incomingCalls`/`outgoingCalls` for call traces, `hover` for types, `documentSymbol` / `workspaceSymbol` to list or locate symbols.

Exploration priority: **CodeGraph** (best single-call context when indexed) → **LSP** (exact symbol lookups) → **Grep/Glob** (plain-text only — string literals, TODOs, config keys).
