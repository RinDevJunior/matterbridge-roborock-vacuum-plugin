# Agent Prompts

Spawn templates for the **main session (EM)** via `Agent`. System prompts live in `.claude/agents/` — read the matching file before spawning (Cursor doesn't auto-load them; the prompt must carry role + request).

**Model:** never pass `model:` — frontmatter is truth. Exception: `implementer` on high → `model: "sonnet"`.
**Nesting:** EM spawns `technical-architect` only; it nests `wiki-manager`(gather, high)/`investigator` itself — never spawn those directly.
**Lite path:** low complexity → `direct-executor` directly, no task folder/architect/approval.
**Explain mode:** EM spawns `technical-architect` with `type: explain`; it writes `answer.md`. EM must not read `src/`/`wiki/`.

---

**Technical Architect** — implement:
`Agent({description:"Architecture plan: <task>", subagent_type:"technical-architect", prompt:"Task folder: workspace/<task>/\nRequirement file: workspace/<task>/requirement.md\ntype: implement\nComplexity: medium|high"})`

— explain:
`Agent({description:"Explain: <question>", subagent_type:"technical-architect", prompt:"Task folder: workspace/<task>/\nRequirement file: workspace/<task>/requirement.md\ntype: explain\n\nWrite answer.md (not plan.md). Read memory/wiki directly; spawn investigator for deep traces."})`

Researches internally (direct reads medium; nests wiki-manager+investigator high). Writes `plan.md`+`test-plan.md`+`business-brief.md` (implement) or `answer.md` (explain); returns ≤10-line summary — EM reviews summary, then prints `business-brief.md` for the approval gate.

---

**Wiki Manager** — gather (nested by architect only):
`Agent({description:"Wiki: <task>", subagent_type:"wiki-manager", prompt:"Task folder: workspace/<task>/\nRequirement file: workspace/<task>/requirement.md"})`

— update (EM, user request/pre-release only):
`Agent({description:"Wiki update: <task>", subagent_type:"wiki-manager", prompt:"Mode: update\nRecent changes: <history summary>\nTask folder (optional): workspace/<task>/"})`

Leaf agent. Writes `wiki-brief.md` (gather) or edits `wiki/` (update).

---

**Investigator** (nested only, never spawn from EM):
`Agent({description:"Investigate: <task>", subagent_type:"investigator", prompt:"Task folder: workspace/<task>/\nWiki brief (if present): workspace/<task>/wiki-brief.md\nQuestion files: workspace/<task>/questions-<topic>.md"})`

Spawned by technical-architect only for complex gaps. Leaf agent.

---

**Implementer:**
`Agent({description:"Implement: <task>", subagent_type:"implementer", prompt:"Task folder: workspace/<task>/"})` — add `model:"sonnet"` for high only.

Run after brief approval. Follows `plan.md`. Gate: `format:ci`→`lint:fix:ci`→`type-check:ci`, all PASS.

---

**Test Writer:**
`Agent({description:"Tests: <task>", subagent_type:"test-writer", prompt:"Task folder: workspace/<task>/"})`

Run after implementer+reviewer. Gate: `format:ci`→`lint:fix:ci`→`type-check:ci`→`test:ci`, all PASS.

---

**Compiler** (user-request only):
`Agent({description:"Compiler: lint, build, test", subagent_type:"compiler", prompt:"Run lint, build, type-check, and tests. Return the compiler report."})`

---

**Reviewer:**
`Agent({description:"Review: <task>", subagent_type:"reviewer", prompt:"Task folder: workspace/<task>/"})`

Run after implementer (medium/high; lite-path only if security-sensitive or user asks). Diffs against `plan.md`.

---

**Documenter:**
`Agent({description:"Docs: update history and todo", subagent_type:"documenter", prompt:"Task summary: <one paragraph — what changed, files touched, outcome>\nFollow-ups (if any): <items for to_do.md>"})`

Run after reviewer approves. EM supplies the summary — documenter does not read `plan.md`/`business-brief.md`. Skip for investigation-only. Never triggers wiki refresh (batched separately).

---

**Finalizer** — full (commit prep):
`Agent({description:"Finalize: clean, stage, format, precommit, commit message", subagent_type:"finalizer", prompt:"Task folder (optional): workspace/<task>/\nPaths to stage (optional): <paths, or omit for session changes>\nUser notes: <optional>"})`
Pipeline: discover ephemeral paths → `clean-paths.mjs` → `git add` → `format:ci` → re-stage → `precommit:ci` → `diff:ci` → commit message only if precommit passes.

— cleanup only:
`Agent({description:"Finalize: cleanup ephemeral docs only", subagent_type:"finalizer", prompt:"Task folder: workspace/<task>/\nmode: cleanup only\nUser notes: <optional>"})`

---

**Release Manager** (user request only):
`Agent({description:"Release: bump version and changelog", subagent_type:"release-manager", prompt:"<optional: user changelog notes>"})`
Good moment to also run wiki-manager (update mode) if refreshes are batched up.

---

**Direct Executor** — default for low complexity / ad-hoc opt-out. Bypasses task folder/architect/approval/reviewer/documenter unless user asks separately.
`Agent({description:"Direct: <summary>", subagent_type:"direct-executor", prompt:"USER REQUEST:\n<verbatim request>\n\nCONSTRAINTS (if any):\n<scope limits from manager>"})`

Spawn when: low complexity, or user says "direct-executor"/"run this directly"/"skip the flow"/"/direct". No `requirement.md` for this path.
