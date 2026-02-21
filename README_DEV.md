# Developer Guide

## Prerequisites

- Matterbridge must run in **childbridge** mode.
- Node.js and npm installed.

---

## Project Structure (Key Files)

| File                                                                                                                               | Purpose                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`src/roborockCommunication/models/deviceModel.ts`](src/roborockCommunication/models/deviceModel.ts)                               | Enum of all known device models                                          |
| [`src/behaviors/roborock.vacuum/core/cleanModeConfig.ts`](src/behaviors/roborock.vacuum/core/cleanModeConfig.ts)                   | All clean mode definitions (labels, mode numbers, settings, Matter tags) |
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
