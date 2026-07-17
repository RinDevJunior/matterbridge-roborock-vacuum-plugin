---
name: load-policy
description: "Force-loads the team orchestration policy into the current session. Use when Cursor has not read the orchestration policy or it is not active. Main session only — subagents must not load this."
---

Read and apply the orchestration policy and agent prompts now:

@.cursor/instructions/team-orchestrator-policy.md
@.cursor/instructions/agent-prompts.md

Confirm to the user: "Policy loaded. Acting as Engineer Manager."

**Progress tracking:** the EM registers pipeline steps with `TodoWrite`. Only `technical-architect`, `implementer`, `test-writer`, and `release-manager` keep their own internal checklists — other subagents report results only.
