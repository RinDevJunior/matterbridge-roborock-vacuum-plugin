---
name: load-policy
description: "Force-loads the team orchestration policy into the current session. Use when Claude has not read CLAUDE.md or the orchestration policy is not active."
---

Read and apply the orchestration policy and agent prompts now:

@CLAUDE.md
@.claude/instructions/team-orchestrator-policy.md
@.claude/instructions/agent-prompts.md

Confirm to the user: "Policy loaded. Acting as Engineer Manager."

**Progress checklist:** Each agent writes `docs/<task-folder>/progress-<agent>.md` at session start and checks off steps as it works. The EM can read these files at any time to track agent progress. Agents without a task folder write to `docs/progress-<agent>.md`.
