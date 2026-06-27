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

**Severity:** Medium

**Reference behavior:**
```typescript
case 'charging-error':
  await this.endpoint?.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', RvcOperationalState.OperationalState.Error);
  await this.endpoint?.updateAttribute(RvcOperationalState.Cluster.id, 'operationalError', RvcOperationalState.ErrorState.FailedToFindChargingDock);
  break;
```

**Current plugin behavior:**
`src/share/function.ts` maps `OperationStatusCode.ChargingError = 9` to generic `Error` operational state (line 55 of `matterOperationalStatusMap`). Neither `stateResolver.ts` nor `errorStateHandler.ts` sets `operationalError.errorStateId` to `FailedToFindChargingDock` for this status code. The error detail remains at `NoError` or whatever the previous value was.

**File to change:** `src/share/stateResolver.ts`

**Approach:** Add an explicit status override block for `OperationStatusCode.ChargingError` returning `{ runMode: Idle, operationalState: Error }` and emit `operationalError = FailedToFindChargingDock`. Alternatively, handle in `errorStateHandler.ts` by checking for the `ChargingError` status code and setting the error detail there.

**Caution:** Ensure only one code path sets the `operationalError` attribute for this status to avoid conflicts.

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

**Severity:** Low

**Reference behavior:**
```typescript
// services/config_service.ts
roomNames?: string[];

// vacuum_device_accessory.ts
locationName: this.config.roomNames?.[index] || `${roomName}`,
```
Users can specify room names in the plugin config, used as fallback when the device API does not return names.

**Current plugin behavior:**
All room names are derived from the cloud API (`iot_name` field in `RoomMapping`). There is no config-level override. If `iot_name` is null or empty, the fallback is a random-suffixed "Unknown Room" string.

**Files to change:**
- `src/model/RoborockPluginPlatformConfig.ts` — add optional `roomNames?: string[]` to `PluginConfiguration`
- `src/initialData/getSupportedAreas.ts` — fall back to `configManager.roomNames?.[index]` in `processValidData` when `locationName` cannot be resolved from `iot_name`

**Complexity:** Simple

---

### Gap 5 — `FullyCharged` (Status Code 100) Has No Explicit State Entry

**Severity:** Low (currently handled correctly via fallback)

**Reference behavior:**
```typescript
case 'fully-charged':
  await this.endpoint?.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', RvcOperationalState.OperationalState.Docked);
  break;
```

**Current plugin behavior:**
`OperationStatusCode.FullyCharged = 100` is absent from both `matterStateMap` and `matterOperationalStatusMap` in `src/share/function.ts`. It falls through to the default returns: `RvcRunMode.ModeTag.Idle` and `RvcOperationalState.OperationalState.Docked`. Functionally correct, but implicit and fragile — a future refactor that changes the default could silently break this behavior.

**File to change:** `src/share/function.ts`

**Approach:** Add explicit entries:
- `matterStateMap`: `OperationStatusCode.FullyCharged → RvcRunMode.ModeTag.Idle`
- `matterOperationalStatusMap`: `OperationStatusCode.FullyCharged → RvcOperationalState.OperationalState.Docked`

**Complexity:** Simple (2 lines)

---

## Open Questions for Engineering Decision

- [ ] **Gap 1:** Does the Roborock API treat "all rooms" and "no rooms (full clean)" identically? If yes, Gap 1 has no user-visible impact and can be deprioritized.
- [ ] **Gap 2:** Should `FailedToFindChargingDock` be set via `stateResolver.ts` (status-code path) or `errorStateHandler.ts` (error message path)? The two paths currently run independently and must not both set `operationalError` for the same event.
- [ ] **Gap 3:** Is firmware-aware capability selection needed for currently supported models? None of the Roborock-branded models in the current registry have documented firmware-split capability sets. This gap only matters if older firmware variants behave differently.
- [ ] **Gap 4:** Are there known cases where the Roborock cloud API returns null/empty `iot_name` values for rooms? If not, the manual override has no practical benefit.

---

## What the Current Plugin Has That the Reference Lacks

The current plugin is substantially more capable. Key capabilities not present in the reference:

| Capability | Current Plugin |
|---|---|
| State resolution | 47-state matrix with 5 modifier flags (`inCleaning`, `isExploring`, `inReturning`, `inWarmup`, `inFreshState`) |
| Operational states | `EmptyingDustBin`, `CleaningMop`, `UpdatingMaps` (Matter 1.3+ extended states) |
| Dock station errors | Bit-field parsing for water box, dust bag, dirty/clear water tank |
| Vacuum error codes | Full error code → `RvcOperationalState.ErrorState` mapping |
| Multiple map support | Service areas with per-map IDs, floor numbers, active map tracking |
| Scenes as rooms | Roborock routines exposed as `ServiceArea` areas |
| Room namespace tags | Bedroom, kitchen, balcony, etc. from Roborock room type codes |
| Clean mode system | suctionPower + waterFlow + distanceOff + mopRoute + seqType combinations |
| Smart plans | `smartPlan`, `vacFollowedByMop`, `vacAndMopDeep` clean modes |
| Authentication | Email + 2FA or password, token refresh, secure credential storage |
| Device filtering | White list / black list by device DUID |
| Matter overrides | Vendor name, vendor ID, product name, product ID per device |
| Email notifications | SMTP-based error/event notifications |
| Live map updates | `enableLiveMapUpdates` flag |
| CLI tool | Standalone debug tool for device interaction |
| Sensitive log filtering | Redacts tokens, passwords, keys from all log output |
| Server mode | Apple Home compatibility mode |

