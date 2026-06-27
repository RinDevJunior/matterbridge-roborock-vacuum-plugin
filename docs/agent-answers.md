## Answers

---

## Session: Remove DEVICE_EXTRA_MODES / featureSet-driven clean modes (2026-06-27)

### Q1: Exact content of DEVICE_EXTRA_MODES and full bodies of getExtraModes / getAllModesForDevice

File: `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`

**DEVICE_EXTRA_MODES** (lines 28–33):

```typescript
export const DEVICE_EXTRA_MODES: Partial<Record<string, CleanModeConfig[]>> = {
    [DeviceModel.QREVO_EDGE_5V1]: [smartPlanModeConfig, vacFollowedByMopModeConfig],
    [DeviceModel.QREVO_PLUS]:     [smartPlanModeConfig, vacFollowedByMopModeConfig],
    [DeviceModel.QREVO_MAXV]:     [smartPlanModeConfig, vacFollowedByMopModeConfig],
    [DeviceModel.Q10_S5_PLUS]:    [vacFollowedByMopModeConfig, vacAndMopDeepModeConfig],
};
```

Four models total. Three carry SmartPlan + VacFollowedByMop; one carries VacFollowedByMop + VacAndMopDeep.

**getExtraModes** (lines 41–56):

```typescript
export function getExtraModes(model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
    const staticModes = DEVICE_EXTRA_MODES[model] ?? [];
    const hasFeatureContext = featureSet !== undefined || newFeatureSet !== undefined;

    if (!hasFeatureContext) {
        return staticModes;
    }

    const features = decodeFeatureSet(featureSet, newFeatureSet);
    return staticModes.filter((config) => {
        if (config.mode === vacFollowedByMopModeConfig.mode) {
            return features.is_clean_then_mop_mode_supported;
        }
        return true; // Smart Plan, VacAndMopDeep — static only, always pass through
    });
}
```

When called without feature args: returns `DEVICE_EXTRA_MODES[model] ?? []` unchanged. When called with feature args: decodes flags and filters out VacFollowedByMop (mode 11) if `is_clean_then_mop_mode_supported` is false; SmartPlan (mode 4) and VacAndMopDeep (mode 12) always pass through unconditionally.

**getAllModesForDevice** (lines 70–72):

```typescript
export function getAllModesForDevice(model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
    return [...getExtraModes(model, featureSet, newFeatureSet), ...baseCleanModeConfigs];
}
```

Prepends extra modes before base modes. Extra modes come first in the returned array.

**getAllKnownModeConfigs** (lines 78–87) — also reads DEVICE_EXTRA_MODES:

```typescript
export function getAllKnownModeConfigs(): CleanModeConfig[] {
    const allExtra = (Object.values(DEVICE_EXTRA_MODES) as CleanModeConfig[][]).flat();
    const uniqueByMode = new Map<number, CleanModeConfig>();
    for (const config of [...allExtra, ...baseCleanModeConfigs]) {
        if (!uniqueByMode.has(config.mode)) {
            uniqueByMode.set(config.mode, config);
        }
    }
    return [...uniqueByMode.values()];
}
```

Iterates all values of DEVICE_EXTRA_MODES, flattens, deduplicates by mode number, appends base modes. Called from `matterStateNames.ts` at module level for name lookup — no model/feature context.

---

### Q2: All exported CleanModeConfig names, their files, and numeric mode values

**Special configs** — File: `src/behaviors/roborock.vacuum/core/cleanModeConfig/special.ts`

| Export name                  | Mode number | Label                               |
| ---------------------------- | ----------- | ----------------------------------- |
| `smartPlanModeConfig`        | 4           | `'Smart Plan'`                      |
| `vacFollowedByMopModeConfig` | 11          | `'Vacuum & Mop: Vac Follow by Mop'` |
| `vacAndMopDeepModeConfig`    | 12          | `'Vacuum & Mop: Deep'`              |

Mode numbers sourced from `CleanModeLabelInfo` in `src/behaviors/roborock.vacuum/core/cleanModeConfig/types.ts` (lines 64–84):

