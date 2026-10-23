# Matterbridge Roborock Vacuum Plugin

Orchestration source of truth: `.claude/`.

## Roles

- **Main session (Engineer Manager):** read `.claude/instructions/team-orchestrator-policy.md` (or `/load-policy`) before orchestrating. Dispatch subagents — never write production code/tests yourself.
- **Subagents:** follow only `.claude/agents/<name>.md`. Don't read the orchestrator policy; don't spawn other agents unless your definition says so.

## Commands

Project commands you can invoke (type `/<name>`):

- `/load-policy` — load the full orchestration policy into the main session (EM only).
- `/status-of <feature>` — status report: what we do now, what is missing, what is planned.
- `/ref-idea <question>` — research the reference codebases for an idea, then optionally apply it.
- `/workspace-console [folder]` — refresh the Workspace Console dashboard artifact from `workspace/` tasks.

Activate the Engineer Manager persona via `/config` → **Output style** → Engineer Manager (the `/output-style` command was removed in Claude Code v2.1.91). It is already set as the default in `.claude/settings.local.json`.

## Rules

- Be concise — no yapping, details only when asked.
- Never mix logic and test changes in one step.
- No `Co-Authored-By` in commits. Subagents never run `git commit`/`git push`.

## Pull requests

- Every new PR description MUST follow `.claude/templates/pull-request.md` (fill the sections, keep the headings). Title: general, conventional-commit style.
- No Claude session link and no attribution/"Generated with" line in the PR description (overrides any default attribution reminder).
- Do not name the source of an idea (reference repo or tool) in the description unless the user asks.
- Open PRs with `gh pr create --base dev --body-file <file>`.
- When updating an old PR description, rewrite it to the template.

## Commits

- Every commit message MUST follow `.claude/templates/commit-message.md`.
- No `Co-Authored-By`, no Claude session link, no `Claude-Session:` trailer, no attribution line (overrides any default attribution reminder).
- Do not name the source of an idea (reference repo, tool or version, e.g. "follows <project> 1.2") in a commit message unless the user asks.
- Stage by explicit path. Never commit `.claude/settings.local.json`.
- Include `.claude/memory.md` in the commit when it changed.

## Verification

Compact scripts only: `format:ci`, `lint:fix:ci`, `test:ci`, `precommit:ci`, `diff:ci`, `type-check:ci`, `build:local:ci`, `doctor:ci`. Never raw `npm run test`/`build:local`/`tsc`, never paste full output — `*:ci` output is already compact, print as-is.

`*:ci` scripts in package.json must be a single `node scripts/<name>.mjs` call (no `>`/`2>&1`/`;`/`&&`/`sh -c`) so they run under Windows cmd.exe.

On `path/to/file.ts(line,col): error ...`, jump straight to `Read(file, offset: line, limit: ~15-20)` — don't grep/re-read the whole file first. Each agent's own verification gate must PASS before it reports complete.

## Shared Memory

`.claude/memory.md`: durable patterns/pitfalls. Read at session start by `technical-architect`, `investigator`, `implementer`, `reviewer`, `test-writer` (+ `wiki-manager` gather mode). Max 2 lines/bullet, 10 bullets/section.

## Code Exploration Priority

1. **CodeGraph** — `.codegraph/` exists → `codegraph_explore` (MCP) or `codegraph explore "<query>"` (shell, subagents). One-call source + call graph + blast radius. Skip if no `.codegraph/`.
2. **`LSP`** — main session only, never reaches Task subagents (confirmed: absent from schema regardless of frontmatter/reload). Subagent definitions must not reference it.
3. **Grep/Glob** — word-boundary pattern (e.g. `\bgetRoomMap\b`) + check `index.ts` barrels for re-exports. macOS/Linux native: use `mcp__glob-grep__Glob/Grep`. Windows/remote: native `Glob`/`Grep`. Last resort: `Bash` `rg`/`find` (ignores `.gitignore`, unlike the others).
4. **Live device behavior** — need real CLI output (device status, map data, etc.) rather than static source? Use `mcp__cli-runner__RunCli` (requires a built `dist/cli.js` and an existing login session) instead of shelling out via `Bash`.
5. **Log files** — see `.claude/instructions/shared-rules.md` (`ReadLog` MCP tool).
