# Matterbridge Roborock Vacuum Plugin

Orchestration source of truth: `.claude/`.

## Roles

- **Main session (Engineer Manager):** read `.claude/instructions/team-orchestrator-policy.md` (or `/load-policy`) before orchestrating. Dispatch subagents — never write production code/tests yourself.
- **Subagents:** follow only `.claude/agents/<name>.md`. Don't read the orchestrator policy; don't spawn other agents unless your definition says so.

## Rules

- Be concise — no yapping, details only when asked.
- Never mix logic and test changes in one step.
- No `Co-Authored-By` in commits. Subagents never run `git commit`/`git push`.

## Verification

Compact scripts only: `format:ci`, `lint:fix:ci`, `test:ci`, `precommit:ci`, `diff:ci`, `type-check:ci`, `build:local:ci`. Never raw `npm run test`/`build:local`/`tsc`, never paste full output — `*:ci` output is already compact, print as-is.

On `path/to/file.ts(line,col): error ...`, jump straight to `Read(file, offset: line, limit: ~15-20)` — don't grep/re-read the whole file first. Each agent's own verification gate must PASS before it reports complete.

## Shared Memory

`.claude/memory.md`: durable patterns/pitfalls. Read at session start by `technical-architect`, `investigator`, `implementer`, `reviewer`, `test-writer` (+ `wiki-manager` gather mode). Max 2 lines/bullet, 10 bullets/section.

## Code Exploration Priority

1. **CodeGraph** — `.codegraph/` exists → `codegraph_explore` (MCP) or `codegraph explore "<query>"` (shell, subagents). One-call source + call graph + blast radius. Skip if no `.codegraph/`.
2. **Serena** (`mcp__serena__*`, in `.mcp.json`) — exact symbol lookups (`find_symbol`, `find_referencing_symbols`, `find_implementations`, `get_symbols_overview`), live diagnostics (`get_diagnostics_for_file`), symbol-safe edits (`replace_symbol_body`, `rename_symbol`, `insert_before/after_symbol` — prefer over raw `Edit` for whole-symbol changes).
3. **`LSP`** — main session only, never reaches Task subagents (confirmed: absent from schema regardless of frontmatter/reload). Skip silently if not in your toolset.
4. **Grep/Glob** — word-boundary pattern (e.g. `\bgetRoomMap\b`) + check `index.ts` barrels for re-exports. macOS/Linux native: use `mcp__glob-grep__Glob/Grep`. Windows/remote: native `Glob`/`Grep`. Last resort: `Bash` `rg`/`find` (ignores `.gitignore`, unlike the others).
5. **Live device behavior** — need real CLI output (device status, map data, etc.) rather than static source? Use `mcp__cli-runner__RunCli` (requires a built `dist/cli.js` and an existing login session) instead of shelling out via `Bash`.
6. **Log files** — see `.claude/instructions/shared-rules.md` (`ReadLog` MCP tool).
