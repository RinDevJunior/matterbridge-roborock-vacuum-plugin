# Source Code Restructuring Recommendations

> Generated: 2026-03-28
> Status: Proposal — not yet implemented
> Overall architecture rating: **A (Excellent)** — changes are improvements, not fixes

---

## Summary

The codebase follows a clean hexagonal architecture (ports & adapters) with proper dependency direction, no circular dependencies, and comprehensive test coverage (185 test files). The recommendations below are targeted improvements, not overhauls.

---

## Priority 1 — Split `platformRunner.ts` (562 LOC)

**Problem:** Single file handles message routing, device dispatch, and state handling — too many responsibilities.

### What stays in `PlatformRunner` (~80 LOC)

Orchestration only:

```
PlatformRunner
  ├── constructor + burstPolling
  ├── activateHandlerFunctions()
  ├── requestHomeData()
  ├── updateRobotWithPayload()   ← dispatcher switch
  ├── executeWithRobot()         ← template method
  └── getRobotOrLogError()
```

### What gets extracted to `src/runtimes/handlers/`

| File                     | Extracted from                                                | LOC  | Owns                                                                                  |
| ------------------------ | ------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `errorStateHandler.ts`   | `handleErrorOccurred`                                         | ~115 | Vacuum error priority, dock station fallback, `DockStationStatus` parsing             |
| `batteryStateHandler.ts` | `handleBatteryUpdate`                                         | ~45  | `batPercentRemaining`, `batChargeLevel`, `batChargeState`, Charging→Docked transition |
| `deviceStateHandler.ts`  | `handleDeviceStatusUpdate` + `handleDeviceStatusSimpleUpdate` | ~97  | State resolution matrix, returns `boolean` for burst polling decision                 |
| `cleanModeHandler.ts`    | `handleCleanModeUpdate`                                       | ~33  | Clean mode settings, `CleanModeSetting`, resolver                                     |
| `serviceAreaHandler.ts`  | `handleServiceAreaUpdate` + 3 private helpers                 | ~111 | `CLEANING_STATES` const, area resolution, cleaning info mapping                       |

All handlers are **pure exported functions**, not classes:

```ts
// example signature pattern
export async function handleErrorOccurred(
  robot: RoborockVacuumCleaner,
  message: DeviceErrorMessage,
  platform: RoborockMatterbridgePlatform,
): Promise<void>

// deviceStateHandler returns shouldStartBurstPolling to keep burstPolling control in PlatformRunner
export async function handleDeviceStatusUpdate(...): Promise<boolean>
```

`CLEANING_STATES` moves from a class static to a module-level const in `serviceAreaHandler.ts`.

`burstPolling.startBurstPolling` stays in `PlatformRunner` — `deviceStateHandler` signals via return value.

### `updateRobotWithPayload` after split

```ts
case NotifyMessageTypes.DeviceStatus:
  await this.executeWithRobot(payload.data.duid, payload.data, async (robot, data) => {
    const shouldBurst = await handleDeviceStatusUpdate(robot, data, this.platform);
    if (shouldBurst && !this.burstPolling.has(robot.device.duid))
      this.burstPolling.startBurstPolling(robot.device.duid);
  });
  break;
```

### Migration order (safest)

1. `serviceAreaHandler.ts` — already partially documented in `handleServiceAreaUpdate.md`
2. `errorStateHandler.ts` — highest LOC, highest test value
3. `deviceStateHandler.ts` — careful with `burstPolling` return value
4. `batteryStateHandler.ts` + `cleanModeHandler.ts` — simple, low risk

Each step: move code → fix imports → `npm run build` → `npm test` → commit.

**Benefit:** Each file has a single reason to change. `PlatformRunner` becomes a pure dispatcher (~80 LOC). Handlers are independently testable pure functions.

---

## Priority 2 — Flatten `roborockCommunication/models/` (35 files)

**Problem:** 35 flat files in one directory is hard to navigate and doesn't communicate grouping.

**Proposed structure:**

```
roborockCommunication/models/
  cleaning/    → clean mode, zone, segment models
  device/      → device info, capability models
  map/         → map data, room, obstacle models
  status/      → state, error, consumable models
```

**Benefit:** Discoverability — find related models without searching 35 files.

---

## Priority 3 — Consolidate Model Scatter

**Problem:** Models are spread across 4 locations with overlapping concerns:

- `src/model/`
- `src/roborockCommunication/models/`
- `src/core/application/models/`
- `src/core/domain/entities/`

**Proposed rule:**

- `core/domain/entities/` — true domain entities only (no API shapes)
- `core/application/models/` — application-layer DTOs
- `roborockCommunication/models/` — external API response/request shapes
- `src/model/` — eliminate; move files to appropriate layer above

**Benefit:** Clear boundary — where a model lives signals what layer owns it.

---

## Priority 4 — Split `cleanModeConfig.ts` (383 LOC)

**Problem:** Single dense data file covering all device families.

**Proposed split:**

```
src/constants/cleanModeConfig/
  index.ts       → re-exports all
  seriesS.ts     → S series config
  seriesQ.ts     → Q series config
  seriesP.ts     → P series config
  ...
```

**Benefit:** Adding a new device family touches one file, not a 383-line monolith.

---

## Priority 5 — Extract lookup tables from `stateResolver.ts` (339 LOC)

**Problem:** Logic and data mixed in the same file.

**Proposed split:**

```
src/
  stateResolver.ts    → pure resolution logic (~150 LOC)
  stateMap.ts         → static lookup tables / enums
```

**Benefit:** `stateMap.ts` becomes a reference document; `stateResolver.ts` is pure logic, easier to test.

---

## What NOT to Change

| File/Module                     | Reason to keep as-is                       |
| ------------------------------- | ------------------------------------------ |
| `serviceContainer.ts` (261 LOC) | Central DI — appropriate size for its role |
| `behaviors/` (23 files)         | Well-bounded, one behavior per file        |
| `services/` (19 files)          | Clean single-responsibility services       |
| `core/` ports & interfaces      | Hexagonal boundary working correctly       |
| `cli/` module                   | Well-isolated from main codebase           |

---

## Implementation Notes

- Each refactor should be done as an **independent PR** — never mix restructuring with feature work.
- Move files → update imports → run `npm run build` and `npm test` before committing.
- `platformRunner.ts` split (Priority 1) has the highest test coverage risk — ensure runtimes tests pass after.
