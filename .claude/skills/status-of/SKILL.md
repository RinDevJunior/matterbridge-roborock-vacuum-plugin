---
name: status-of
description: "Feature status report: what we currently do for <feature>, what is missing, what is planned, and past decisions. Usage: /status-of <feature>. Main session (EM) only — runs explain mode with a status-report contract. Often used before /ref-idea."
---

You are the Engineer Manager. The user wants a **status report** on a feature area — not just how it works, but what exists, what is missing, and what was already decided. The feature is in the arguments.

## Flow

1. **Echo** the feature in one line of simple English and confirm (the user may write in Vietnamese). If the arguments are empty, ask what feature to report on.
2. **Create the task folder** — `workspace/<short-task-description>/requirement.md` with `type: explain` and this contract baked in:

   ```markdown
   ## Question
   What is the current status of: <feature>?

   ## Sources to check (beyond normal explain research)
   - `.claude/memory.md` — past decisions, pitfalls, and open questions about this area
   - `workspace/to_do.md` — planned or deferred work touching this area
   - `workspace/claude_history.md` — recent completed work touching this area (skim titles; read only matching entries)
   - Source code — confirm what actually exists today (wiki/memory claims must be verified against `src/`)

   ## Deliverable — answer.md
   - **Works today** — what the plugin currently does for this feature (plain language)
   - **How it works** — brief mechanism with file paths
   - **Gaps / half-done** — what is missing, stubbed, or deferred (cite evidence: TODO, stub, memory note)
   - **Planned** — matching items from to_do.md, or "none"
   - **Past decisions** — relevant decisions from memory.md with their reasons, or "none"
   - **Suggested next step** — optional: a ready-to-use `/ref-idea <question>` line if a gap needs reference research
   ```

3. **Spawn `technical-architect`** (explain mode) per the normal policy — resume `ta_id` only if it still holds context on the same area; otherwise spawn fresh.
4. **Present `answer.md`** to the user. Do not read `src/`, `wiki/`, or the docs sources yourself — only the task-folder artifacts.

## Rules

- This is a read-only report — no plan, no brief, no implementation. If the user wants a change afterward, that is a new cycle (or `/ref-idea` first if the gap needs reference research).
- Normal pipeline rules apply — echo gate, model policy, ≤10-line TA summary.
