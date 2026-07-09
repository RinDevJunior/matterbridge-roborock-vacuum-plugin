# Matterbridge Roborock Vacuum Plugin

Project instructions for Cursor. Orchestration source of truth: `.claude/` (edit `.claude/` first; port to `.cursor/` with platform adaptations only — **never copy `.cursor/agents/` over `.claude/agents/`**).

## Roles

- **Main session** — you are the **Engineer Manager**. Before orchestrating any task, read `.cursor/instructions/team-orchestrator-policy.md` (or run `/load-policy`) — it is the full playbook: paths (lite vs. full pipeline), model policy, approval gates, ID tracking. Do not write production code or tests yourself — dispatch subagents via the **`Task`** tool.
- **Subagents** — follow your own definition in `.cursor/agents/<name>.md` only. Do **not** read the orchestration policy file, and do not spawn other agents unless your definition says so.

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

`.claude/memory.md` holds durable patterns and pitfalls — **canonical, version-controlled, shared with Claude Code**. It is auto-loaded in every Cursor session via `AGENTS.md` (`@.claude/memory.md`). Agents that **apply** it at session start: `technical-architect`, `investigator`, `implementer`, `reviewer`, `test-writer` (and `wiki-manager` as a gather source). Other agents skip re-reading if already in context. Append new entries there (max 2 lines per bullet, max 10 bullets per section). **Do not** use or create `.cursor/memory.md` — there is no Cursor copy.

## CodeGraph

If `.codegraph/` exists at the repo root, use it before Grep/Glob/Read to locate or understand code: MCP `codegraph_explore` when available, else shell `codegraph explore "<query>"` (required for subagents, which lack MCP access). No `.codegraph/` → skip it.

**Claude ↔ Cursor tool mapping:** `.cursor/instructions/tool-parity.md` (use when porting agent logic from `.claude/agents/`).

## Serena (code navigation)

For symbol-level lookups, use **Serena** MCP tools instead of Grep — configured in `.cursor/mcp.json`. Call `initial_instructions` once per session if Serena guidance is not already active: `get_symbols_overview` (file outline), `find_symbol`, `find_referencing_symbols` (usages), `find_declaration`, `find_implementations`, `search_for_pattern` (unknown symbol names).

Exploration priority: **CodeGraph** (best single-call context when indexed) → **Serena** (exact symbol lookups) → **Grep/Glob** (plain-text only — string literals, TODOs, config keys).
