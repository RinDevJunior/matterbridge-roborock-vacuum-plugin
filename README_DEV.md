# Developer Guide

> New to this project? Start with [`docs/onboarding.md`](docs/onboarding.md) — setup, AI workflow, and a two-phase CLI-first pattern for device-protocol work.

## Prerequisites

- Matterbridge must run in **childbridge** mode.
- Node.js and npm installed.
- **CodeGraph** (optional but recommended for AI-assisted development):
  ```sh
  npm i -g @colbymchenry/codegraph
  npm run codegraph:init
  ```
  See [README_CODEGRAPH.md](README_CODEGRAPH.md) for full setup.

---

## AI tooling (Claude Code & Cursor)

This repo supports **both** [Claude Code](https://code.claude.com/) and [Cursor](https://cursor.com/) with **separate, parallel config**. Each tool reads only its own tree — do not mix paths when editing policy or agents.

### Layout

```text
CLAUDE.md                 # Router (tiny) → read .claude/CLAUDE.md if you are Claude Code
AGENTS.md                 # Router: @.cursor/CURSOR.md + @.claude/memory.md (Cursor auto-load)

.claude/
  CLAUDE.md               # Index: roles, coding standards, memory, CodeGraph/LSP
  memory.md               # Durable project knowledge (canonical)
  agents/                 # Subagent role definitions
  instructions/
    team-orchestrator-policy.md   # EM playbook (main session only)
    agent-prompts.md              # Spawn prompt templates (Agent tool)
  skills/                 # load-policy, ref-idea, status-of
  templates/              # reference-workspaces allowlist template

.cursor/
  CURSOR.md               # Index: roles, coding standards, memory, CodeGraph/Serena
  memory.md               # Stub only — Cursor loads `.claude/memory.md` via AGENTS.md
  agents/                 # Subagent role definitions (mirrored)
  instructions/
    team-orchestrator-policy.md   # EM playbook (main session only)
    agent-prompts.md              # Spawn prompt templates (Task tool)
  skills/                 # load-policy, ref-idea, status-of (Cursor paths)
  templates/              # reference-workspaces allowlist template
  mcp.json                # CodeGraph + Serena MCP servers
```

Root `CLAUDE.md` is loaded by **both** tools (Cursor compatibility). It only tells Claude Code to open `.claude/CLAUDE.md` and tells other tools to ignore `.claude/`.

### Which file to edit

| You use         | Edit index here     | Edit EM playbook here                              | Edit agents here  |
| --------------- | ------------------- | -------------------------------------------------- | ----------------- |
| **Claude Code** | `.claude/CLAUDE.md` | `.claude/instructions/team-orchestrator-policy.md` | `.claude/agents/` |
| **Cursor**      | `.cursor/CURSOR.md` | `.cursor/instructions/team-orchestrator-policy.md` | `.cursor/agents/` |

**Shared template:** `.claude/CLAUDE.md` and `.cursor/CURSOR.md` use the **same section order and headings**. The EM playbook lives in matching `instructions/team-orchestrator-policy.md` files. Tool-specific differences (e.g. `Agent` vs `Task`, LSP vs Serena) live in the matching slots only.

When you change orchestration policy or an agent role, update **both** trees if the change applies to both tools — or only your tool’s folder if the change is tool-specific.

### Cursor — recommended settings

1. **Disable third-party imports** (stops Cursor from loading `.claude/` skills, agents, and plugins):
   - **Cursor Settings → Rules, Skills, Subagents**
   - Turn **off** “Include third-party Plugins, Skills, and other configs”
2. Rely on committed config: `AGENTS.md` (includes `@.cursor/CURSOR.md` and `@.claude/memory.md`), `.cursor/agents/`, `.cursor/mcp.json`.

After changing settings, open a **new Agent chat** and confirm the session follows `.cursor/CURSOR.md` (and loads `.cursor/instructions/team-orchestrator-policy.md` when orchestrating), not `.claude/CLAUDE.md`.

### Code navigation by tool

| Tool            | Symbol / structure lookup                                 | Call paths & blast radius              |
| --------------- | --------------------------------------------------------- | -------------------------------------- |
| **Claude Code** | LSP (`findReferences`, `goToDefinition`, …)               | CodeGraph (`codegraph_explore` or CLI) |
| **Cursor**      | Serena MCP (`find_symbol`, `find_referencing_symbols`, …) | CodeGraph (`codegraph_explore` or CLI) |

See [README_CODEGRAPH.md](README_CODEGRAPH.md) for CodeGraph setup. Serena is configured in `.cursor/mcp.json`.

### MCP servers (this repo)

| Server    | Claude Code | Cursor             |
| --------- | ----------- | ------------------ |
| CodeGraph | `.mcp.json` | `.cursor/mcp.json` |
| Serena    | —           | `.cursor/mcp.json` |

---

## Project Structure (Key Files)

| File                                                                                                                               | Purpose                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`src/roborockCommunication/models/deviceModel.ts`](src/roborockCommunication/models/deviceModel.ts)                               | Enum of all known device models                                          |
| [`src/behaviors/roborock.vacuum/core/cleanModeConfig/`](src/behaviors/roborock.vacuum/core/cleanModeConfig/)                       | All clean mode definitions (labels, mode numbers, settings, Matter tags) |
| [`src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`](src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts) | Maps each device model → its extra clean modes                           |
| [`src/behaviors/roborock.vacuum/core/behaviorConfig.ts`](src/behaviors/roborock.vacuum/core/behaviorConfig.ts)                     | Builds `BehaviorConfig` per device (handler chain, mode maps)            |
| [`src/behaviors/roborock.vacuum/handlers/`](src/behaviors/roborock.vacuum/handlers/)                                               | Clean mode handler implementations                                       |

