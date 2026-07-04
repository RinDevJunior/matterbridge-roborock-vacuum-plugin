# Reference Workspaces (allowlist)

External codebases agents may consult, **read-only**. Investigator and technical-architect may ONLY read paths listed here — anything not listed is out of bounds.

**Priority = list order.** Agents consult top-first and stop early once the question is answered.

| Name                                | Path                   | Notes                                                       |
| ----------------------------------- | ---------------------- | ----------------------------------------------------------- |
| python-roborock                     | `<fill in local path>` | Python reference lib — richest device/protocol coverage     |
| ioBroker.roborock                   | `<fill in local path>` | Field-tested JS integration — good for real-device behavior |
| roborock-gitlab (@functor/roborock) | `<fill in local path>` | Reference-quality TS lib — map parsing, B01 proto schemas   |

## Rules

- Read-only — never modify, format, or stage files in these paths.
- LSP and CodeGraph do NOT work here (they index this repo only) — use Grep/Glob/Read.
- Cite findings as `<workspace-name>/path/to/file:line` in answers.
- To add a workspace: append a row here (with a one-line note on what it is good for) — no other change needed.
