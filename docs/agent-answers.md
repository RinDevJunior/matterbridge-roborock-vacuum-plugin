## Answers

---

## Session: deviceCapabilityRegistry + featureSet data flow (2026-06-27)

### Q1: What does `deviceCapabilityRegistry.ts` export?

File: `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`

**Exported symbols:**

| Symbol                   | Kind     | Signature                                    |
| ------------------------ | -------- | -------------------------------------------- |
| `DEVICE_EXTRA_MODES`     | `const`  | `Partial<Record<string, CleanModeConfig[]>>` |
| `getExtraModes`          | function | `(model: string) => CleanModeConfig[]`       |
| `hasSmartPlan`           | function | `(model: string) => boolean`                 |
| `getAllModesForDevice`   | function | `(model: string) => CleanModeConfig[]`       |
| `getAllKnownModeConfigs` | function | `() => CleanModeConfig[]`                    |

**`DEVICE_EXTRA_MODES` table structure:**

- Key type: `string` (device model string, sourced from the `DeviceModel` enum)
- Value type: `CleanModeConfig[]` (an array of clean mode configurations)
- The record is typed `Partial<Record<string, ...>>` — models not listed return `undefined`

**Example entries (lines 28–32):**

```typescript
[DeviceModel.QREVO_EDGE_5V1]: [smartPlanModeConfig, vacFollowedByMopModeConfig],
[DeviceModel.QREVO_PLUS]:     [smartPlanModeConfig, vacFollowedByMopModeConfig],
[DeviceModel.QREVO_MAXV]:     [smartPlanModeConfig, vacFollowedByMopModeConfig],
[DeviceModel.Q10_S5_PLUS]:    [vacFollowedByMopModeConfig, vacAndMopDeepModeConfig],
```

**Function behaviors:**

- `getExtraModes(model)` — returns `DEVICE_EXTRA_MODES[model] ?? []` (empty array for unknown models)
- `hasSmartPlan(model)` — returns `true` if the model's extra modes include a config with `label === CleanModeDisplayLabel.SmartPlan`
- `getAllModesForDevice(model)` — returns `[...getExtraModes(model), ...baseCleanModeConfigs]` (extra first, then base modes)
- `getAllKnownModeConfigs()` — union of all extra modes across all models + base modes, deduplicated by `config.mode` number

**Important clarification:** This registry has **nothing to do with a `DeviceCapabilities` interface** or boolean capability flags. It is purely a clean mode configuration registry — it maps model strings to lists of extra `CleanModeConfig` objects. The word "capability" in the filename refers only to which extra clean modes a device is capable of.

---

### Q2: What interface/type does the registry return to callers?

The registry does **not** return a `DeviceCapabilities` type or any named capability interface. All four functions return either:

- `CleanModeConfig[]` — an array of clean mode descriptors
- `boolean` — for `hasSmartPlan`

**`CleanModeConfig` interface** (`src/behaviors/roborock.vacuum/core/cleanModeConfig/types.ts`):

```typescript
interface CleanModeConfig {
    mode: number;              // integer mode number (e.g. 4, 11, 12)
    label: string;             // display label (e.g. 'Smart Plan', 'Vacuum & Mop: Default')
    setting: CleanModeSetting; // what clean settings to apply when this mode is selected
    modeTags: { value: number }[]; // Matter cluster mode tags
}
```

There is **no separate `DeviceCapabilities` type** anywhere in the codebase. The concept of "device capabilities" in this file is exclusively about which extra clean mode numbers are available for a given model.

---

### Q3: Which files import from `deviceCapabilityRegistry.ts`?

Four files import from this registry:

**1. `src/share/matterStateNames.ts` (line 3)**

```typescript
import { getAllKnownModeConfigs } from '../behaviors/roborock.vacuum/core/deviceCapabilityRegistry.js';
```

- Call: `const allKnownCleanModeConfigs = getAllKnownModeConfigs()` (module-level, line 6)
- Stored as: module-level `const allKnownCleanModeConfigs: CleanModeConfig[]`
- Downstream behavior: used in `getCleanModeName(mode: number)` to resolve a numeric mode to a display label string. No capability gating — purely a name lookup.

**2. `src/share/runtimeHelper.ts` (line 2)**

```typescript
import { getAllModesForDevice, hasSmartPlan } from '../behaviors/roborock.vacuum/core/deviceCapabilityRegistry.js';
```

- Calls (lines 24–25):
  ```typescript
  const modes = getAllModesForDevice(key);
  const resolver = hasSmartPlan(key) ? createSmartModeResolver(modes) : createDefaultModeResolver(modes);
  ```
