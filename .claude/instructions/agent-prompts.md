# Agent Prompts

Use these prompt templates when spawning specialists. Fill in `<placeholders>` with actual context.

System prompts are defined in `.claude/agents/`. Only pass task-specific context in `prompt`.

---

## 🔵 Analyzer

```
Agent({
  description: "Analyze: <task summary>",
  subagent_type: "analyzer",
  model: "haiku" | "sonnet",
  prompt: "Task: <task description>"
})
```

---

## 🟢 Implementer

```
Agent({
  description: "Implement: <task summary>",
  subagent_type: "implementer",
  model: "haiku" | "sonnet",
  prompt: `
Solution plan:
<paste SOLUTION PLAN from Analyzer>
`
})
```

---

## 🟡 Reviewer

```
Agent({
  description: "Review: <task summary>",
  subagent_type: "reviewer",
  model: "haiku" | "sonnet",
  prompt: `
Solution plan:
<paste SOLUTION PLAN from Analyzer>

Files changed:
<paste files list from IMPLEMENTATION SUMMARY>
`
})
```

---

## 🔴 Compiler

```
Agent({
  description: "Compiler: lint, build, test",
  subagent_type: "compiler",
  model: "haiku",
  prompt: ""
})
```

---

## 👁 Documentation Maintainer

```
Agent({
  description: "Docs: update history and todo",
  subagent_type: "documentation-maintainer",
  model: "haiku",
  prompt: `
Description: <one short sentence of what was done>
Verify result: PASS | PASS WITH NOTES | FAIL | skipped
`
})
```
