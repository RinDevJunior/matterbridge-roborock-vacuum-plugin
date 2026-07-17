# Agent Prompts (EM spawn reference)

Workflow/gates: `.cursor/instructions/team-orchestrator-policy.md`. Role defs: `.cursor/agents/<name>.md` (embed key constraints in `prompt`).

## Model

- **No `model:` on Task** — use agent frontmatter. Exception: high **implementer** → `model: "claude-4.6-sonnet-medium"` if Task accepts; else omit.
- Usage-limit fail → retry without `model` (Auto).

| Frontmatter tier    | Agents                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `composer-2.5-fast` | briefer, compiler, documenter, finalizer, implementer (default), wiki-manager              |
| `auto`              | technical-architect, investigator, reviewer, test-writer, direct-executor, release-manager |

## Task skeleton

```typescript
Task({ description: "<role>: <task>", subagent_type: "<name>", prompt: "<see table>", run_in_background: false });
```

Parallel Task only for independent work — never reviewer + test-writer + documenter together.

## Spawn table

| Agent                                                                        | When                   | `prompt` (minimum)                                                                                                 |
| ---------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **technical-architect**                                                      | Planning; once/cycle   | `Task folder: workspace/<task>/\nRequirement: …\ntype: implement\|explain` → plan+test-plan or answer.md           |
| **briefer**                                                                  | After TA ready         | `Task folder: workspace/<task>/`                                                                                   |
| **implementer**                                                              | After brief Approve    | `Task folder: workspace/<task>/` — plan.md, logic only                                                             |
| **reviewer** pass 1                                                          | After implementer      | `Task folder: workspace/<task>/\npass: production` — prod diff vs plan; tag issues **implementation** \| **tests** |
| **test-writer**                                                              | After pass 1 OK        | `Task folder: workspace/<task>/` + reviewer test notes if any                                                      |
| **reviewer** pass 2                                                          | After test-writer      | `Task folder: workspace/<task>/\npass: final` — full diff; **APPROVE** \| **REQUEST CHANGES** (tagged)             |
| **documenter**                                                               | Final **APPROVE** only | `Task folder: workspace/<task>/`                                                                                   |
| **direct-executor**                                                          | Lite / ad-hoc          | `USER REQUEST:\n<verbatim>\n\nCONSTRAINTS:\n…`                                                                     |
| **finalizer** / **compiler** / **release-manager** / **wiki-manager** update | User request           | See `.cursor/agents/`                                                                                              |

**EM must NOT spawn:** wiki gather, investigator, explore (TA nests).

## Review routing (EM)

| Verdict                    | Tags                        | Next spawn                                  |
| -------------------------- | --------------------------- | ------------------------------------------- |
| Pass 1 **REQUEST CHANGES** | **implementation** only     | `implementer_id` → reviewer pass 1          |
| Pass 1 **REQUEST CHANGES** | **tests** only (or APPROVE) | `test-writer`                               |
| Pass 2 **APPROVE**         | —                           | `documenter`                                |
| Pass 2 **REQUEST CHANGES** | **implementation**          | implementer → test-writer → reviewer pass 2 |
| Pass 2 **REQUEST CHANGES** | **tests**                   | test-writer → reviewer pass 2               |

## Verify gates

implementer: format:ci → lint:fix:ci → type-check:ci · test-writer: + type-check:ci → test:ci · documenter: format:ci · finalizer: + precommit:ci

## Pipeline one-liners

- **Full:** TA → briefer → approve → implementer → reviewer (prod) → test-writer → reviewer (final) → documenter (APPROVE).
- **Lite:** direct-executor → optional reviewer.
- **Explain:** TA → present answer.md.