- Stored: resolver cached in `resolverCache: Map<string, ModeResolver>` per model
- Downstream behavior: `getCleanModeResolver(model, forceRunAtDefault)` returns either a smart or default `ModeResolver`. The `ModeResolver` is then used in `cleanModeHandler.ts` (line 35) to map Matter clean mode numbers to Roborock commands.

**3. `src/initialData/getSupportedCleanModes.ts` (line 9)**

```typescript
import { getAllModesForDevice } from '../behaviors/roborock.vacuum/core/deviceCapabilityRegistry.js';
```

- Call (line 23): `const supportedModes = getModeOptions(getAllModesForDevice(model))`
- Downstream behavior: `RoborockVacuumCleaner.initializeDeviceConfiguration` (line 144) calls this to populate the `RvcCleanMode` cluster's `supportedModes` attribute on the Matter endpoint. Controls which clean modes are advertised to Matter controllers.

**4. `src/behaviors/roborock.vacuum/core/behaviorConfig.ts` (line 15)**

```typescript
import { getAllModesForDevice, hasSmartPlan } from './deviceCapabilityRegistry.js';
```

- Calls (lines 44–45):
  ```typescript
  const withSmartPlan = hasSmartPlan(model);
  const allModes = getAllModesForDevice(model);
  ```
- Downstream behavior gating:
  - `withSmartPlan === true` → adds `SmartPlanHandler` to the `ModeHandlerRegistry` and names config `'BehaviorSmart'`; otherwise uses `'DefaultBehavior'`
  - `allModes` → populates `config.cleanModes` (mode-number-to-label map) and `config.cleanSettings` (mode-number-to-settings map), controlling how Matter `changeToMode` commands are dispatched to Roborock

---

### Q4: Full `DeviceFeatures` interface and mapping against registry capability flags

File: `src/share/featureSetDecoder.ts` lines 1–192

`DeviceFeatures` has **162 boolean properties** + **3 raw diagnostic fields** across 7 groups:

- **Group A** (25 flags): lower 32 bits of `featureSet` — decoded via bitmask against `Number(featureInt & 0xffffffffn)`
- **Group B** (17 flags): upper 32 bits of `featureSet` — decoded via `(upper32 >> bitIndex) & 1`
- **Group C** (27 flags): last 8 hex chars of `newFeatureSet` — decoded via bitmask against `parseInt(hexStr.slice(-8), 16)`
- **Group D** (79 flags): nibble-index extraction from full `newFeatureSet` string — decoded via `extractNibbleBit(hexStr, bitIndex)`
- **Group E** (7 flags): always `false` in this decoder (requires `APP_GET_INIT_STATUS`)
- **Group F** (10 flags): always `false` in this decoder (requires model whitelist/blacklist data)
- **Group G** (8 flags): always `false` in this decoder (requires product features data)
- **Raw fields**: `newFeatureInfo: bigint`, `newFeatureInfoStr: string`, `featureInfo: number[]`

**Mapping `DeviceFeatures` flags to registry "capabilities":**

The registry does not use boolean capability flags at all — it uses static model-string membership. The functional equivalents would be:

