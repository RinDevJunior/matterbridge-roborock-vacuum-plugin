# Cursor User Input Guidelines

Cursor-specific patterns for gathering user decisions in this repository's Engineer Manager (EM) workflow.

**Agent SDK equivalent:** `.claude/instructions/user-input-guidelines.md` (`AskUserQuestion`, `canUseTool`).

---

## Primary Tool: AskQuestion

In Cursor, use the **`AskQuestion`** tool for structured multiple-choice prompts.

| Agent SDK                         | Cursor                                          |
| --------------------------------- | ----------------------------------------------- |
| `AskUserQuestion`                 | `AskQuestion`                                   |
| `question` + `header` + `options` | `prompt` + `options` (each with `id` + `label`) |
| `multiSelect: true`               | `allow_multiple: true`                          |

### When to use

- **Engineer Manager (main session):** complexity confirmation (medium/high), architecture alternatives when a plan offers two approaches.
- **Briefer:** approval gate after writing `business-brief.md` (Approve / Request Changes).
- **Any subagent:** ambiguity, design decisions, or blockers that cannot be resolved from task-folder context alone.

### Input format

```yaml
questions:
  - id: approval          # stable identifier for the answer
    prompt: "Business brief is ready. Approve to proceed, or request changes?"
    options:
      - id: approve
        label: "Approve (Recommended)"
      - id: request_changes
        label: "Request Changes"
    allow_multiple: false  # omit or false for single-select
```

Rules:

- **1 question per call** when following EM policy ("ask one focused question at a time").
- **2–4 options** per question; users can always pick **Other** for free text.
- Put the recommended option first and suffix the label with `(Recommended)` when applicable.
- Prefer `AskQuestion` over open-ended chat when the decision is binary or has a small fixed set of outcomes.

---

## Approval Workflows

### Business brief (briefer)

After writing `business-brief.md`, briefer calls `AskQuestion` before reporting to EM:

| Option          | EM action                                                      |
| --------------- | -------------------------------------------------------------- |
| Approve         | Spawn implementer                                              |
| Request Changes | Write `manager-clarification.md`, re-spawn technical-architect |

EM reads the decision from briefer's report — it does not re-ask unless the user overrides in chat.

### Complexity confirmation (EM)

For **medium** and **high** tasks, confirm complexity before spawning technical-architect. Auto-confirm obvious **low** tasks.

### Escalation (EM or subagent)

Use `AskQuestion` when:

- Requirements are ambiguous and block progress.
- The plan presents two valid architectural approaches.
- A reviewer flags a borderline blocking issue.
- Compiler or finalizer hits a failure and needs a continue/abort decision.

Do **not** use `AskQuestion` for information you can infer from `requirement.md`, `plan.md`, or the codebase.

---

## What Cursor Does Not Have (Agent SDK)

| Agent SDK feature                   | Cursor equivalent                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `canUseTool` callback               | Cursor approval modes (Auto / Ask / sandbox). User rules and `.cursor/rules/` govern behavior. |
| Session hooks for input validation  | Cursor hooks (see create-hook skill) or rule files.                                            |
| `permissionMode` on AgentDefinition | Not exposed on the `Task` tool; scope via `readonly: true` and prompt constraints.             |

Do not reference `canUseTool` or `AskUserQuestion` in Cursor-facing docs or spawn prompts — use the Cursor names above.

---

## Best Practices

1. **Concise prompts** — state what is ready, what you need, and the consequence of each option.
2. **One decision at a time** — split multi-part approvals into sequential `AskQuestion` calls if needed.
3. **Report decisions upstream** — subagents include the user's choice in their final report to EM; EM does not re-poll unless the user speaks up in chat.
4. **Prefer task-folder context** — read `requirement.md` / `plan.md` before asking.
5. **Explain mode** — EM clarifies the question in chat, then spawns technical-architect; EM must not read `src/` or `wiki/` in explain mode.

---

## Cross-References

- EM workflow: `CLAUDE.md`, `.cursor/rules/engineer-manager.mdc`
- Subagent spawning: `.cursor/instructions/subagent-guidelines-cursor.md`
- Spawn templates: `.claude/instructions/agent-prompts.md`
- Briefer approval step: `.cursor/agents/briefer.md`
