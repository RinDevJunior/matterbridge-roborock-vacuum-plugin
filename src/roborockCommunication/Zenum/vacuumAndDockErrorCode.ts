export enum VacuumErrorCode {
  None = 0,
  LidarBlocked = 1,
  BumperStuck = 2,
  WheelsSuspended = 3,
  CliffSensorError = 4,
  MainBrushJammed = 5,
  SideBrushJammed = 6,
  WheelsJammed = 7,
  RobotTrapped = 8,
  NoDustbin = 9,
  StrainerError = 10,
  CompassError = 11,
  LowBattery = 12,
  ChargingError = 13,
  BatteryError = 14,
  WallSensorDirty = 15,
  RobotTilted = 16,
  SideBrushError = 17,
  FanError = 18,
  DockNotConnectedToPower = 19,
  OpticalFlowSensorDirt = 20,
  VerticalBumperPressed = 21,
  DockLocatorError = 22,
  ReturnToDockFail = 23,
  NogoZoneDetected = 24,
  CameraError = 25,
  WallSensorError = 26,
  VibrariseJammed = 27,
  RobotOnCarpet = 28,
  FilterBlocked = 29,
  InvisibleWallDetected = 30,
  CannotCrossCarpet = 31,
  InternalError = 32,
  CleanAutoEmptyDock = 34,
  AutoEmptyDockVoltage = 35,
  MoppingRollerJammed = 36, // Wash roller may be jammed
  MoppingRollerNotLowered = 37, // wash roller not lowered properly
  ClearWaterBoxHoare = 38,
  DirtyWaterBoxHoare = 39,
  SinkStrainerHoare = 40,
  ClearWaterTankEmpty = 41,
  ClearBrushInstalledProperly = 42, // Check that the water filter has been correctly installed
  ClearBrushPositioningError = 43,
  FilterScreenException = 44, // Clean the dock water filter
  MoppingRollerJammed2 = 45, // Wash roller may be jammed
  UpWaterException = 48,
  DrainWaterException = 49,
  TemperatureProtection = 51,
  CleanCarouselException = 52,
  CleanCarouselWaterFull = 53,
  WaterCarriageDrop = 54,
  CheckCleanCarouse = 55,
  AudioError = 56,
}

export enum DockErrorCode {
  None = 0,
  DuctBlockage = 34, // Duct blockage detected
  WaterEmpty = 38, // Clean water tank empty
  WasteWaterTankFull = 39, // Waste water tank full
  MaintenanceBrushJammed = 42, // Maintenance brush jammed
  DirtyTankLatchOpen = 44, // Dirty tank latch open
  NoDustbin = 46, // No dustbin detected
  CleaningTankFullOrBlocked = 53, // Cleaning tank full or blocked
}

//TODO: correct this
export enum FAN_SPEEDS {
  LOW = 101,
  MEDIUM = 102,
  HIGH = 103,
  MAX = 104,
  OFF = 105, // also known as mop mode
}

export enum WATER_GRADES {
  OFF = 200,
  LOW = 201,
  MEDIUM = 202,
  HIGH = 203,
}

export const SUPPORTED_ATTACHMENTS = ['WATERTANK', 'MOP'];