```
SmartPlan → mode 4
VacFollowedByMop (VacFollowedByMop enum value) → mode 11
VacuumAndMopDeep → mode 12
```

All other modes live in `vacuumAndMop.ts`, `mopOnly.ts`, and `vacuumOnly.ts` and are assembled into `baseCleanModeConfigs` in `index.ts` (lines 14–18). The three configs above are the only ones in `DEVICE_EXTRA_MODES`; they are NOT in `baseCleanModeConfigs`.

Note: `smartCleanModeConfigs` (index.ts lines 20–24) includes `smartPlanModeConfig` and `vacFollowedByMopModeConfig` plus all base modes — but this export is not used by `DEVICE_EXTRA_MODES` or any call sites found; it appears unused or legacy.

---

### Q3: DeviceFeatures flags corresponding to each mode

File: `src/share/featureSetDecoder.ts`

- **Smart Plan (mode 4)**: No corresponding flag. No property in `DeviceFeatures` groups A–G is named `is_smart_plan_supported` or any semantic equivalent. The python-roborock library gates Smart Plan via model whitelist/blacklist (Group F), which always decodes to `false` in `decodeFeatureSet` because that data is not available from home-data alone.

- **VacFollowedByMop (mode 11)**: `is_clean_then_mop_mode_supported` — Group D, `extractNibbleBit(hexStr, 93)` (line 527 of featureSetDecoder.ts). This is already implemented and in use — `getExtraModes` already gates mode 11 on this flag when featureSet/newFeatureSet are provided.

- **VacAndMopDeep (mode 12)**: No corresponding flag. No property in `DeviceFeatures` directly maps to this mode. Thematically adjacent flags (`is_carpet_deep_clean_supported` Group C mask 8, `is_clean_route_deep_slow_plus_supported` Group C mask 16777216) describe route/carpet settings, not a specific combined vac+mop deep clean mode.

---

### Q4: Full call chain from device init to registry

**Chain A — behaviorConfig path:**

1. `src/platform/deviceConfigurator.ts:117–128` — `configureDevice(vacuum: Device, ...)` calls:
   ```typescript
   configureBehavior(
       vacuum.specs.model,
       vacuum.duid,
       roborockService,
       ...,
       vacuum.featureSet,      // passed
       vacuum.newFeatureSet,   // passed
   )
   ```
2. `src/share/behaviorFactory.ts:31` — `configureBehavior(...)` calls:
   ```typescript
   const config = buildBehaviorConfig(modelKey, featureSet, newFeatureSet);
   ```
3. `src/behaviors/roborock.vacuum/core/behaviorConfig.ts:44–45` — `buildBehaviorConfig(model, featureSet?, newFeatureSet?)` calls:
   ```typescript
   const withSmartPlan = hasSmartPlan(model);           // no feature args
   const allModes = getAllModesForDevice(model, featureSet, newFeatureSet);
   ```
   Note: `hasSmartPlan` is called without feature args (static lookup only).

**Chain B — getSupportedCleanModes path:**

1. `src/types/roborockVacuumCleaner.ts:144–149` — `initializeDeviceConfiguration(device: Device, ...)` calls:
   ```typescript
   const cleanModes = getSupportedCleanModes(
       device.specs.model,
       configManager,
       device.featureSet,      // passed
       device.newFeatureSet,   // passed
   );
   ```
2. `src/initialData/getSupportedCleanModes.ts:25` — `getSupportedCleanModes(model, configManager, featureSet?, newFeatureSet?)` calls:
   ```typescript
   const supportedModes = getModeOptions(getAllModesForDevice(model, featureSet, newFeatureSet));
   ```

**decodeFeatureSet import:**

- Imported in `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts:2`:
  ```typescript
  import { decodeFeatureSet } from '../../../share/featureSetDecoder.js';
  ```
- Called inside `getExtraModes` at line 49 — only when `featureSet !== undefined || newFeatureSet !== undefined`.
- Signature: `export function decodeFeatureSet(featureSet?: string, newFeatureSet?: string): DeviceFeatures`

---

### Q5: Full hasSmartPlan body and what it reads from

File: `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts:61–63`

