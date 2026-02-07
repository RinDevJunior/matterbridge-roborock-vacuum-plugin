# State Resolution Matrix

## Legend

**Status Codes (OperationStatusCode):**

- `0` = Unknown
- `1` = Initiating
- `2` = Sleeping
- `3` = Idle
- `5` = Cleaning
- `6` = ReturningDock
- `7` = ManualMode
- `8` = Charging
- `10` = Paused
- `11` = ChargingError
- `12` = InError
- `15` = ZoneClean
- `16` = RoomClean
- `17` = SegmentClean
- `18` = GoingToTarget
- `22` = EmptyingDustContainer
- `23` = WashingTheMop
- `26` = GoingToWashTheMop
- `29` = Mapping

**Run Modes:**

- `16384` = Idle
- `16385` = Cleaning
- `16386` = Mapping

**Operational States:**

- `0` = Stopped
- `1` = Running
- `2` = Paused
- `3` = Error
- `64` = SeekingCharger
- `66` = Docked
- `67` = EmptyingDustBin
- `68` = CleaningMop
- `69` = FillingWaterTank
- `70` = UpdatingMaps

**Flag Values:**

- `T` = true
- `F` = false
- `-` = undefined
- `*` = any value (ignored)

## Comprehensive State Resolution Matrix (56 Rows)

**Note:** Only `inReturning`, `isExploring`, `inFreshState`, `inWarmup`, and `isLocating` are currently used in state resolution. The flag `inCleaning` is present in StatusChangeMessage but does not affect the resolved state.

**Invalid State Combinations (Removed):**

- Status 5 (Cleaning) + inFreshState alone - vacuum does not go to fresh state during cleaning
- Status 8/10 (Charging) + isExploring/isLocating - vacuum cannot charge and explore/locate simultaneously
- Status 5 (Cleaning) + isLocating + inReturning - vacuum cannot locate while returning (inReturning wins)
- Status 5 (Cleaning) + isExploring + inReturning - vacuum cannot explore while returning (inReturning wins)

**Special Rules:**

- When device status is **Idle (3)**, all modifier flags are ignored and the resolved state is always **Idle (16384) + Docked (66)**.
- When device status is **Cleaning (5)**, modifiers apply in explicit priority order:
  1. **inWarmup=true** (highest): → **Cleaning (16385) + CleaningMop (68)**
  2. **inReturning=true** (second): → **Cleaning (16385) + SeekingCharger (64)**
  3. **isLocating=true OR isExploring=true** (third): → **Cleaning (16385) + UpdatingMaps (70)**
  4. **inFreshState** (N/A): Not applicable to Cleaning status
- When device status is **EmptyingDustContainer (22)**, all modifier flags are ignored and the resolved state is always **Cleaning (16385) + EmptyingDustBin (67)**.
- When device status is **WashingTheMop (23)**, all modifier flags are ignored and the resolved state is always **Cleaning (16385) + CleaningMop (68)**.
- When device status is **GoingToWashTheMop (26)**, all modifier flags are ignored and the resolved state is always **Cleaning (16385) + CleaningMop (68)**.
- When device status is **Mapping (29)**, all modifier flags are ignored and the resolved state is always **Mapping (16386) + Running (1)**.

