import { DockingStationStatus, DockingStationStatusCode } from '../../model/DockingStationStatus.js';
import { describe, it, expect } from 'vitest';

describe('DockingStationStatus', () => {
  it('should parse docking station status correctly', () => {
    const dss = 2729;
    const status = DockingStationStatus.parseDockingStationStatus(dss);

    expect(status.cleanFluidStatus).toBe(2);
    expect(status.waterBoxFilterStatus).toBe(2);
    expect(status.dustBagStatus).toBe(2);
    expect(status.dirtyWaterBoxStatus).toBe(2);
    expect(status.clearWaterBoxStatus).toBe(2);
    expect(status.isUpdownWaterReady).toBe(1);
  });

  it('should detect no error when all status fields are OK', () => {
    const dss = 168;
    const status = DockingStationStatus.parseDockingStationStatus(dss);
    expect(status.hasError()).toBe(false);
  });

  it('should detect error in any status field', () => {
    const status = new DockingStationStatus(
      DockingStationStatusCode.OK,
      DockingStationStatusCode.OK,
      DockingStationStatusCode.Error,
      DockingStationStatusCode.OK,
      DockingStationStatusCode.OK,
      DockingStationStatusCode.OK,
    );
    expect(status.hasError()).toBe(true);
  });

  it('should return true if error in any field', () => {
    const status = new DockingStationStatus(
      2,
      2,
      2,
      2,
      1, // This means there is a problem with the clear water box
      1, // This means there is a problem with the updown water
    );
    expect(status.hasError()).toBe(true);
  });
});
