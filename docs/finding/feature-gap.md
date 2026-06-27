# Feature Gap Analysis: Reference vs Current Plugin

**Reference:** `/Volumes/ExternalSSD/code/references/matterbridge-xiaomi-roborock/`
**Current:** `/Volumes/ExternalSSD/code/matterbridge-roborock-vacuum-plugin/`
**Date:** 2026-06-27

---

## Protocol Context

The two plugins are **not equivalent by design**. The reference uses `node-miio` (local IP + token, Mi/Xiaomi-branded devices, Viomi, Dreame). The current plugin uses Roborock-proprietary MQTT + local TCP via cloud account. Features that are miio-specific (timer-based room discovery, Viomi/Dreame device support, per-device IP/token config) are out of scope for the current plugin and are excluded from the gaps below.

---

## Functional Gaps (Present in Reference, Missing or Incomplete in Current)

### Gap 1 — `selectAreas` All-Selected Normalization

**Severity:** Low-Medium

**Reference behavior:**

```typescript
// vacuum_device_accessory.ts
let selectedAreas = data.request.newAreas;
if ((data.attributes.supportedAreas as ServiceArea.Area[])?.length === selectedAreas.length) {
  selectedAreas = []; // Force empty if all areas are selected
}
await this.endpoint?.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', selectedAreas);
```

When all supported areas are selected, the reference normalizes the list to an empty array. This signals "full clean" rather than "room-specific clean with all rooms listed."

**Current plugin behavior:**
`src/behaviors/roborock.vacuum/core/commonCommands.ts` line 14–17 stores whatever `newAreas` value arrives, with no normalization.

**File to change:** `src/behaviors/roborock.vacuum/core/commonCommands.ts`

**Open question:** Verify whether the Roborock API treats "all rooms selected" and "no rooms selected (full clean)" identically at the command level. If so, this gap has no behavioral impact.

---

### Gap 2 — `ChargingError` (Status Code 9) Does Not Set `FailedToFindChargingDock`

**Status: ✅ CLOSED** — Fixed in commit `9e5b05e` (`fix: set operationalError for ChargingError status code 9`).

~~**Severity:** Medium~~

The current plugin correctly sets `operationalError = FailedToFindChargingDock` when `OperationStatusCode.ChargingError = 9` is received. No further action required.

---

### Gap 3 — Firmware-Version-Aware Device Capability Selection

**Severity:** Low (all currently supported models are recent; old firmware variants are not in the device registry)

**Reference behavior:**

```typescript
// models/models.ts
'roborock.vacuum.s5': [
  { speed: speedmodes.gen2 },                           // pre-3.5.7
  { firmware: '>=3.5.7', speed: speedmodes.gen4 },     // 3.5.7+
],
```

`findSpeedModes(model, fw_ver)` uses semver to pick the correct speed profile for the device's firmware version.

**Current plugin behavior:**
`src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts` maps model strings to a single capability set. No firmware version branching exists.

**File to change:** `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts` — extend registry entries to support an optional `firmware` semver constraint; select the first matching entry during device initialization.

**Dependency:** Firmware version must be available at capability-selection time. It is not currently stored in the `Device` entity or passed to the capability registry. Would require threading `fw_ver` from device initialization through to `getAllModesForDevice()`.

**Complexity:** Complex (multi-file change)

---

### Gap 4 — `roomNames` Config Override for Manual Room Name Assignment

**Status: 🟡 OPEN — deferred until a user reports this**

**Severity:** Low

---

#### Business Issue

Room names shown in Apple Home come from the Roborock cloud API (`iot_name` field in `RoomMapping`). If the cloud returns a null or empty name for a room, the plugin falls back to a random string like `"Unknown Room 4823"` — and that random number changes every restart because it is generated with `randomInt(1000, 9999)` from `node:crypto`.

The user sees unstable, randomized room labels in Apple Home with no way to fix them through the plugin config. They would have to rename the room in the Roborock app and hope the cloud API starts returning a valid name.

**Trigger condition:** only manifests if the Roborock cloud API returns a null or empty `iot_name`. It is not yet confirmed whether this happens in practice. Defer implementation until a user reports seeing "Unknown Room" labels.

---

#### Investigation Findings (2026-06-27)

**Name resolution flow** — `src/initialData/getSupportedAreas.ts:109–113` (`processValidData`):

1. Use `room.iot_name` if present
2. Fall back to secondary lookup by `iot_name_id`
3. Fall back to `` `Unknown Room ${randomInt(1000, 9999)}` ``

**`RoomMapping` shape** — `src/core/application/models/RoomMapping.ts`:

```typescript
id: number           // stable numeric room ID — best key for a user override map
iot_name_id: string  // alternate key (composite: `${id}-${iot_map_id}` used internally)
tag: number
iot_map_id: number
iot_name?: string    // cloud-provided name, may be null/empty
```

