import { getCurrentCleanModeA187, getCurrentCleanModeFromFanPowerA187, getCurrentCleanModeFromWaterBoxModeA187 } from './runtimes';
import { MopWaterFlowA187, VacuumSuctionPowerA187 } from './a187';

describe('getCurrentCleanModeA187', () => {
  it('returns undefined if fan_power or water_box_mode is undefined', () => {
    expect(getCurrentCleanModeA187(undefined, 1)).toBeUndefined();
    expect(getCurrentCleanModeA187(1, undefined)).toBeUndefined();
  });

  it('returns undefined if fan_power = 105 or water_box_mode = 202', () => {
    expect(getCurrentCleanModeA187(105, 202)).toBe(5);
  });

  it('returns 4 for Smart plan', () => {
    expect(getCurrentCleanModeA187(VacuumSuctionPowerA187.Smart, 1)).toBe(4);
    expect(getCurrentCleanModeA187(1, MopWaterFlowA187.Smart)).toBe(4);
  });

  it('returns 8 for Custom', () => {
    expect(getCurrentCleanModeA187(VacuumSuctionPowerA187.Custom, 1)).toBe(8);
    expect(getCurrentCleanModeA187(1, MopWaterFlowA187.Custom)).toBe(8);
  });

  it('returns 5 for Mop', () => {
    expect(getCurrentCleanModeA187(VacuumSuctionPowerA187.Off, 1)).toBe(5);
  });

  it('returns 6 for Vacuum', () => {
    expect(getCurrentCleanModeA187(1, MopWaterFlowA187.Off)).toBe(6);
  });

  it('returns 7 for Vac & Mop', () => {
    expect(getCurrentCleanModeA187(1, 1)).toBe(7);
  });
});

describe('getCurrentCleanModeFromFanPowerA187', () => {
  it('returns undefined if fan_power is undefined', () => {
    expect(getCurrentCleanModeFromFanPowerA187(undefined)).toBeUndefined();
  });

  it('returns 4 for Smart plan', () => {
    expect(getCurrentCleanModeFromFanPowerA187(VacuumSuctionPowerA187.Smart)).toBe(4);
  });

  it('returns 8 for Custom', () => {
    expect(getCurrentCleanModeFromFanPowerA187(VacuumSuctionPowerA187.Custom)).toBe(8);
  });

  it('returns 5 for Mop', () => {
    expect(getCurrentCleanModeFromFanPowerA187(VacuumSuctionPowerA187.Off)).toBe(5);
  });

  it('returns undefined for other values', () => {
    expect(getCurrentCleanModeFromFanPowerA187(12345)).toBeUndefined();
  });
});

describe('getCurrentCleanModeFromWaterBoxModeA187', () => {
  it('returns undefined if water_box_mode is undefined', () => {
    expect(getCurrentCleanModeFromWaterBoxModeA187(undefined)).toBeUndefined();
  });

  it('returns 4 for Smart plan', () => {
    expect(getCurrentCleanModeFromWaterBoxModeA187(MopWaterFlowA187.Smart)).toBe(4);
  });

  it('returns 8 for Custom', () => {
    expect(getCurrentCleanModeFromWaterBoxModeA187(MopWaterFlowA187.Custom)).toBe(8);
  });

  it('returns 6 for Vacuum', () => {
    expect(getCurrentCleanModeFromWaterBoxModeA187(MopWaterFlowA187.Off)).toBe(6);
  });

  it('returns undefined for other values', () => {
    expect(getCurrentCleanModeFromWaterBoxModeA187(12345)).toBeUndefined();
  });
});
