# Plan: Split `platformRunner.ts` into Handler Modules

> Created: 2026-04-04
> Status: Done (Session 18)
> Priority: 1 (from refactoring-recommendations.md)
> Risk: Medium — 3 test files cover this code (platformRunner.test.ts, platformRunner2.test.ts, platformRunner3.test.ts)

---

## Context

**Source file:** `src/platformRunner.ts` (562 LOC, private class methods)
**Target directory:** `src/runtimes/handlers/` (new directory, pure exported functions)
**Test files:** `src/tests/platformRunner.test.ts` (1442 LOC), `platformRunner2.test.ts` (657 LOC), `platformRunner3.test.ts` (107 LOC)
**Rule per recommendations:** Each step → move code → fix imports → `npm run build` → `npm test` → commit

---

## Phase 0: Documentation Discovery (DONE)

### Confirmed Facts

**Handler locations in `src/platformRunner.ts`:**

| Function                                                      | Lines   | Extracts to              |
| ------------------------------------------------------------- | ------- | ------------------------ |
| `handleServiceAreaUpdate` + 3 helpers                         | 451–561 | `serviceAreaHandler.ts`  |
| `handleErrorOccurred`                                         | 142–256 | `errorStateHandler.ts`   |
| `handleDeviceStatusUpdate` + `handleDeviceStatusSimpleUpdate` | 311–407 | `deviceStateHandler.ts`  |
| `handleBatteryUpdate`                                         | 261–305 | `batteryStateHandler.ts` |
| `handleCleanModeUpdate`                                       | 413–445 | `cleanModeHandler.ts`    |

**What stays in PlatformRunner (~80 LOC):**
`constructor`, `burstPolling`, `activateHandlerFunctions()`, `requestHomeData()`, `updateRobotWithPayload()` (dispatcher), `executeWithRobot()`, `getRobotOrLogError()`

**Key import block** (lines 1–30 of platformRunner.ts) — all imports must be split between the handler files and the remaining platformRunner.ts.

**Pattern for extracted functions:**

```ts
export async function handleErrorOccurred(
  robot: RoborockVacuumCleaner,
  message: DeviceErrorMessage,
  platform: RoborockMatterbridgePlatform,
): Promise<void>

// deviceStateHandler returns boolean for burstPolling control
export async function handleDeviceStatusUpdate(...): Promise<boolean>
export async function handleDeviceStatusSimpleUpdate(...): Promise<void>
```

**`CLEANING_STATES`** moves from class static → module-level `const` in `serviceAreaHandler.ts`.
**`burstPolling.startBurstPolling`** stays in `PlatformRunner`; `deviceStateHandler` signals via `boolean` return.

**Anti-patterns to avoid:**

- Do NOT import handler files circularly back into platformRunner
- Do NOT make handlers classes — pure exported functions only
- Do NOT mix multiple handler extractions in one commit

---

## Phase 1: Extract `serviceAreaHandler.ts`

**Why first:** Largest helper cluster (111 LOC + 3 private helpers), partially documented in existing notes.

### Tasks

1. Create `src/runtimes/handlers/serviceAreaHandler.ts`
2. Move these from `platformRunner.ts`:
   - `handleServiceAreaUpdate` (lines 451–477) → exported function
   - `getSelectedAreas` (lines 478–484) → exported or module-private
   - `handleCleaningWithoutInfo` (lines 486–511) → exported or module-private
   - `resolveAreaFromCleaningInfo` (lines 513–561) → exported or module-private
   - `CLEANING_STATES` static const → module-level `const` at top of new file
3. Add required imports to `serviceAreaHandler.ts` (resolve from platformRunner.ts import block)
4. In `platformRunner.ts`:
   - Delete extracted code
   - Add `import { handleServiceAreaUpdate } from './handlers/serviceAreaHandler.js'`
   - Update `updateRobotWithPayload` dispatch case to call imported function
5. Run: `npm run build && npm test`
6. Commit: `refactor: extract serviceAreaHandler from platformRunner`

### Verification

- `npm run build` exits 0
- `npm test` passes all 3 platformRunner test files
- `grep -n "handleServiceAreaUpdate\|getSelectedAreas\|CLEANING_STATES" src/platformRunner.ts` returns only the import and dispatch call

---

## Phase 2: Extract `errorStateHandler.ts`

**Why second:** Highest LOC handler (115 LOC), highest test value.

### Tasks

1. Create `src/runtimes/handlers/errorStateHandler.ts`
2. Move `handleErrorOccurred` (lines 142–256) → exported function
3. Required imports to carry over: `DockStationStatus`, `DockErrorCode`, `OperationStatusCode`, `DeviceErrorMessage`, `triggerDssError`, `getOperationalErrorName`, `RoborockMatterbridgePlatform`, `RoborockVacuumCleaner`
4. In `platformRunner.ts`:
   - Delete `handleErrorOccurred`
   - Add import from `./handlers/errorStateHandler.js`
   - Update dispatch case
