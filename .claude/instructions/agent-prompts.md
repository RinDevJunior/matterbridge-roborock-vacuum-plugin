# Agent Prompts

Use these prompt templates when spawning specialists. Fill in `<placeholders>` with actual context.

System prompts are defined in `.claude/agents/`. Only pass task-specific context in `prompt`.

---

## 🟣 Planner

```
Agent({
  description: "Plan: <task summary>",
  subagent_type: "planner",
  model: "sonnet",
  prompt: "Task: <task description>"
})
```

Run first. Produces `docs/agent-questions.md`. Dispatch Analyzer next, then Planner again to read answers and produce `docs/plan.md`.

---

## 🔵 Analyzer

```
Agent({
  description: "Analyze: <task summary>",
  subagent_type: "analyzer",
  model: "sonnet",
  prompt: "Task: <task description>"
})
```

Run AFTER Planner writes `docs/agent-questions.md`. Reads questions, writes answers to `docs/agent-answers.md`.

---

## 🟢 Implementer

```
Agent({
  description: "Implement: <task summary>",
  subagent_type: "implementer",
  model: "haiku" | "sonnet",
  prompt: "Task: <task description>"
})
```

Run AFTER Planner produces `docs/plan.md` (Status: ready).

---

## 🟡 Test Writer

```
Agent({
  description: "Tests: <task summary>",
  subagent_type: "test-writer",
  model: "haiku",
  prompt: "Task: <task description>"
})
```

Run AFTER Implementer completes and Compiler confirms a clean build.

---

## 🔴 Compiler

```
Agent({
  description: "Compiler: lint, build, test",
  subagent_type: "compiler",
  model: "haiku",
  prompt: "Run lint, build, type-check, and tests. Return the compiler report."
})
```

Run only when explicitly requested by the user.

---

## 🟠 Reviewer

```
Agent({
  description: "Review: <task summary>",
  subagent_type: "reviewer",
  model: "sonnet",
  prompt: "Task: <task description>"
})
```

Run LAST after Compiler confirms all passing.

---

## 🩵 Documenter

```
Agent({
  description: "Docs: update history and todo",
  subagent_type: "documenter",
  model: "haiku",
  prompt: "Description: <one short sentence of what was done>"
})
```

Run after every code task (after Reviewer approves). Skip for investigation-only tasks.

---

## ⬜ Cleaner

```
Agent({
  description: "Clean: remove ephemeral agent files",
  subagent_type: "cleaner",
  model: "haiku",
  prompt: ""
})
```

Run at the end of every completed task cycle, after Documenter.

---

## 🩷 Manager

```
Agent({
  description: "Manager: escalate blocker",
  subagent_type: "manager",
  model: "sonnet",
  prompt: "Task: <original task description>"
})
```

Run only when Planner has completed one full loop with Analyzer and is still blocked.

---

## 🟠 Release Manager

```
Agent({
  description: "Release: bump version and changelog",
  subagent_type: "release-manager",
  model: "sonnet",
  prompt: "<optional: user-provided changelog notes>"
})
```

Run only when the user explicitly requests a release.
