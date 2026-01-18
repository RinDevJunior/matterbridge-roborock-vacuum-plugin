import { parseDockingStationStatus, DockingStationStatus, DockingStationStatusType, hasDockingStationError } from '@/model/DockingStationStatus.js';
import { describe, it, expect } from 'vitest';

describe('DockingStationStatus', () => {
  it('should parse docking station status correctly', () => {
    const dss = 2729;
    const status = parseDockingStationStatus(dss);

    expect(status.cleanFluidStatus).toBe(2);
    expect(status.waterBoxFilterStatus).toBe(2);
    expect(status.dustBagStatus).toBe(2);
    expect(status.dirtyWaterBoxStatus).toBe(2);
    expect(status.clearWaterBoxStatus).toBe(2);
    expect(status.isUpdownWaterReady).toBe(1);
  });

  it('should detect error in any status field', () => {
    const status: DockingStationStatus = {
      cleanFluidStatus: DockingStationStatusType.OK,
      waterBoxFilterStatus: DockingStationStatusType.OK,
      dustBagStatus: DockingStationStatusType.Error,
      dirtyWaterBoxStatus: DockingStationStatusType.OK,
      clearWaterBoxStatus: DockingStationStatusType.OK,
      isUpdownWaterReady: DockingStationStatusType.OK,
    };
    expect(hasDockingStationError(status)).toBe(true);
  });

  it('should return true if error in any field', () => {
    const status: DockingStationStatus = {
      cleanFluidStatus: 2,
      waterBoxFilterStatus: 2,
      dustBagStatus: 2,
      dirtyWaterBoxStatus: 2,
      clearWaterBoxStatus: 1, // This means there is a problem with the clear water box
      isUpdownWaterReady: 1, // This means there is a problem with the updown water
    };
    expect(hasDockingStationError(status)).toBe(true);
  });
});
