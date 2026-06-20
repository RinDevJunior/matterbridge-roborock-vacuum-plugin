# Status Update Flow — Potential Issues

Identified: 2026-06-20

---

## Issue 1 — Bug (High): Wrong argument type in `handleDeviceStatusSimpleUpdate`

**File:** [`src/runtimes/handlers/deviceStateHandler.ts:83`](../src/runtimes/handlers/deviceStateHandler.ts#L83)

```typescript
const state = state_to_matter_state(message.status);  // returns RvcRunMode.ModeTag
// ...
const operationalStateId = state_to_matter_operational_status(state);  // ← wrong: passes ModeTag
```

`state_to_matter_state` returns `RvcRunMode.ModeTag` (Matter cluster enum values, e.g. `0x4040+`), but
`state_to_matter_operational_status` switches on `OperationStatusCode` values (`0`–`~48`). No `ModeTag`
value matches any case, so **every call falls through to `default: return Docked`**.

For devices without real-time connection (`hasRealTimeConnection = false`), the simple path is the only
status path — meaning operational state is hardcoded to `Docked` regardless of whether the robot is
cleaning, paused, or in error.

**Fix:** pass `message.status` instead of `state`:

```typescript
const operationalStateId = state_to_matter_operational_status(message.status);
```

---

## Issue 2 — Bug (Medium): `getBatteryState` returns `IsAtFullCharge` for all non-dock states

**File:** [`src/initialData/getBatteryStatus.ts:26-38`](../src/initialData/getBatteryStatus.ts#L26-L38)

```typescript
export function getBatteryState(deviceState: number, batRemaining: number): PowerSource.BatChargeState {
    if (deviceState === Charging || deviceState === Idle) { ... }
    if (deviceState === ChargingError) { return IsNotCharging; }
    return IsAtFullCharge;  // ← default covers Cleaning, Paused, Error, etc.
}
```

Any unhandled state (Cleaning, Paused, Mapping, …) returns `IsAtFullCharge`. Combined with this logic
in `handleBatteryUpdate`:

```typescript
if (batteryChargeState === IsAtFullCharge && currentOperationState === Charging) {
    → set operationalState to Docked
}
```

If a battery message arrives while the robot is actively cleaning **and** the Matter operational state
happens to be `Charging` (valid during state-ordering races), the device incorrectly transitions to `Docked`.

**Fix:** return `IsNotCharging` for active device states (Cleaning, Mapping, Paused, etc.) instead of
falling through to `IsAtFullCharge`.

---

## Issue 3 — Bug (Low): Falsy check silently drops 0% battery update

**File:** [`src/runtimes/handleHomeDataMessage.ts:62`](../src/runtimes/handleHomeDataMessage.ts#L62)

```typescript
if (batteryLevel) {   // ← evaluates false when batteryLevel === 0
    await platform.platformRunner.updateRobotWithPayload({ type: NotifyMessageTypes.BatteryUpdate, ... });
}
```

A `0%` battery is the most critical battery state and is silently skipped. Same risk on line 85
for `suctionPower && waterBoxMode` — `0` is a valid enum value for some mode settings.

**Fix:**

```typescript
if (batteryLevel != null) { ... }
if (suctionPower != null && waterBoxMode != null) { ... }
```

---

## Issue 4 — Design Issue: DSS error check ordering inconsistent between handlers

**File:** [`src/runtimes/handlers/deviceStateHandler.ts`](../src/runtimes/handlers/deviceStateHandler.ts)

`handleDeviceStatusUpdate` (lines 22–27): checks dock station status (DSS) **first** → if error, skips
everything including run mode update.

`handleDeviceStatusSimpleUpdate` (lines 76–88): updates run mode **first**, then checks DSS → if error,
only skips the operational state update.

Result: on the simple path, a device with a DSS error still gets its run mode updated (e.g., set to
`Cleaning`) even though the dock error should dominate. This leaves run mode and operational state out of
sync (run mode = Cleaning, operational state = Error).

**Fix:** move the DSS check to the top of `handleDeviceStatusSimpleUpdate`, before the `updateAttribute`
call, to mirror the full-update path.

---

## Issue 5 — Design Issue: `requestHomeData` short-circuits if all devices claim real-time connection

**File:** [`src/platformRunner.ts:39-40`](../src/platformRunner.ts#L39-L40)

```typescript
const allDevicesHaveRealTimeConnection = robots.every((x) => x.device.specs.hasRealTimeConnection);
if (allDevicesHaveRealTimeConnection) return;
```

If every registered device reports `hasRealTimeConnection = true`, home data polling is skipped entirely —
including battery and clean mode data that all devices depend on. If a device's real-time connection goes
stale silently (delivers no messages), there is no polling fallback.

Additionally, the check is all-or-nothing: a single non-real-time device forces home data polling for
**all** devices, including those that don't need it.

**Fix (pragmatic):** only short-circuit per-device inside `updateFromHomeData`, not globally. Or add a
staleness watchdog that re-enables polling if no real-time messages arrive within a configurable window.

---

## Issue 6 — Design Issue: Charging guard depends on broken `getBatteryState` exit condition

**File:** [`src/runtimes/handlers/deviceStateHandler.ts:47-55`](../src/runtimes/handlers/deviceStateHandler.ts#L47-L55)

```typescript
if (
    currentOperationState === Charging &&
    resolvedState.runMode === Idle &&
    resolvedState.operationalState === Docked
) {
    // Skip update — let handleBatteryUpdate transition away from Charging
    return false;
}
```

This guard prevents `Charging → Docked` flicker from status messages. The only designed escape from
`Charging` is `handleBatteryUpdate` triggering when `batteryChargeState === IsAtFullCharge`. But because
of Issue 2, `getBatteryState` returns `IsAtFullCharge` for many non-charging states — making the escape
condition unreliable and the guard potentially trapping the device in `Charging` indefinitely if the
battery message arrives while the robot is doing something other than docking.

**Fix:** resolve Issue 2 first. Then consider adding a timeout fallback that clears the `Charging` state
if no `IsAtFullCharge` battery message arrives within a reasonable window.

---

## Priority Summary

| #   | Severity   | File                          | Impact                                                        |
| --- | ---------- | ----------------------------- | ------------------------------------------------------------- |
| 1   | **High**   | `deviceStateHandler.ts:83`    | Operational state always `Docked` on simple path              |
| 2   | **Medium** | `getBatteryStatus.ts:37`      | Active-cleaning state can trigger false `→ Docked` transition |
| 3   | **Low**    | `handleHomeDataMessage.ts:62` | 0% battery silently dropped                                   |
| 4   | Design     | `deviceStateHandler.ts`       | Run mode updated before DSS check on simple path              |
| 5   | Design     | `platformRunner.ts:40`        | No polling fallback when all devices claim real-time          |
| 6   | Design     | `deviceStateHandler.ts:47`    | Charging guard depends on broken `getBatteryState` exit       |