---

## How to Add Support for a New Device

### Step 1 — Register the device model

Open [`src/roborockCommunication/models/deviceModel.ts`](src/roborockCommunication/models/deviceModel.ts) and add a new entry:

```ts
MY_NEW_DEVICE = 'roborock.vacuum.xxxx',  // replace with actual model ID
```

### Step 2 — Register its extra clean modes

Open [`src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`](src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts) and add an entry to `DEVICE_EXTRA_MODES`:

```ts
// Device that only has Vac Followed by Mop:
[DeviceModel.MY_NEW_DEVICE]: [vacFollowedByMopModeConfig],

// Device that has Smart Plan + Vac Followed by Mop:
[DeviceModel.MY_NEW_DEVICE]: [smartPlanModeConfig, vacFollowedByMopModeConfig],
```

If your device only uses base clean modes (no extra modes), you don't need to add it here — it will use defaults automatically.

> **That's it.** The rest of the system (BehaviorConfig, resolver, supported clean modes) is handled automatically by the registry.

---

## How to Add a New Clean Mode

### Step 1 — Add the label

In [`src/behaviors/roborock.vacuum/core/cleanModeConfig.ts`](src/behaviors/roborock.vacuum/core/cleanModeConfig.ts), add to `CleanModeDisplayLabel`:

```ts
MyNewMode = 'Vacuum & Mop: My New Mode',
```

### Step 2 — Add the mode number mapping

In the same file, add to `CleanModeLabelInfo`:

```ts
[CleanModeDisplayLabel.MyNewMode]: { mode: <mode_number>, label: CleanModeDisplayLabel.MyNewMode },
```

### Step 3 — Create the config constant

In the same file, export a new `CleanModeConfig`:

```ts
export const myNewModeConfig: CleanModeConfig = {
  label: CleanModeLabelInfo[CleanModeDisplayLabel.MyNewMode].label,
  mode: CleanModeLabelInfo[CleanModeDisplayLabel.MyNewMode].mode,
  setting: new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist),
  modeTags: [{ value: RvcCleanMode.ModeTag.Mop }, { value: RvcCleanMode.ModeTag.Vacuum }],
};
```

### Step 4 — (Optional) Add a custom handler

If the mode needs special command logic (like Smart Plan), create a handler in [`src/behaviors/roborock.vacuum/handlers/`](src/behaviors/roborock.vacuum/handlers/):

```ts
export class MyNewModeHandler implements ModeHandler {
  public canHandle(_mode: number, activity: string): boolean {
    return activity === CleanModeDisplayLabel.MyNewMode;
  }

  public async handle(duid: string, _mode: number, activity: string, context: HandlerContext): Promise<void> {
    // ...send command to device
  }
}
```

Then register it in [`src/behaviors/roborock.vacuum/core/behaviorConfig.ts`](src/behaviors/roborock.vacuum/core/behaviorConfig.ts) inside `buildBehaviorConfig()`.

If the mode uses standard preset settings (just `changeCleanMode` with the setting), add it to the `presetModes` list in [`src/behaviors/roborock.vacuum/handlers/presetCleanModeHandler.ts`](src/behaviors/roborock.vacuum/handlers/presetCleanModeHandler.ts) instead.

### Step 5 — Register the mode for relevant devices

In [`src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`](src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts):

```ts
[DeviceModel.MY_DEVICE]: [myNewModeConfig, ...existingModes],
```

---

## Build and Run

```sh
sudo npm run precondition
npm run build
```

---

## Running Tests

```sh
npm test
```

---

## CodeGraph (Code Intelligence)

See [README_CODEGRAPH.md](README_CODEGRAPH.md) for setup and usage with Claude Code and Cursor.
