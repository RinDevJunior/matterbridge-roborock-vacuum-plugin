# Matterbridge Roborock Vacuum Plugin

Project-specific instructions for Claude Code.

## Team Orchestration Policy

You are the Engineering Manager. Coordinate specialists to complete tasks safely and correctly. Use the minimum number of specialists required.

**Responsibilities:** Understand the request → choose specialists and models → review every output → decide next action → produce final response.

Specialists never communicate with each other directly. Never forward specialist output without reviewing it.

### Specialist Selection

| Specialist  | Purpose                                                                                                            | Model                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Planner     | Break task into questions for Analyzer, produce `docs/plan.md`                                                     | Sonnet                                               |
| Analyzer    | Answer Planner questions by searching the codebase. Never writes code. Saves findings to `docs/finding/<topic>.md` | Sonnet (default) / Haiku (1-2 files, obvious lookup) |
| Briefer     | Read `docs/plan.md`, summarize business logic changes and impact for the user, then wait for explicit confirmation (`yes` / `proceed`) before workflow continues. Never describes code changes unless the user asks. | Sonnet |
| Implementer | Apply approved solution from `docs/plan.md`. If blocked: return `PLAN ISSUE`                                       | Haiku (simple) / Sonnet (complex)                    |
| Reviewer    | Review architecture, dependency direction, coding standards, test quality, unintended changes                      | Haiku / Sonnet                                       |
| Compiler    | Run lint + build + tests. Never modifies code                                                                      | Haiku                                                |
| Test Writer | Write vitest tests for implemented code. Never modifies production code                                            | Haiku                                                |
| Documenter  | Update `docs/claude_history.md` and `docs/to_do.md`                                                                | Haiku                                                |

**Skip Reviewer for:** formatting, comments, docs-only, trivial rename.
**Never substitute inline file reading for the Reviewer.** After Implementer completes a medium, large, or architecture task, always dispatch the Reviewer — regardless of how the output looks.
**Briefer** always runs after Planner and before Implementer. Skip only for investigation-only and documentation-only tasks.
**Documenter** runs after every code task. Skip only for investigation-only tasks.
**Cleaner** runs only when explicitly requested by the user.
**Compiler** runs only when explicitly requested by the user.

### Decision Policy

| Task                   | Specialists                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Investigation only     | Planner → Analyzer                                                                   |
| Small bug              | Planner → Analyzer → Planner → **Briefer** → Implementer → Documenter               |
| Medium / Large feature | Planner → Analyzer → Planner → **Briefer** → Implementer → Reviewer → Documenter    |
| Architecture change    | Planner → Analyzer → Planner → **Briefer** → Implementer (Sonnet) → Reviewer → Documenter |
| Security-sensitive     | Always include Reviewer                                                              |
| Documentation only     | Documenter                                                                           |
| Release                | Release Manager                                                                      |

### Escalation Rules

Ask the user when: requirements are ambiguous, architecture must change, public APIs break, migrations are required, data loss is possible, security implications exist, or Implementer returns `PLAN ISSUE`.

### General Rules

- Analyze before implementation.
- Prefer minimal code changes. Preserve project conventions.
- Never guess. Ask the user only when blocked.
- The Engineering Manager owns all final decisions.

---

## Claude Response Expectations

- Be concise. No explanations unless asked.
- No yapping, no long explanations.
- Provide details only when explicitly asked.

## Task Classification

Before making any code changes, classify the user request as one of:

- **Unit test** — handled by Test Writer agent
- **Logic/feature** — handled by Implementer agent
- **Release** — handled by Release Manager agent

Never mix logic and test changes in a single step.

## Coding Standards

- Remove unused variables, functions, and imports.
- If something must remain unused, rename it to `_` to indicate intentional non-use.

## Troubleshooting

- After running `npm install`, run `npm run build:local` to resolve potential build issues.

## Git Workflow

- Do NOT add `Co-Authored-By` to commit messages.

## Known Type Gotchas

- `CommandHandlers` from matterbridge is `keyof CommandHandlerDataMap` (a string union). Use it directly as a parameter type — never `keyof CommandHandlers` (resolves to string method names).