| Row | Status | Status Name           | inCleaning | inReturning | inFreshState | isLocating | isExploring | inWarmup | Run Mode | Run Mode Value | Operational State | Op State Value | Modifier Applied                                   |
| --- | ------ | --------------------- | ---------- | ----------- | ------------ | ---------- | ----------- | -------- | -------- | -------------- | ----------------- | -------------- | -------------------------------------------------- |
| 1   | 0      | Unknown               | -          | -           | -            | -          | -           | -        | Idle     | 16384          | Docked            | 66             | Base                                               |
| 2   | 0      | Unknown               | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 3   | 0      | Unknown               | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Docked            | 66             | isExploring                                        |
| 4   | 0      | Unknown               | -          | T           | -            | -          | T           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 5   | 1      | Initiating            | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | Running           | 1              | Base                                               |
| 6   | 1      | Initiating            | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 7   | 1      | Initiating            | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Running           | 1              | isExploring                                        |
| 8   | 2      | Sleeping              | -          | -           | -            | -          | -           | -        | Idle     | 16384          | Docked            | 66             | Base                                               |
| 9   | 2      | Sleeping              | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 10  | 2      | Sleeping              | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Docked            | 66             | isExploring                                        |
| 11  | 3      | Idle                  | \*         | \*          | \*           | \*         | \*          | \*       | Idle     | 16384          | Docked            | 66             | Idle Override (All flags ignored)                  |
| 12  | 5      | Cleaning              | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | Running           | 1              | Base                                               |
| 13  | 5      | Cleaning              | \*         | \*          | \*           | \*         | \*          | T        | Cleaning | 16385          | CleaningMop       | 68             | Cleaning+inWarmup Override (Priority 1)            |
| 14  | 5      | Cleaning              | \*         | -           | \*           | T          | \*          | -        | Cleaning | 16385          | UpdatingMaps      | 70             | Cleaning+isLocating Override (Priority 3)          |
| 15  | 5      | Cleaning              | \*         | -           | \*           | \*         | T           | -        | Cleaning | 16385          | UpdatingMaps      | 70             | Cleaning+isExploring Override (Priority 3)         |
| 16  | 5      | Cleaning              | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning (Priority 2)                           |
| 17  | 5      | Cleaning              | -          | T           | -            | -          | T           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning (Priority 2 beats isExploring)         |
| 18  | 5      | Cleaning              | -          | T           | T            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning (Priority 2)                           |
| 19  | 5      | Cleaning              | -          | T           | T            | -          | T           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning (Priority 2 beats all)                 |
| 20  | 6      | ReturningDock         | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | Base                                               |
| 21  | 6      | ReturningDock         | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 22  | 6      | ReturningDock         | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | SeekingCharger    | 64             | isExploring                                        |
| 23  | 7      | ManualMode            | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | Running           | 1              | Base                                               |
| 24  | 7      | ManualMode            | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 25  | 7      | ManualMode            | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Running           | 1              | isExploring                                        |
| 26  | 8      | Charging              | -          | -           | -            | -          | -           | -        | Idle     | 16384          | Docked            | 66             | Base                                               |
| 27  | 8      | Charging              | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 28  | 8      | Charging              | -          | -           | T            | -          | -           | -        | Idle     | 16384          | Docked            | 66             | inFreshState                                       |
| 29  | 8      | Charging              | -          | T           | -            | -          | T           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 30  | 8      | Charging              | -          | T           | T            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 31  | 8      | Charging              | -          | T           | T            | -          | T           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 32  | 10     | Paused                | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | Paused            | 2              | Base                                               |
| 33  | 10     | Paused                | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | Paused            | 2              | inReturning                                        |
| 34  | 10     | Paused                | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Paused            | 2              | isExploring                                        |
| 35  | 11     | ChargingError         | -          | -           | -            | -          | -           | -        | Idle     | 16384          | Error             | 3              | Base                                               |
| 36  | 11     | ChargingError         | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 37  | 11     | ChargingError         | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Error             | 3              | isExploring                                        |
| 38  | 12     | InError               | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | Error             | 3              | Base                                               |
| 39  | 12     | InError               | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | Error             | 3              | inReturning                                        |
| 40  | 12     | InError               | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Error             | 3              | isExploring                                        |
| 41  | 15     | ZoneClean             | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | Running           | 1              | Base                                               |
| 42  | 15     | ZoneClean             | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 43  | 15     | ZoneClean             | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Running           | 1              | isExploring                                        |
| 44  | 16     | RoomClean             | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | Running           | 1              | Base                                               |
| 45  | 16     | RoomClean             | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 46  | 16     | RoomClean             | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Running           | 1              | isExploring                                        |
| 47  | 17     | SegmentClean          | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | Running           | 1              | Base                                               |
| 48  | 17     | SegmentClean          | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 49  | 17     | SegmentClean          | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Running           | 1              | isExploring                                        |
| 50  | 18     | GoingToTarget         | -          | -           | -            | -          | -           | -        | Cleaning | 16385          | Running           | 1              | Base                                               |
| 51  | 18     | GoingToTarget         | -          | T           | -            | -          | -           | -        | Cleaning | 16385          | SeekingCharger    | 64             | inReturning                                        |
| 52  | 18     | GoingToTarget         | -          | -           | -            | -          | T           | -        | Mapping  | 16386          | Running           | 1              | isExploring                                        |
| 53  | 22     | EmptyingDustContainer | \*         | \*          | \*           | \*         | \*          | \*       | Cleaning | 16385          | EmptyingDustBin   | 67             | EmptyingDustContainer Override (All flags ignored) |
| 54  | 23     | WashingTheMop         | \*         | \*          | \*           | \*         | \*          | \*       | Cleaning | 16385          | CleaningMop       | 68             | WashingTheMop Override (All flags ignored)         |
| 55  | 26     | GoingToWashTheMop     | \*         | \*          | \*           | \*         | \*          | \*       | Cleaning | 16385          | CleaningMop       | 68             | GoingToWashTheMop Override (All flags ignored)     |
| 56  | 29     | Mapping               | \*         | \*          | \*           | \*         | \*          | \*       | Mapping  | 16386          | Running           | 1              | Mapping Override (All flags ignored)               |

## Modifier Priority Chain