```typescript
export function hasSmartPlan(model: string): boolean {
    return getExtraModes(model).some((c) => c.label === CleanModeDisplayLabel.SmartPlan);
}
```

It calls `getExtraModes(model)` with NO featureSet or newFeatureSet arguments. This means it takes the `!hasFeatureContext` branch in `getExtraModes` and returns `DEVICE_EXTRA_MODES[model] ?? []` unfiltered. It reads exclusively from `DEVICE_EXTRA_MODES` — not from any feature flag, not from any other data structure.

Consequence for the task: If `DEVICE_EXTRA_MODES` is removed, `hasSmartPlan` must be replaced with a feature-flag-based check or a separate static model set. Since no flag exists for Smart Plan, a separate static set (or inline model check) would be needed to preserve the SmartPlanHandler registration in `buildBehaviorConfig`.

`hasSmartPlan` is called in `behaviorConfig.ts:44` only — no other callers in the codebase.

---

### Q6: Test files referencing DEVICE_EXTRA_MODES, getExtraModes, getAllModesForDevice, or hasSmartPlan

Search result: **No matches found** in `src/tests/`.

None of the four symbols (`DEVICE_EXTRA_MODES`, `getExtraModes`, `getAllModesForDevice`, `hasSmartPlan`) are referenced in any test file. There are no tests to update or break when these symbols change.

---

## Confidence

- Q1: High — read directly from source, lines 28–87.
- Q2: High — all three special configs read directly from `special.ts` and cross-checked against `CleanModeLabelInfo` in `types.ts`.
- Q3: High on VacFollowedByMop (is_clean_then_mop_mode_supported is already wired). High confidence that Smart Plan and VacAndMopDeep have no flag — no matching property found across all 7 groups of DeviceFeatures.
- Q4: High — all four call sites traced with exact line numbers.
- Q5: High — function body is 3 lines, behavior is unambiguous.
- Q6: High — grep returned no matches.

## Status

answered

---

## Previous session answers (featureSetDecoder implementation research)

### Q1: Complete `NewFeatureStrBit` enum entries

All members of `NewFeatureStrBit(IntEnum)` from `/Volumes/ExternalSSD/code/references/python-roborock/roborock/device_features.py:10–88`:

