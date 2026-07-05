# Shared Rules

Read by every subagent. Keep this file thin — additions here cost every subagent a read.

- Use `*:ci` scripts (`format:ci`, `lint:fix:ci`, `test:ci`, `type-check:ci`, `build:local:ci`) instead of raw commands. Their output is already compact — don't `tail`/`head`/pipe it further.
- On `file(line,col): error` output from a `*:ci` script or `tsc`, `Read(file, offset: line, limit: ~15-20)` directly — skip grep/whole-file reads.
- For mechanical find-replace across a file, use `Edit` (with `replace_all: true` when the same change repeats), not `sed`/shell text munging.
- For pattern/file search inside the project, use the `Grep`/`Glob` tools, not `Bash grep`/`find`. Reserve Bash for running commands (npm, git) or genuinely cross-repo searches Grep/Glob can't reach.
