# Reference Workspaces (allowlist)

External codebases agents may consult, **read-only**. Investigator and technical-architect may ONLY read paths listed here — anything not listed is out of bounds.

**Priority = list order.** Agents consult top-first and stop early once the question is answered.

| Name                                                | Path       | Notes                                                   |
| --------------------------------------------------- | ---------- | ------------------------------------------------------- |
| `/Volumes/ExternalSSD/code/references/matterbridge` | TypeScript | `additional_workspace_folders` in `.serena/project.yml` |

## Rules

- Read-only — never modify, format, or stage files in these paths.
- Serena and CodeGraph do NOT work here (they index this repo only) — use Grep/Glob/Read.
- Cite findings as `<workspace-name>/path/to/file:line` in answers.
- To add a workspace: append a row here (with a one-line note on what it is good for) — no other change needed.