5. Run: `npm run build && npm test`
6. Commit: `refactor: extract errorStateHandler from platformRunner`

### Verification

- `grep -n "handleErrorOccurred" src/platformRunner.ts` returns only import + 1 dispatch call

---

## Phase 3: Extract `deviceStateHandler.ts`

**Why third:** Careful — `handleDeviceStatusUpdate` must return `boolean` for `burstPolling` signal.

### Tasks

1. Create `src/runtimes/handlers/deviceStateHandler.ts`
2. Move:
   - `handleDeviceStatusUpdate` (lines 311–370) → `export async function`: **must return `boolean`**
   - `handleDeviceStatusSimpleUpdate` (lines 377–407) → exported function
3. Required imports: `resolveDeviceState`, `state_to_matter_operational_status`, `state_to_matter_state`, `getOperationalStateName`, `getRunModeName`, `getRunModeNameV2`, `StatusChangeMessage`, `VacuumStatus`, `RvcOperationalState`, `RvcRunMode`, `RvcCleanMode`, `RoborockMatterbridgePlatform`, `RoborockVacuumCleaner`
4. In `platformRunner.ts`, update `updateRobotWithPayload` DeviceStatus case:
   ```ts
   case NotifyMessageTypes.DeviceStatus:
     await this.executeWithRobot(payload.data.duid, payload.data, async (robot, data) => {
       const shouldBurst = await handleDeviceStatusUpdate(robot, data, this.platform);
       if (shouldBurst && !this.burstPolling.has(robot.device.duid))
         this.burstPolling.startBurstPolling(robot.device.duid);
     });
     break;
   ```
5. Run: `npm run build && npm test`
6. Commit: `refactor: extract deviceStateHandler from platformRunner`

### Verification

- `grep -n "burstPolling" src/platformRunner.ts` still shows burst polling logic in PlatformRunner
- All burst polling tests pass

---

## Phase 4: Extract `batteryStateHandler.ts` + `cleanModeHandler.ts`

**Why last:** Smallest handlers, low risk — do both in one phase (separate files, one commit each).

### Step A — `batteryStateHandler.ts`

1. Create `src/runtimes/handlers/batteryStateHandler.ts`
2. Move `handleBatteryUpdate` (lines 261–305) → exported function
3. Required imports: `BatteryMessage`, `getBatteryState`, `getBatteryStatus`, `PowerSource`, `RoborockMatterbridgePlatform`, `RoborockVacuumCleaner`
4. Update platformRunner.ts dispatch + import
5. Commit: `refactor: extract batteryStateHandler from platformRunner`

### Step B — `cleanModeHandler.ts`

1. Create `src/runtimes/handlers/cleanModeHandler.ts`
2. Move `handleCleanModeUpdate` (lines 413–445) → exported function
3. Required imports: `CleanModeSetting`, `CleanSequenceType`, `getCleanModeName`, `getCleanModeResolver`, `RvcCleanMode`, `RoborockMatterbridgePlatform`, `RoborockVacuumCleaner`
4. Update platformRunner.ts dispatch + import
5. Commit: `refactor: extract cleanModeHandler from platformRunner`

### Verification

- `npm run build && npm test` passes after each commit
- `wc -l src/platformRunner.ts` should be ~80–120 LOC

---

## Phase 5: Final Verification

1. Count LOC: `wc -l src/platformRunner.ts` — expect ≤ 120
2. Check no private handler methods remain: `grep -n "private.*handle" src/platformRunner.ts` → 0 results
3. Run full test suite: `npm test`
4. Run lint: `npm run lint`
5. Run build: `npm run build`
6. Verify new handler files exist:
   ```
   src/runtimes/handlers/serviceAreaHandler.ts
   src/runtimes/handlers/errorStateHandler.ts
   src/runtimes/handlers/deviceStateHandler.ts
   src/runtimes/handlers/batteryStateHandler.ts
   src/runtimes/handlers/cleanModeHandler.ts
   ```
7. Update `docs/CODE_STRUCTURE.md` to document new `src/runtimes/handlers/` directory
8. Update `docs/to_do.md` — mark Priority 1 complete

---

## Execution Order Summary

```
Phase 1 → serviceAreaHandler   (111 LOC, 3 helpers)  commit
Phase 2 → errorStateHandler    (115 LOC)             commit
Phase 3 → deviceStateHandler   (97 LOC, bool return) commit
Phase 4A → batteryStateHandler (45 LOC)              commit
Phase 4B → cleanModeHandler    (33 LOC)              commit
Phase 5 → verify + docs update
```

**Never mix phases.** Build and test after every extraction before starting the next.
