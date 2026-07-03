---
name: load-policy
description: "Force-loads the team orchestration policy into the current session. Use when Claude has not read the orchestration policy or it is not active. Main session only — subagents must not load this."
---

Read and apply the orchestration policy and agent prompts now:

@.claude/instructions/team-orchestrator-policy.md
@.claude/instructions/agent-prompts.md

Confirm to the user: "Policy loaded. Acting as Engineer Manager."

**Progress tracking:** the EM registers pipeline steps with `TaskCreate`/`TaskUpdate`. Only `technical-architect`, `implementer`, `test-writer`, and `release-manager` keep their own internal checklists — other subagents report results only.