0. **Status Override Rules** (Highest Priority)

   - **Idle Status Override**

     - Condition: `status === 3` (Idle)
     - Effect: Returns `runMode = Idle`, `operationalState = Docked`
     - Overrides: ALL modifiers (early exit, no modifiers applied)

   - **Cleaning Status Modifiers** (Explicit Priority Order)

     - Condition: `status === 5` (Cleaning)
     - Priority 1: `inWarmup === true` → Returns `runMode = Cleaning`, `operationalState = CleaningMop`
     - Priority 2: `inReturning === true` → Returns `runMode = Cleaning`, `operationalState = SeekingCharger`
     - Priority 3: `isLocating === true OR isExploring === true` → Returns `runMode = Cleaning`, `operationalState = UpdatingMaps`
     - Priority 4: `inFreshState` → Not applicable (vacuum does not go to fresh state during cleaning)

   - **EmptyingDustContainer Status Override**

     - Condition: `status === 22` (EmptyingDustContainer)
     - Effect: Returns `runMode = Cleaning`, `operationalState = EmptyingDustBin`
     - Overrides: ALL modifiers (early exit, no modifiers applied)

   - **WashingTheMop Status Override**

     - Condition: `status === 23` (WashingTheMop)
     - Effect: Returns `runMode = Cleaning`, `operationalState = CleaningMop`
     - Overrides: ALL modifiers (early exit, no modifiers applied)

   - **GoingToWashTheMop Status Override**

     - Condition: `status === 26` (GoingToWashTheMop)
     - Effect: Returns `runMode = Cleaning`, `operationalState = CleaningMop`
     - Overrides: ALL modifiers (early exit, no modifiers applied)

   - **Mapping Status Override**
     - Condition: `status === 29` (Mapping)
     - Effect: Returns `runMode = Mapping`, `operationalState = Running`
     - Overrides: ALL modifiers (early exit, no modifiers applied)

1. **applyInReturningModifier** (High Priority)

   - Condition: `inReturning === true`
   - Effect: Sets `runMode = Cleaning`, `operationalState = SeekingCharger`
   - Special Case: When `status === 10` (Paused), sets `operationalState = Paused` instead of `SeekingCharger`
   - Overrides: All other modifiers

2. **applyIsExploringModifier** (Medium Priority)

   - Condition: `isExploring === true && inReturning !== true && status !== 8`
   - Effect: Sets `runMode = Mapping`, keeps operationalState
   - Blocked by: inReturning, Charging status (8)
   - Overrides: inFreshState
   - Note: Charging + isExploring is an invalid state (vacuum cannot charge and explore simultaneously)

3. **applyInFreshStateModifier** (Lowest Priority)
   - Condition: `inFreshState === true && status === 8`
   - Effect: Sets `runMode = Idle`, `operationalState = Docked`
   - Blocked by: inReturning, isExploring
   - Only applies when status = 8 (Charging)
   - Note: Cleaning + inFreshState is an invalid state (removed from matrix)

## All StatusChangeMessage Flags

### Currently Used in State Resolution

- `inReturning` - Highest priority modifier, overrides to SeekingCharger (or Paused if status=10)
- `isExploring` - Medium priority modifier, overrides to Mapping mode (blocked on Charging status)
- `inFreshState` - Lowest priority modifier, transitions to Idle/Docked when status=8
- `inWarmup` - Cleaning status special override, sets CleaningMop operational state
- `isLocating` - Cleaning status special override, sets UpdatingMaps operational state

### Present but Unused (Reserved for Future)

- `inCleaning` - Available in StatusChangeMessage but not used in state resolution

## Data Source Scenarios

### REST API (Home Data)

All flags are `undefined`:

```typescript
{ status: 5, inReturning: undefined, isExploring: undefined, inFreshState: undefined, ... }
→ Result: Uses base state mapping only
→ Cleaning → Cleaning + Running
```

### MQTT (Modern Vacuum)

Flags populated from device:

```typescript
{ status: 5, inReturning: true, isExploring: false, inFreshState: false, ... }
→ Result: inReturning modifier applies
→ Cleaning → Cleaning + SeekingCharger
```

### MQTT (Older Vacuum)

Flags may be `undefined` or `false`:

```typescript
{ status: 5, inReturning: false, isExploring: false, inFreshState: false, ... }
→ Result: No modifiers apply (all false)
→ Cleaning → Cleaning + Running
```

## Edge Cases

### Returning while Exploring

```
status: 5, inReturning: true, isExploring: true
→ inReturning wins (higher priority)
→ Result: Cleaning + SeekingCharger
```

### Fresh State while Exploring

```
status: 5, inReturning: false, isExploring: true, inFreshState: true
→ isExploring wins (higher priority than inFreshState)
→ Result: Mapping + Running
```

### Fresh State on Non-Cleaning Status

```
status: 3, inFreshState: true
→ inFreshState modifier doesn't apply (status !== 8)
→ Result: Idle + Docked (base state)
```
