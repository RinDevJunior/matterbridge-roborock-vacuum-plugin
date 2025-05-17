export type DockingStationStatus = {
  cleanFluidStatus: number;
  waterBoxFilterStatus: number;
  dustBagStatus: number;
  dirtyWaterBoxStatus: number;
  clearWaterBoxStatus: number;
  isUpdownWaterReady: number;
};

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
