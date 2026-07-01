# CodeGraph Integration

## What is CodeGraph?

Local-first code-intelligence tool that turns the codebase into a queryable SQLite knowledge graph exposed over MCP. Lets AI agents (Claude Code, Cursor) navigate the code graph instead of scanning files — dramatically fewer tool calls.

## Why contributors use it here

- TypeScript plugin with layered architecture; CodeGraph maps import chains and call edges across `src/behaviors/`, `src/roborockCommunication/`, `src/share/` without grep sweeps.
- Agents can trace handler chains (`behaviorConfig` → handlers → `presetCleanModeHandler`) in one query rather than reading every file.

## One-time setup (per machine)

### Install the CLI

```sh
npm i -g @colbymchenry/codegraph
# or, no Node required:
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
```

### Wire up your agent(s)

This repo ships project-local agent config:

| Agent | Config |
|-------|--------|
| **Claude Code** | `.mcp.json` + CodeGraph section in `CLAUDE.md` + permissions in `.claude/settings.json` |
| **Cursor** | `.cursor/mcp.json` + `.cursor/rules/codegraph.mdc` |

You still need the CodeGraph CLI on your PATH and a restart of your agent after first clone. If you prefer global install instead:

```sh
codegraph install
```

That writes to `~/.claude.json` / `~/.cursor/mcp.json` — the committed project config above is sufficient for this repo.

## Per-clone project setup

From the repo root:

```sh
codegraph init
```

Creates `.codegraph/` and builds the full index in one step. Re-run after large refactors or when the agent reports stale symbol data.

## Key areas to explore in this repo

| Area | Path | What to query |
|------|------|---------------|
| Clean mode pipeline | `src/behaviors/roborock.vacuum/` | handler chain, mode config |
| Device model registry | `src/roborockCommunication/models/` | DeviceModel enum entries |
| Capability registry | `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts` | device→modes map |
| Shared utilities | `src/share/` | cross-cutting helpers |

## Impact analysis before changes

Before editing a symbol, use:

```sh
codegraph impact <symbol>
```

This traces callers, callees, and the full impact radius — useful before touching `BehaviorConfig`, `ModeHandler` implementations, or shared types in `src/share/`.

## Vitest workflow with `codegraph affected`

To run only the tests affected by your changes:

```sh
# Find affected test files from your diff, then run vitest
AFFECTED=$(git diff --name-only HEAD | codegraph affected --stdin --quiet)
if [ -n "$AFFECTED" ]; then npm test -- $AFFECTED; fi
```

Or pass changed source files directly:

```sh
codegraph affected src/behaviors/roborock.vacuum/core/behaviorConfig.ts
```

Full suite: `npm test`

## Git hygiene — do not commit `.codegraph/`

The `.codegraph/` directory is a local machine-specific index. It is already listed in `.gitignore`. Never commit it.

## Optional: `codegraph.json`

A project-local `codegraph.json` is only needed to customise exclusion patterns or language hints. The default auto-detection works correctly for this TypeScript project — no `codegraph.json` is required.
