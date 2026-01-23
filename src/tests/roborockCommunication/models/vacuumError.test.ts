import { describe, test, expect } from 'vitest';
import { VacuumError } from '../../../roborockCommunication/models/vacuumError.js';
import { VacuumErrorCode, DockErrorCode } from '../../../roborockCommunication/enums/vacuumAndDockErrorCode.js';

describe('VacuumError helpers', () => {
  test('no error when both codes are zero', () => {
    const e = new VacuumError(VacuumErrorCode.None, DockErrorCode.None);
    expect(e.hasError()).toBe(false);
  });

  test('isStuck true for RobotTrapped', () => {
    const e = new VacuumError(VacuumErrorCode.RobotTrapped, DockErrorCode.None);
    expect(e.isStuck()).toBe(true);
    expect(e.hasError()).toBe(true);
  });

  test('isBatteryLow true for LowBattery', () => {
    const e = new VacuumError(VacuumErrorCode.LowBattery, DockErrorCode.None);
    expect(e.isBatteryLow()).toBe(true);
  });

  test('isBinFull true for CleanAutoEmptyDock or DuctBlockage', () => {
    const a = new VacuumError(VacuumErrorCode.CleanAutoEmptyDock, DockErrorCode.None);
    expect(a.isBinFull()).toBe(true);
    const b = new VacuumError(VacuumErrorCode.None, DockErrorCode.DuctBlockage);
    expect(b.isBinFull()).toBe(true);
  });

  test('isCleanWaterEmpty and isWasteWaterFull', () => {
    const a = new VacuumError(VacuumErrorCode.ClearWaterTankEmpty, DockErrorCode.None);
    expect(a.isCleanWaterEmpty()).toBe(true);
    const b = new VacuumError(VacuumErrorCode.None, DockErrorCode.WasteWaterTankFull);
    expect(b.isWasteWaterFull()).toBe(true);
  });
});
