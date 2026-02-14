import { DockStationStatus, DockStationStatusCode } from '../../model/DockStationStatus.js';
import { describe, it, expect } from 'vitest';

describe('DockStationStatus', () => {
  it('should parse docking station status correctly', () => {
    const dss = 2729;
    const status = DockStationStatus.parseDockStationStatus(dss);

    expect(status.cleanFluidStatus).toBe(2);
    expect(status.waterBoxFilterStatus).toBe(2);
    expect(status.dustBagStatus).toBe(2);
    expect(status.dirtyWaterBoxStatus).toBe(2);
    expect(status.clearWaterBoxStatus).toBe(2);
    expect(status.isUpdownWaterReady).toBe(1);
  });

  it('should detect no error when all status fields are OK', () => {
    const dss = 168;
    const status = DockStationStatus.parseDockStationStatus(dss);
    expect(status.hasError()).toBe(false);
  });

  it('should detect error in any status field', () => {
    const status = new DockStationStatus(
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
      DockStationStatusCode.Error,
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
      DockStationStatusCode.OK,
    );
    expect(status.hasError()).toBe(true);
  });

  it('should return true if error in any field', () => {
    const status = new DockStationStatus(
      2,
      2,
      2,
      2,
      1, // This means there is a problem with the clear water box
      1, // This means there is a problem with the updown water
    );
    expect(status.hasError()).toBe(true);
  });

  it('should handle missing clean water tank status gracefully', () => {
    const dss = 164; // Missing clean water tank status
    const status = DockStationStatus.parseDockStationStatus(dss);
    expect(status.cleanFluidStatus).toBe(DockStationStatusCode.Unknown);
    expect(status.waterBoxFilterStatus).toBe(DockStationStatusCode.Unknown);
    expect(status.dustBagStatus).toBe(DockStationStatusCode.OK);
    expect(status.dirtyWaterBoxStatus).toBe(DockStationStatusCode.OK);
    expect(status.clearWaterBoxStatus).toBe(DockStationStatusCode.Error);
    expect(status.hasError()).toBe(true);
  });

  it('should handle missing dirty water box status gracefully', () => {
    const dss = 152; // Missing dirty water box status
    const status = DockStationStatus.parseDockStationStatus(dss);
    expect(status.cleanFluidStatus).toBe(DockStationStatusCode.Unknown);
    expect(status.waterBoxFilterStatus).toBe(DockStationStatusCode.Unknown);
    expect(status.dustBagStatus).toBe(DockStationStatusCode.OK);
    expect(status.dirtyWaterBoxStatus).toBe(DockStationStatusCode.Error);
    expect(status.clearWaterBoxStatus).toBe(DockStationStatusCode.OK);
    expect(status.hasError()).toBe(true);
  });
});
