export interface DockingStationStatus {
  cleanFluidStatus: number;
  waterBoxFilterStatus: number;
  dustBagStatus: number;
  dirtyWaterBoxStatus: number;
  clearWaterBoxStatus: number;
  isUpdownWaterReady: number;
}
// {"cleanFluidStatus":0,"waterBoxFilterStatus":0,"dustBagStatus":2,"dirtyWaterBoxStatus":2,"clearWaterBoxStatus":2,"isUpdownWaterReady":0}

export enum DockingStationStatusType {
  Unknown = 0,
  Error = 1,
  OK = 2,
}

export function parseDockingStationStatus(dss: number): DockingStationStatus {
  return {
    cleanFluidStatus: (dss >> 10) & 0b11,
    waterBoxFilterStatus: (dss >> 8) & 0b11,
    dustBagStatus: (dss >> 6) & 0b11,
    dirtyWaterBoxStatus: (dss >> 4) & 0b11,
    clearWaterBoxStatus: (dss >> 2) & 0b11,
    isUpdownWaterReady: dss & 0b11,
  };
}

export function hasDockingStationError(status: DockingStationStatus | undefined): boolean {
  if (!status) {
    return false;
  }

  return (
    status.cleanFluidStatus === DockingStationStatusType.Error ||
    status.waterBoxFilterStatus === DockingStationStatusType.Error ||
    status.dustBagStatus === DockingStationStatusType.Error ||
    status.dirtyWaterBoxStatus === DockingStationStatusType.Error ||
    status.clearWaterBoxStatus === DockingStationStatusType.Error
    // || status.isUpdownWaterReady === DockingStationStatusType.Error
  );
}
