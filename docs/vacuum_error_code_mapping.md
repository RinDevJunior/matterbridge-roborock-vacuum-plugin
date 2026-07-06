# Vacuum Error Code to Matter ErrorState Mapping

Maps `VacuumErrorCode` (Roborock) to `RvcOperationalState.ErrorState` (Matter).

## Mapping Table

| VacuumErrorCode             | Code | Description                               | Matter ErrorState         |
| --------------------------- | ---- | ----------------------------------------- | ------------------------- |
| None                        | 0    | No error present                          | NoError                   |
| LidarBlocked                | 1    | LiDAR sensor is blocked or obstructed     | NavigationSensorObscured  |
| BumperStuck                 | 2    | Front bumper is stuck or pressed in       | Stuck                     |
| WheelsSuspended             | 3    | Wheels are lifted off the ground          | WheelsJammed              |
| CliffSensorError            | 4    | Cliff/drop-off sensor malfunction         | NavigationSensorObscured  |
| MainBrushJammed             | 5    | Main brush is tangled or jammed           | BrushJammed               |
| SideBrushJammed             | 6    | Side brush is tangled or jammed           | BrushJammed               |
| WheelsJammed                | 7    | Drive wheels are stuck or blocked         | WheelsJammed              |
| RobotTrapped                | 8    | Robot is stuck and cannot move            | Stuck                     |
| NoDustbin                   | 9    | Dust bin is not installed                 | DustBinMissing            |
| StrainerError               | 10   | Strainer/filter issue detected            | DustBinMissing            |
| CompassError                | 11   | Internal compass sensor error             | NavigationSensorObscured  |
| LowBattery                  | 12   | Battery level too low to continue         | LowBattery                |
| ChargingError               | 13   | Unable to charge at dock                  | UnableToStartOrResume     |
| BatteryError                | 14   | Battery malfunction detected              | UnableToCompleteOperation |
| WallSensorDirty             | 15   | Wall-following sensor needs cleaning      | NavigationSensorObscured  |
| RobotTilted                 | 16   | Robot is tilted on uneven surface         | Stuck                     |
| SideBrushError              | 17   | Side brush motor or mechanism error       | BrushJammed               |
| FanError                    | 18   | Suction fan malfunction                   | UnableToCompleteOperation |
| DockNotConnectedToPower     | 19   | Charging dock has no power                | FailedToFindChargingDock  |
| OpticalFlowSensorDirt       | 20   | Optical flow sensor needs cleaning        | NavigationSensorObscured  |
| VerticalBumperPressed       | 21   | Vertical bumper is pressed in             | Stuck                     |
| DockLocatorError            | 22   | Cannot locate charging dock signal        | FailedToFindChargingDock  |
| ReturnToDockFail            | 23   | Failed to navigate back to dock           | FailedToFindChargingDock  |
| NogoZoneDetected            | 24   | Path blocked by a no-go zone              | CannotReachTargetArea     |
| CameraError                 | 25   | Navigation camera malfunction             | NavigationSensorObscured  |
| WallSensorError             | 26   | Wall sensor malfunction                   | NavigationSensorObscured  |
| VibrariseJammed             | 27   | Vibrarise mop mechanism jammed            | Stuck                     |
| RobotOnCarpet               | 28   | Robot stuck on carpet with mop attached   | Stuck                     |
| FilterBlocked               | 29   | Air filter is clogged                     | DustBinFull               |
| InvisibleWallDetected       | 30   | Path blocked by virtual wall              | CannotReachTargetArea     |
| CannotCrossCarpet           | 31   | Cannot cross carpet in current mode       | CannotReachTargetArea     |
| InternalError               | 32   | Internal system error                     | UnableToCompleteOperation |
| CleanAutoEmptyDock          | 34   | Auto-empty dock needs cleaning            | DustBinMissing            |
| AutoEmptyDockVoltage        | 35   | Auto-empty dock voltage issue             | UnableToCompleteOperation |
| MoppingRollerJammed         | 36   | Wash roller may be jammed                 | BrushJammed               |
| MoppingRollerNotLowered     | 37   | Wash roller not lowered properly          | UnableToCompleteOperation |
| ClearWaterBoxHoare          | 38   | Clean water tank issue detected           | WaterTankMissing          |
| DirtyWaterBoxHoare          | 39   | Dirty water tank issue detected           | DirtyWaterTankFull        |
| SinkStrainerHoare           | 40   | Dock sink strainer issue                  | UnableToCompleteOperation |
| ClearWaterTankEmpty         | 41   | Clean water tank is empty                 | WaterTankEmpty            |
| ClearBrushInstalledProperly | 42   | Check water filter is correctly installed | WaterTankMissing          |
| ClearBrushPositioningError  | 43   | Cleaning brush positioning error          | BrushJammed               |
| FilterScreenException       | 44   | Dock water filter needs cleaning          | WaterTankMissing          |
| MoppingRollerJammed2        | 45   | Wash roller may be jammed                 | BrushJammed               |
| UpWaterException            | 48   | Water supply exception                    | WaterTankMissing          |
| DrainWaterException         | 49   | Water drain exception                     | DirtyWaterTankFull        |
| TemperatureProtection       | 51   | Temperature too high, protection active   | UnableToCompleteOperation |
| CleanCarouselException      | 52   | Cleaning carousel malfunction             | UnableToCompleteOperation |
| CleanCarouselWaterFull      | 53   | Cleaning carousel water tank full         | DirtyWaterTankFull        |
| WaterCarriageDrop           | 54   | Water carriage detached or dropped        | WaterTankMissing          |
| CheckCleanCarouse           | 55   | Check cleaning carousel                   | UnableToCompleteOperation |
| AudioError                  | 56   | Audio/speaker module error                | UnableToCompleteOperation |