| Registry concept                                                              | Closest `DeviceFeatures` flag                                                | Assessment                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hasSmartPlan` (mode 4) — models `QREVO_EDGE_5V1`, `QREVO_PLUS`, `QREVO_MAXV` | None                                                                         | **No equivalent.** No flag in any of Groups A–G is named `is_smart_plan_supported`. Model-name-only.                                                                                           |
| `vacFollowedByMopModeConfig` (mode 11)                                        | `is_clean_then_mop_mode_supported` (Group D, `extractNibbleBit(hexStr, 93)`) | **Best candidate** — "clean then mop" is functionally "vac followed by mop". Needs real device data to confirm.                                                                                |
| `vacAndMopDeepModeConfig` (mode 12) — model `Q10_S5_PLUS` only                | None definitive                                                              | **No direct equivalent.** `is_carpet_deep_clean_supported` (Group C) and `is_clean_route_deep_slow_plus_supported` (Group C) are thematically adjacent but not mode-specific. Model-name-only. |

---

### Q5: Where is the capability registry called — exact call sites and model string source

The registry functions are called from four places. In every case, the model is passed as a plain `string` (the `DeviceModel` enum is a string enum). The `Device` DTO availability at each call site:

**Call site 1 — `src/platform/deviceConfigurator.ts:117–118`**

```typescript
const behaviorHandler = configureBehavior(
    vacuum.specs.model,   // ← DeviceModel from Device.specs.model
    vacuum.duid,
    ...
);
```

- `vacuum` is typed as `Device` — `vacuum.featureSet` and `vacuum.newFeatureSet` are available directly at this same call site, no threading needed.

**Call site 2 — `src/types/roborockVacuumCleaner.ts:144`**

```typescript
const cleanModes = getSupportedCleanModes(device.specs.model, configManager);
```

- `device` is typed as `Device` — `device.featureSet` and `device.newFeatureSet` are available at the same call site, no threading needed.
- This is inside `RoborockVacuumCleaner.initializeDeviceConfiguration(device, ...)`.

**Call site 3 — `src/runtimes/handlers/cleanModeHandler.ts:35`**

```typescript
const currentCleanModeResolver = getCleanModeResolver(deviceData.model, forceRunAtDefault);
```

- `deviceData` is typed as `DeviceSpecs`, not `Device`. `DeviceSpecs` does **not** carry `featureSet`/`newFeatureSet`. To access feature flags here, the full `Device` DTO would need to be threaded in.

**Call site 4 — `src/share/matterStateNames.ts:6` (module-level)**

```typescript
const allKnownCleanModeConfigs = getAllKnownModeConfigs();
```

- No model or device passed. Static/model-agnostic. Not applicable.

**Summary:**

- Call sites 1 and 2: `Device` DTO in scope — `featureSet` and `newFeatureSet` accessible without threading.
- Call site 3: only `DeviceSpecs` in scope — `featureSet`/`newFeatureSet` not accessible without additional threading.
- Call site 4: no device context.

---

### Q6: Domain entity representing a device in the behavior layer

There is **no separate domain entity class** in `src/behaviors/` or `src/core/` that wraps a device. The behavior layer operates directly on the `Device` interface and its sub-interface `DeviceSpecs`.

**`DeviceSpecs`** (`src/roborockCommunication/models/device.ts:9–18`) — used at the clean-mode handler call site:

```typescript
interface DeviceSpecs {
    id: string;
    firmwareVersion: string;
    protocol: string;
    serialNumber: string;
    model: DeviceModel;
    category: DeviceCategory;
    batteryLevel: number;
    hasRealTimeConnection: boolean;
}
```

- Does **not** carry `featureSet` or `newFeatureSet`.

**`Device`** (`src/roborockCommunication/models/device.ts:32–61`) — the full DTO used at configuration call sites:

```typescript
interface Device {
    duid: string;
    name: string;
    sn: string;
    serialNumber: string;
    featureSet?: string;       // present, optional
    newFeatureSet?: string;    // present, optional
    silentOtaSwitch?: boolean;
    activeTime: number;
    createTime: number;
    localKey: string;
    pv: string;
    online: boolean;
    productId: string;
    rrHomeId: number;
    fv: string;
    deviceStatus: Record<string, DeviceStatusResponsetype>;
    schema: DeviceSchema[];
    specs: DeviceSpecs;
    store: DeviceInformation;
    scenes?: Scene[];
    mapInfos: MapEntry[] | undefined;
}
```

The closest to a "behavior-layer entity" is `RoborockVacuumCleaner` (`src/types/roborockVacuumCleaner.ts`), which holds `this.device: Device` internally and wraps it with Matter endpoint logic. It exposes `device.specs.model` at the `getSupportedCleanModes` call site (line 144).

---

### Q7: How the `Device` DTO flows from home-data API response into the behavior layer

**Step 1 — API response → raw Home object**

`RoborockIoTApi.getHomeWithProducts()` (`src/roborockCommunication/api/iotClient.ts`) calls `getHome()` / `getHomev2()` / `getHomev3()` and returns a `Home` object. The API response is parsed by axios and typed directly as `Home` (which contains `devices: Device[]`). The `featureSet` and `newFeatureSet` fields are raw JSON from the Roborock API and map directly to `Device` interface fields (lines 38–39 of `device.ts`). No transformation is applied — they are preserved verbatim via JSON deserialization.

**Step 2 — enrichment in `DeviceManagementService.listDevices()`** (`src/services/deviceManagementService.ts:67–96`)

Each raw device is spread into an enriched `Device` object:

```typescript
return {
    ...device,            // ← featureSet and newFeatureSet preserved here
    rrHomeId: homeInfo.rrHomeId,
    specs: { id: device.duid, model: ..., ... },   // does NOT include featureSet
    store: { userData: ..., homeData: ... },
} satisfies Device;
```

The `...device` spread preserves `featureSet` and `newFeatureSet` verbatim. The `specs` sub-object is built from separate fields and does not copy them.

**Step 3 — storage in `DeviceRegistry`**

The enriched `Device[]` from `listDevices()` is stored in `DeviceRegistry` and iterated in `DeviceConfigurator.onConfigureDevice()`.

**Step 4 — retrieval at capability registry call sites**

- `deviceConfigurator.ts:117`: `vacuum` is the full `Device` — `vacuum.featureSet` and `vacuum.newFeatureSet` in scope.
- `roborockVacuumCleaner.ts:144`: `device` is the full `Device` passed to `RoborockVacuumCleaner` — `device.featureSet` and `device.newFeatureSet` in scope.

**`featureSet`/`newFeatureSet` preservation at each step:**

| Step         | Component                                                                | Preserved?                                     |
| ------------ | ------------------------------------------------------------------------ | ---------------------------------------------- |
| API response | `RoborockIoTApi` axios JSON parse                                        | Yes — raw JSON mapped directly                 |
| Enrichment   | `DeviceManagementService.listDevices` spread (`...device`)               | Yes                                            |
| Storage      | `DeviceRegistry`                                                         | Yes — full `Device` stored                     |
| Call site 1  | `DeviceConfigurator.configureDevice` (`vacuum: Device`)                  | Yes — in scope                                 |
| Call site 2  | `RoborockVacuumCleaner.initializeDeviceConfiguration` (`device: Device`) | Yes — in scope                                 |
| Call site 3  | `cleanModeHandler.ts` (`deviceData: DeviceSpecs`)                        | No — `DeviceSpecs` does not carry these fields |

---

### Q8: Capabilities in the static registry that have no `DeviceFeatures` flag equivalent

The registry returns two categories: `CleanModeConfig[]` lists and the derived `hasSmartPlan` boolean. Mapping each:

**1. Smart Plan mode (mode 4) — `hasSmartPlan` / `smartPlanModeConfig`**

- Models: `QREVO_EDGE_5V1`, `QREVO_PLUS`, `QREVO_MAXV`
- `DeviceFeatures` equivalent: **None.** No `is_smart_plan_supported` or semantically equivalent flag exists in Groups A–G.
- Verdict: **Truly model-name-only.**

**2. VacFollowedByMop mode (mode 11) — `vacFollowedByMopModeConfig`**

- Models: `QREVO_EDGE_5V1`, `QREVO_PLUS`, `QREVO_MAXV`, `Q10_S5_PLUS`
- `DeviceFeatures` closest equivalent: `is_clean_then_mop_mode_supported` (Group D, `extractNibbleBit(hexStr, 93)`)
- Verdict: **Partial match** — semantically the same concept; whether bit 93 is reliably set for these models needs validation against real device data.

**3. VacAndMopDeep mode (mode 12) — `vacAndMopDeepModeConfig`**

- Models: `Q10_S5_PLUS` only
- `DeviceFeatures` closest candidates: `is_carpet_deep_clean_supported` (Group C, mask 8) or `is_clean_route_deep_slow_plus_supported` (Group C, mask 16777216) — neither is specifically a "deep vac+mop mode."
- Verdict: **No direct equivalent. Truly model-name-only.**

**Recommendation for the planner:**

A **hybrid approach** is required:

- Smart Plan support: keep static model-string lookup — no flag exists to replace it.
- VacAndMopDeep support: keep static model-string lookup — no flag exists.
- VacFollowedByMop support: could potentially use `is_clean_then_mop_mode_supported` (bit 93) but needs validation; fall back to static if flag is absent.

---

## Confidence

- Q1: High. All exports read directly from source.
- Q2: High. `CleanModeConfig` interface read directly. Confirmed no `DeviceCapabilities` type exists anywhere.
- Q3: High. All four import sites found by grep and read in full.
- Q4: High on interface definition. Flag-to-mode mapping is best-effort semantic matching; VacFollowedByMop / `is_clean_then_mop_mode_supported` mapping needs real device data to confirm.
- Q5: High. All call sites traced. `DeviceSpecs` limitation at call site 3 is confirmed by reading the `DeviceSpecs` interface.
- Q6: High. No separate domain entity class exists — confirmed by reading `device.ts` and the behavior-layer files.
- Q7: High. The `...device` spread in `DeviceManagementService.listDevices()` line 68 is confirmed to preserve `featureSet`/`newFeatureSet`.
- Q8: High on Smart Plan and VacAndMopDeep being model-name-only. VacFollowedByMop has a plausible flag candidate that is unconfirmed.

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
