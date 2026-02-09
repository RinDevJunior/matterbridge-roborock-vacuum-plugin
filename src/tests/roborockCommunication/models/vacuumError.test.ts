import { describe, test, expect } from 'vitest';
import { VacuumError } from '../../../roborockCommunication/models/vacuumError.js';
import { VacuumErrorCode, DockErrorCode } from '../../../roborockCommunication/enums/vacuumAndDockErrorCode.js';

describe('VacuumError helpers', () => {
  test('no error when both codes are zero', () => {
    const e = new VacuumError('test-duid', VacuumErrorCode.None, DockErrorCode.None, 168);
    expect(e.hasError()).toBe(false);
  });

  test('isStuck true for RobotTrapped', () => {
    const e = new VacuumError('test-duid', VacuumErrorCode.RobotTrapped, DockErrorCode.None, 168);
    expect(e.isStuck()).toBe(true);
    expect(e.hasError()).toBe(true);
  });

  test('isBatteryLow true for LowBattery', () => {
    const e = new VacuumError('test-duid', VacuumErrorCode.LowBattery, DockErrorCode.None, 168);
    expect(e.isBatteryLow()).toBe(true);
  });

  test('isBinFull true for CleanAutoEmptyDock or DuctBlockage', () => {
    const a = new VacuumError('test-duid', VacuumErrorCode.CleanAutoEmptyDock, DockErrorCode.None, 168);
    expect(a.isBinFull()).toBe(true);
    const b = new VacuumError('test-duid', VacuumErrorCode.None, DockErrorCode.DuctBlockage, 168);
    expect(b.isBinFull()).toBe(true);
  });

  test('isCleanWaterEmpty and isWasteWaterFull', () => {
    const a = new VacuumError('test-duid', VacuumErrorCode.ClearWaterTankEmpty, DockErrorCode.None, 168);
    expect(a.isCleanWaterEmpty()).toBe(true);
    const b = new VacuumError('test-duid', VacuumErrorCode.None, DockErrorCode.WasteWaterTankFull, 168);
    expect(b.isWasteWaterFull()).toBe(true);
  });
});
