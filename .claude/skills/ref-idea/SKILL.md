---
name: ref-idea
description: "Research the reference codebases for an idea/solution, then optionally apply it to this repo. Usage: /ref-idea <question>. Main session (EM) only — runs the normal investigation pipeline with the standard reference-research boilerplate pre-filled."
---

You are the Engineer Manager. The user wants to research the reference codebases for an idea and possibly apply it here. The user's question is in the arguments. Run the **normal pipeline** — this skill only pre-fills the boilerplate.

## Phase 1 — Research

1. **Echo** the question in 1–3 bullets of simple English and confirm (the user may write in Vietnamese). If the arguments are empty or unclear, ask for the question first.
2. **Check the allowlist** — `wiki/reference-workspaces.md` must exist and list the reference repo paths. If it is missing or has unfilled `<path>` placeholders, ask the user for the paths and update the file before spawning anything (investigator may only read paths listed there).
3. **Create the task folder** — `workspace/<short-task-description>/requirement.md` with `type: explain` and this boilerplate baked in:

   ```markdown
   ## Question
   <the confirmed question>

   ## Research rules
   - FIRST check `.claude/memory.md` and any earlier `answer.md`/`answers-*.md` files — investigate only the gaps; if memory already answers it, say so and stop.
   - Sources in priority order from `wiki/reference-workspaces.md` (top first). Stop early once the question is answered.
   - LSP/CodeGraph work on this repo only — use Grep/Glob/Read inside reference workspaces (read-only).
   - If a needed source is unreachable or not allowlisted, report it in the summary instead of improvising.

   ## Deliverable — answer.md
   - Verdict: does a solution exist? (yes / partial / no / already known)
   - Per-source findings with file:line evidence
   - Applicability: how each idea maps onto our codebase (which layer/service it would touch)
   - Recommended candidate(s), numbered, so the user can say "apply idea N"
   ```

4. **Spawn `technical-architect`** (explain mode) per the normal policy — resume `ta_id` only if it still holds context on the same topic; otherwise spawn fresh.
5. **Present `answer.md`** to the user. Do not read `src/` or the reference workspaces yourself.

## Phase 2 — Apply (only when the user picks an idea)

When the user says "apply idea N" (or similar):

1. Start a **normal implement cycle**: new `requirement.md` (`type: implement`, assess complexity) that cites `workspace/<research-task>/answer.md` as the design input — do not re-explain the idea in chat.
2. Full pipeline as usual: architect → briefer → **user approval** → implementer → reviewer → test-writer → documenter. No implementation before brief approval.

## Rules

- This skill changes nothing about the pipeline — echo gate, approval gate, and model policy all apply as normal.
- Never let research and implementation share one cycle: Phase 1 produces `answer.md`, Phase 2 consumes it.
