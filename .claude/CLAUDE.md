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

- Use compact scripts only: `npm run format:ci`, `lint:fix:ci`, `test:ci`, `precommit:ci`, `diff:ci`, `type-check:ci`, `build:local:ci`. Never run raw `npm run test`/`build:local`/`tsc` or paste full build/test output.
- `*:ci` output is already compact by design — don't `tail`/`head`/pipe it further; print it as-is.
- If a `*:ci` script reports `path/to/file.ts(line,col): error ...`, jump straight to `Read(file, offset: line, limit: ~15-20)` at that location. Don't grep or re-read the whole file first — the error output already is the search result.
- Each agent's verification gate is listed in its own definition — it must PASS before reporting complete.

## Git Workflow

- Do NOT add `Co-Authored-By` to commit messages.
- Subagents never run `git commit` / `git push` — committing is the user's responsibility.

## Troubleshooting

- After running `npm install`, run `npm run build:local:ci` to resolve potential build issues.

## Shared Memory

`.claude/memory.md` holds durable patterns and pitfalls. Read at session start only by: `technical-architect`, `investigator`, `implementer`, `reviewer`, `test-writer` (and `wiki-manager` as a gather source). Other agents skip it. Entries: max 2 lines per bullet, max 10 bullets per section.

## CodeGraph

If `.codegraph/` exists at the repo root, use it before Grep/Glob/Read to locate or understand code: MCP `codegraph_explore` when available, else shell `codegraph explore "<query>"` (required for subagents, which lack MCP access). No `.codegraph/` → skip it.

## Glob / Grep (file search — platform-aware)

On **Windows and remote/web** sessions, `Glob` and `Grep` are first-party tools — use them directly. On **macOS/Linux native** builds, use `mcp__glob-grep__Glob` / `mcp__glob-grep__Grep` instead (registered in `.mcp.json`). Fall back to `Bash` with `rg`/`find` only if neither is in your toolset. Both first-party and MCP variants respect `.gitignore`; the Bash fallback does not.

## LSP (code navigation — when available)

The `LSP` tool exists on the local machine (`typescript-language-server`) but NOT in remote/web sessions. **Check your toolset first: if `LSP` is not listed, skip it silently — do not attempt the call.** When available, prefer it over Grep for symbol lookups: `findReferences` for usages, `goToDefinition` for definitions, `prepareCallHierarchy` + `incomingCalls`/`outgoingCalls` for call traces, `documentSymbol` / `workspaceSymbol` to locate symbols. When absent, Grep the symbol with a word-boundary pattern (e.g. `\bgetRoomMap\b`) and check `index.ts` barrel files for re-exports.

Exploration priority: **CodeGraph** (best single-call context when indexed) → **LSP** (exact symbol lookups, when available) → **Grep/Glob** (fallback symbol search; string literals, TODOs, config keys).