| Name                                 | Value                                            |
| ------------------------------------ | ------------------------------------------------ |
| TWO_KEY_REAL_TIME_VIDEO              | 32                                               |
| TWO_KEY_RTV_IN_CHARGING              | 33                                               |
| DIRTY_REPLENISH_CLEAN                | 34                                               |
| AUTO_DELIVERY_FIELD_IN_GLOBAL_STATUS | 35                                               |
| AVOID_COLLISION_MODE                 | 36                                               |
| VOICE_CONTROL                        | 37                                               |
| NEW_ENDPOINT                         | 38                                               |
| PUMPING_WATER                        | 39                                               |
| CORNER_MOP_STRETCH                   | 40                                               |
| HOT_WASH_TOWEL                       | 41                                               |
| FLOOR_DIR_CLEAN_ANY_TIME             | 42                                               |
| PET_SUPPLIES_DEEP_CLEAN              | 43                                               |
| MOP_SHAKE_WATER_MAX                  | 45                                               |
| EXACT_CUSTOM_MODE                    | 47                                               |
| VIDEO_PATROL                         | 48                                               |
| CARPET_CUSTOM_CLEAN                  | 49                                               |
| PET_SNAPSHOT                         | 50                                               |
| CUSTOM_CLEAN_MODE_COUNT              | 51                                               |
| NEW_AI_RECOGNITION                   | 52                                               |
| AUTO_COLLECTION_2                    | 53                                               |
| RIGHT_BRUSH_STRETCH                  | 54                                               |
| SMART_CLEAN_MODE_SET                 | 55                                               |
| DIRTY_OBJECT_DETECT                  | 56                                               |
| NO_NEED_CARPET_PRESS_SET             | 57                                               |
| VOICE_CONTROL_LED                    | 58                                               |
| WATER_LEAK_CHECK                     | 60                                               |
| MIN_BATTERY_15_TO_CLEAN_TASK         | 62                                               |
| GAP_DEEP_CLEAN                       | 63                                               |
| OBJECT_DETECT_CHECK                  | 64                                               |
| IDENTIFY_ROOM                        | 66                                               |
| MATTER                               | 67                                               |
| WORKDAY_HOLIDAY                      | 69                                               |
| CLEAN_DIRECT_STATUS                  | 70                                               |
| MAP_ERASER                           | 71                                               |
| OPTIMIZE_BATTERY                     | 72                                               |
| ACTIVATE_VIDEO_CHARGING_AND_STANDBY  | 73                                               |
| CARPET_LONG_HAIRED                   | 75                                               |
| CLEAN_HISTORY_TIME_LINE              | 76                                               |
| MAX_ZONE_OPENED                      | 77                                               |
| EXHIBITION_FUNCTION                  | 78                                               |
| LDS_LIFTING                          | 79                                               |
| AUTO_TEAR_DOWN_MOP                   | 80                                               |
| SMALL_SIDE_MOP                       | 81                                               |
| SUPPORT_SIDE_BRUSH_UP_DOWN           | 82                                               |
| DRY_INTERVAL_TIMER                   | 83                                               |
| UVC_STERILIZE                        | 84                                               |
| MIDWAY_BACK_TO_DOCK                  | 85                                               |
| SUPPORT_MAIN_BRUSH_UP_DOWN           | 86                                               |
| EGG_DANCE_MODE                       | 87                                               |
| MECHANICAL_ARM_MODE                  | 89                                               |
| TIDYUP_ZONES                         | 89 (alias: `TIDYUP_ZONES = MECHANICAL_ARM_MODE`) |
| CLEAN_TIME_LINE                      | 91                                               |
| CLEAN_THEN_MOP_MODE                  | 93                                               |
| TYPE_IDENTIFY                        | 94                                               |
| SUPPORT_GET_PARTICULAR_STATUS        | 96                                               |
| THREE_D_MAPPING_INNER_TEST           | 97                                               |
| SYNC_SERVER_NAME                     | 98                                               |
| SHOULD_SHOW_ARM_OVER_LOAD            | 99                                               |
| COLLECT_DUST_COUNT_SHOW              | 100                                              |
| SUPPORT_API_APP_STOP_GRASP           | 101                                              |
| CTM_WITH_REPEAT                      | 102                                              |
| SIDE_BRUSH_LIFT_CARPET               | 104                                              |
| DETECT_WIRE_CARPET                   | 105                                              |
| WATER_SLIDE_MODE                     | 106                                              |
| SOAK_AND_WASH                        | 107                                              |
| CLEAN_EFFICIENCY                     | 108                                              |
| BACK_WASH_NEW_SMART                  | 109                                              |
| DUAL_BAND_WI_FI                      | 110                                              |
| PROGRAM_MODE                         | 111                                              |
| CLEAN_FLUID_DELIVERY                 | 112                                              |
| CARPET_LONG_HAIRED_EX                | 113                                              |
| OVER_SEA_CTM                         | 114                                              |
| FULL_DUPLES_SWITCH                   | 115                                              |
| LOW_AREA_ACCESS                      | 116                                              |
| FOLLOW_LOW_OBS                       | 117                                              |
| TWO_GEARS_NO_COLLISION               | 118                                              |
| CARPET_SHAPE_TYPE                    | 119                                              |
| SR_MAP                               | 120                                              |

Notes:

- Integer values 44, 46, 59, 61, 65, 68, 74, 88, 90, 92, 95, 103 have no enum member assigned (gaps in the sequence).
- `TIDYUP_ZONES` is declared as `TIDYUP_ZONES = MECHANICAL_ARM_MODE` — both resolve to 89 at runtime.

---

## Session: Investigation — forceRunAtDefault Application in Clean Mode Resolution (2026-06-27)

### Q1: Where is `forceRunAtDefault` read and what does it do?

**Primary read location:** `src/platform/platformConfigManager.ts:158–159`

```typescript
public get forceRunAtDefault(): boolean {
    return this.isAdvancedFeatureEnabled && this.advancedFeatureSettings.forceRunAtDefault;
}
```