**Call sites** — `getSupportedAreas` is called from:

- `areaManagementService.getMapInfo` (line 113)
- `areaManagementService.getRoomMap` (line 139)
- `mapInfoListener.updateAreas` (line 195)

Results flow into `AreaManagementService` in-memory Maps → `serviceAreaHandler.ts` → Matter endpoints. No persistence layer exists, so the override must be injected inside `processValidData` before the name propagates.

**Config type** — `src/model/RoborockPluginPlatformConfig.ts`: no `roomNames` field anywhere in the type hierarchy. Config is deserialized via a bare `as` cast in `module.ts:31` (no runtime validation).

**Schema file** — `matterbridge-roborock-vacuum-plugin.schema.json`. New settings sections use JSON Schema `if/then` blocks under `advancedFeature.allOf`.

---

#### Implementation Plan (ready to execute)

| Step | File                                              | Change                                                                         |
| ---- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | `src/model/RoborockPluginPlatformConfig.ts`       | Add `roomNames?: Array<{ id: number; name: string }>` to `PluginConfiguration` |
| 2    | `src/initialData/getSupportedAreas.ts:109–113`    | Inject override lookup before fallback triggers in `processValidData`          |
| 3    | `matterbridge-roborock-vacuum-plugin.schema.json` | Add field under `advancedFeature.allOf` using `if/then` block                  |

**Pattern to follow:** `DeviceProductNameOverride[]` inside `matterOverrideSettings` — an array of `{ serialNumber, productName }` objects gated by `overrideMatterConfiguration: true`. Room override follows the same shape: `{ id: number; name: string }`.

**Complexity:** Simple

---

### Gap 5 — `FullyCharged` (Status Code 100) Has No Explicit State Entry

**Status: ✅ CLOSED** — Already implemented in `src/share/function.ts`.

- Line 31 (`matterStateMap`): `[OperationStatusCode.FullyCharged, RvcRunMode.ModeTag.Idle]`
- Line 70 (`matterOperationalStatusMap`): `[OperationStatusCode.FullyCharged, RvcOperationalState.OperationalState.Docked]`

Both explicit entries are present. No action required.

---

## Open Questions for Engineering Decision

- [ ] **Gap 1:** Does the Roborock API treat "all rooms" and "no rooms (full clean)" identically? If yes, Gap 1 has no user-visible impact and can be deprioritized.
- [x] **Gap 2:** Resolved — `FailedToFindChargingDock` is now correctly set for `ChargingError` status code 9 (commit `9e5b05e`).
- [ ] **Gap 3:** Is firmware-aware capability selection needed for currently supported models? None of the Roborock-branded models in the current registry have documented firmware-split capability sets. This gap only matters if older firmware variants behave differently.
- [ ] **Gap 4:** Are there known cases where the Roborock cloud API returns null/empty `iot_name` values for rooms? If not, the manual override has no practical benefit.

---

## What the Current Plugin Has That the Reference Lacks

The current plugin is substantially more capable. Key capabilities not present in the reference:

| Capability              | Current Plugin                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| State resolution        | 47-state matrix with 5 modifier flags (`inCleaning`, `isExploring`, `inReturning`, `inWarmup`, `inFreshState`) |
| Operational states      | `EmptyingDustBin`, `CleaningMop`, `UpdatingMaps` (Matter 1.3+ extended states)                                 |
| Dock station errors     | Bit-field parsing for water box, dust bag, dirty/clear water tank                                              |
| Vacuum error codes      | Full error code → `RvcOperationalState.ErrorState` mapping                                                     |
| Multiple map support    | Service areas with per-map IDs, floor numbers, active map tracking                                             |
| Scenes as rooms         | Roborock routines exposed as `ServiceArea` areas                                                               |
| Room namespace tags     | Bedroom, kitchen, balcony, etc. from Roborock room type codes                                                  |
| Clean mode system       | suctionPower + waterFlow + distanceOff + mopRoute + seqType combinations                                       |
| Smart plans             | `smartPlan`, `vacFollowedByMop`, `vacAndMopDeep` clean modes                                                   |
| Authentication          | Email + 2FA or password, token refresh, secure credential storage                                              |
| Device filtering        | White list / black list by device DUID                                                                         |
| Matter overrides        | Vendor name, vendor ID, product name, product ID per device                                                    |
| Email notifications     | SMTP-based error/event notifications                                                                           |
| Live map updates        | `enableLiveMapUpdates` flag                                                                                    |
| CLI tool                | Standalone debug tool for device interaction                                                                   |
| Sensitive log filtering | Redacts tokens, passwords, keys from all log output                                                            |
| Server mode             | Apple Home compatibility mode                                                                                  |
