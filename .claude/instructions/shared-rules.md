# Shared Rules

Read by every subagent. Keep this file thin — additions here cost every subagent a read.

- Use `*:ci` scripts (`format:ci`, `lint:fix:ci`, `test:ci`, `type-check:ci`, `build:local:ci`) instead of raw commands. Their output is already compact — don't `tail`/`head`/pipe it further.
- On `file(line,col): error` output from a `*:ci` script or `tsc`, `Read(file, offset: line, limit: ~15-20)` directly — skip grep/whole-file reads.
- For mechanical find-replace across a file, use `Edit` (with `replace_all: true` when the same change repeats), not `sed`/shell text munging.
- For pattern/file search inside the project, use the `Grep`/`Glob` tools, not `Bash grep`/`find`. Reserve Bash for running commands (npm, git) or genuinely cross-repo searches Grep/Glob can't reach.
- For log files, never `Read`/`Grep` directly (some run 100k+ lines) — use the `ReadLog` MCP tool (`mcp__read-log__ReadLog`, params: `filePath`, `keyword`, optional `maxLines`) instead, which streams and returns only matching lines, capped. Only use it when the user has provided the log file path AND confirmed the keyword for that specific request — never on your own initiative, and never for source code.
- Live plugin runs (`scripts/watch-log.sh`, or anything that starts `npm start`/matterbridge) require the user's explicit approval for that specific run before executing — being dispatched is not approval. Ask via `AskUserQuestion` first if not already confirmed.
- Every `AskUserQuestion` option must set `preview` with concrete context for that choice (code snippet, before/after, file list) — never leave the user picking from `label`/`description` alone.