The setting is defined in `src/model/RoborockPluginPlatformConfig.ts:47` as a boolean field in the `AdvancedFeatureSetting` interface and defaults to `false` (line 103).

**What `forceRunAtDefault = true` does:**

1. **Neutralizes device model key** (`src/share/behaviorFactory.ts:30`):
   - When true: `const modelKey = forceRunAtDefault ? '' : model;`
   - Empty model key bypasses device-specific behavior configurations

2. **Forces default mode resolver** (`src/share/runtimeHelper.ts:17–20`):
   - Returns the global `defaultModeResolver` (based on `baseCleanModeConfigs` only)
   - When false: creates a device-specific resolver via `getAllModesForDevice(key)` and `hasSmartPlan(key)`

3. **Restricts advertised clean modes** (`src/initialData/getSupportedCleanModes.ts:21–23`):
   - When true: returns only `defaultModes` (from `baseCleanModeConfigs`)
   - When false: returns device model-specific modes via `getAllModesForDevice(model, featureSet, newFeatureSet)`

4. **Bypasses device-specific smart plan support** (`src/share/runtimeHelper.ts:18–19`):
   - When true: skips `hasSmartPlan(key)` check, always uses `defaultModeResolver`
   - When false: calls `createSmartModeResolver` if `hasSmartPlan` returns true

---

### Q2: Trace the clean mode resolution path — which functions resolve the active clean mode, and does `forceRunAtDefault` appear?

**Full clean mode resolution chain:**

**Phase 1: Device Initialization & Behavior Configuration** (`src/platform/deviceConfigurator.ts:117–128`)

```typescript
const behaviorHandler = configureBehavior(
    vacuum.specs.model,
    vacuum.duid,
    roborockService,
    this.configManager.isCustomCleanModeMappingEnabled,
    this.configManager.cleanModeSettings,
    this.configManager.forceRunAtDefault,  // ← First read
    this.log,
    () => this.getPlatformRunner().burstPolling.startBurstPolling(vacuum.duid),
    vacuum.featureSet,
    vacuum.newFeatureSet,
);
```

**Phase 2: Behavior Configuration Decision** (`src/share/behaviorFactory.ts:30–31`)

```typescript
const modelKey = forceRunAtDefault ? '' : model;  // ← First decision point
const config = buildBehaviorConfig(modelKey, featureSet, newFeatureSet);
```

**Phase 3: Behavior Config Building** (`src/behaviors/roborock.vacuum/core/behaviorConfig.ts:44–45`)

```typescript
const withSmartPlan = hasSmartPlan(model, featureSet, newFeatureSet);
const allModes = getAllModesForDevice(model, featureSet, newFeatureSet);
```

Note: When `forceRunAtDefault=true`, `model` is empty string; mode registry is built with limited modes.

**Phase 4: Supported Modes Advertisement** (`src/initialData/getSupportedCleanModes.ts:21–26`)

```typescript
if (configManager.forceRunAtDefault) {
    return getDefaultSupportedCleanModes(configManager, [...defaultModes]);  // ← Second direct check
}

const supportedModes = getModeOptions(getAllModesForDevice(model, featureSet, newFeatureSet));
return getDefaultSupportedCleanModes(configManager, supportedModes);
```

**Phase 5: Runtime Mode Resolution** ← **Active during vacuum operations** (`src/runtimes/handlers/cleanModeHandler.ts:34–36`)

When device reports clean mode settings:

```typescript
const forceRunAtDefault = platform.configManager.forceRunAtDefault;  // ← Third read
const currentCleanModeResolver = getCleanModeResolver(deviceData.model, forceRunAtDefault);
const currentCleanMode = currentCleanModeResolver.resolve(currentCleanModeSetting);
```

**Phase 6: Mode Resolver Selection** (`src/share/runtimeHelper.ts:17–30`)

Final decision point:

```typescript
export function getCleanModeResolver(model: DeviceModel, forceRunAtDefault: boolean): ModeResolver {
    if (forceRunAtDefault) {
        return defaultModeResolver;  // ← Second decision point (line 19)
    }

    const key = model as string;
    if (!resolverCache.has(key)) {
        const modes = getAllModesForDevice(key);  // ← Note: NO feature sets passed
        const resolver = hasSmartPlan(key) ? createSmartModeResolver(modes) : createDefaultModeResolver(modes);
        resolverCache.set(key, resolver);
    }

    return resolverCache.get(key) as ModeResolver;
}
```

