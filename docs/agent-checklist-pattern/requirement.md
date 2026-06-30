# Requirement

type: implement
complexity: medium

## Feature

All agents must maintain a progress checklist file in the task folder during their work, so the Engineer Manager and user can track what each agent is doing across the session.

## Behavior

- At the start of their work, each agent writes a `progress-<agent-name>.md` file to the task folder listing their planned steps as a markdown checklist (`- [ ] step`).
- As each step completes, the agent updates the file to check off that item (`- [x] step`).
- The file remains in the task folder until Finalizer cleans up at wrap-up.

## Scope

Update all agent definition files in `.claude/agents/` to include this checklist behavior:

- technical-architect
- wiki-manager
- investigator
- briefer
- implementer
- reviewer
- test-writer
- compiler
- documenter
- finalizer
- direct-executor

## Out of Scope

- No changes to CLAUDE.md or team-orchestrator-policy.md workflow steps.
- No changes to production source code.