## Matter ErrorState Groups

### NoError

- None (0)

### NavigationSensorObscured

- LidarBlocked (1), CliffSensorError (4), CompassError (11), WallSensorDirty (15), OpticalFlowSensorDirt (20), CameraError (25), WallSensorError (26)

### Stuck

- BumperStuck (2), RobotTrapped (8), RobotTilted (16), VerticalBumperPressed (21), VibrariseJammed (27), RobotOnCarpet (28)

### WheelsJammed

- WheelsSuspended (3), WheelsJammed (7)

### BrushJammed

- MainBrushJammed (5), SideBrushJammed (6), SideBrushError (17), ClearBrushPositioningError (43), MoppingRollerJammed (36), MoppingRollerJammed2 (45)

### DustBinMissing

- NoDustbin (9), StrainerError (10), CleanAutoEmptyDock (34)

### DustBinFull

- FilterBlocked (29)

### LowBattery

- LowBattery (12)

### UnableToStartOrResume

- ChargingError (13)

### FailedToFindChargingDock

- DockNotConnectedToPower (19), DockLocatorError (22), ReturnToDockFail (23)

### CannotReachTargetArea

- NogoZoneDetected (24), InvisibleWallDetected (30), CannotCrossCarpet (31)

### UnableToCompleteOperation

- InternalError (32), FanError (18), TemperatureProtection (51), CleanCarouselException (52), BatteryError (14), AutoEmptyDockVoltage (35), AudioError (56), MoppingRollerNotLowered (37), SinkStrainerHoare (40), CheckCleanCarouse (55)

### WaterTankEmpty

- ClearWaterTankEmpty (41)

### WaterTankMissing

- ClearWaterBoxHoare (38), ClearBrushInstalledProperly (42), FilterScreenException (44), UpWaterException (48), WaterCarriageDrop (54)

### DirtyWaterTankFull

- DirtyWaterBoxHoare (39), DrainWaterException (49), CleanCarouselWaterFull (53)

## All Available Matter RvcOperationalState.ErrorState Values

Source: `@matter/types/src/clusters/rvc-operational-state.ts` (Matter v1.4.2)

| ErrorState                | Value | Description                                                        | Used in Mapping |
| ------------------------- | ----- | ------------------------------------------------------------------ | --------------- |
| NoError                   | 0     | The device is not in an error state                                | Yes             |
| UnableToStartOrResume     | 1     | The device is unable to start or resume operation                  | Yes             |
| UnableToCompleteOperation | 2     | The device was unable to complete the current operation            | Yes             |
| CommandInvalidInState     | 3     | The device cannot process the command in its current state         | No              |
| FailedToFindChargingDock  | 64    | The device has failed to find or reach the charging dock           | Yes             |
| Stuck                     | 65    | The device is stuck and requires manual intervention               | Yes             |
| DustBinMissing            | 66    | The device has detected that its dust bin is missing               | Yes             |
| DustBinFull               | 67    | The device has detected that its dust bin is full                  | Yes             |
| WaterTankEmpty            | 68    | The device has detected that its clean water tank is empty         | Yes             |
| WaterTankMissing          | 69    | The device has detected that its clean water tank is missing       | Yes             |
| WaterTankLidOpen          | 70    | The device has detected that its water tank lid is open            | No              |
| MopCleaningPadMissing     | 71    | The device has detected that its cleaning pad is missing           | No              |
| LowBattery                | 72    | The device is unable to operate due to a low battery               | Yes             |
| CannotReachTargetArea     | 73    | The device is unable to move to the target area due to obstruction | Yes             |
| DirtyWaterTankFull        | 74    | The device has detected that its dirty water tank is full          | Yes             |
| DirtyWaterTankMissing     | 75    | The device has detected that its dirty water tank is missing       | No              |
| WheelsJammed              | 76    | The device has detected that one or more wheels are jammed         | Yes             |
| BrushJammed               | 77    | The device has detected that its brush is jammed                   | Yes             |
| NavigationSensorObscured  | 78    | A navigation sensor (LiDAR, infrared, camera) is obscured          | Yes             |

### Unused ErrorStates

The following Matter ErrorState values are not mapped from any `VacuumErrorCode`:

- **CommandInvalidInState** (3)
- **WaterTankLidOpen** (70)
- **MopCleaningPadMissing** (71)
- **DirtyWaterTankMissing** (75)

## Unmapped Codes (default → NoError)

Any `VacuumErrorCode` not listed above falls through to `NoError` via the `default` case. Notable gaps in the enum: 33, 46, 47, 50.