**Answer:** `forceRunAtDefault` IS present in all critical stages:

- ✓ Device initialization pass-through (deviceConfigurator.ts:123)
- ✓ Behavior config model key determination (behaviorFactory.ts:30)
- ✓ Supported modes filtering (getSupportedCleanModes.ts:21)
- ✓ Runtime mode resolution (cleanModeHandler.ts:34–35)
- ✓ Resolver selection (runtimeHelper.ts:18–19)

---

### Q3: Is there any code path where `forceRunAtDefault` is ignored or bypassed?

**Critical Finding: Feature-Set-Based Extra Modes Create a Behavioral Inconsistency**

There is a **subtle mismatch** in how feature-set-based extra modes (e.g., `vacFollowedByMopModeConfig`) are handled:

**In behavior config building** (`src/share/behaviorFactory.ts:30–31` → `buildBehaviorConfig`):

- Feature sets ARE passed through to `buildBehaviorConfig` regardless of `forceRunAtDefault`:
  ```typescript
  const config = buildBehaviorConfig(modelKey, featureSet, newFeatureSet);
  ```
- Inside `buildBehaviorConfig:44–45`:
  ```typescript
  const withSmartPlan = hasSmartPlan(model, featureSet, newFeatureSet);
  const allModes = getAllModesForDevice(model, featureSet, newFeatureSet);
  ```
- `getAllModesForDevice` → `getExtraModes` (src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts:4–13) INCLUDES feature-based extra modes:
  ```typescript
  export function getExtraModes(_model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
      const hasFeatureContext = featureSet !== undefined || newFeatureSet !== undefined;
      if (!hasFeatureContext) {
          return [];
      }
      const features = decodeFeatureSet(featureSet, newFeatureSet);
      return features.is_clean_then_mop_mode_supported ? [vacFollowedByMopModeConfig] : [];
  }
  ```

**In supported modes filtering** (`src/initialData/getSupportedCleanModes.ts:21–26`):

- When `forceRunAtDefault = true`, feature sets are NOT consulted:
  ```typescript
  if (configManager.forceRunAtDefault) {
      return getDefaultSupportedCleanModes(configManager, [...defaultModes]);
  }
  ```
- Feature-based extra modes are EXCLUDED from the advertised supported modes list

**In runtime mode resolution** (`src/share/runtimeHelper.ts:17–30`):

- `getCleanModeResolver()` does NOT receive feature sets in its signature
- Function only receives `model` and `forceRunAtDefault`
- Calls `getAllModesForDevice(key)` WITHOUT feature set parameters (line 24):
  ```typescript
  const modes = getAllModesForDevice(key);  // No featureSet, newFeatureSet
  ```
- Therefore, feature-based extra modes cannot be resolved at runtime

**Result:**

1. When `forceRunAtDefault = true`, the `buildBehavior Config` call may still include feature-based extra modes (because featureSets are passed through)
2. However, at runtime when resolving the ACTUAL clean mode, `getCleanModeResolver` cannot access those feature sets
3. The advertised supported modes also exclude feature-based modes when `forceRunAtDefault = true`

**This is NOT a bypass of `forceRunAtDefault` logic itself, but rather:**

- An architectural limitation: feature sets are not threaded to runtime resolver
- A potential inconsistency: behavior config may include feature modes, but runtime resolver cannot use them
- The `forceRunAtDefault` setting IS correctly applied in all control flow paths

---

## Confidence

**High confidence on main findings:**

- `forceRunAtDefault` is correctly read and applied across initialization and runtime paths
- It directly controls resolver selection at the critical runtime resolution point (runtimeHelper.ts:18–19)
- The setting gates access to both supported modes and active mode resolution

**Feature-set limitation is confirmed:**

- `getCleanModeResolver()` signature lacks feature set parameters
- Feature-based extra modes require feature set context to be included
- Separation of concerns: feature sets passed to config-time but not runtime

## Status

answered
