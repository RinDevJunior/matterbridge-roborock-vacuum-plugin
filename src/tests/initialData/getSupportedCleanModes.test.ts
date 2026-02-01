import { getSupportedCleanModes } from '../../initialData/getSupportedCleanModes.js';
import { DeviceModel } from '../../roborockCommunication/models/deviceModel.js';
import { describe, it, expect } from 'vitest';
import { asPartial, createMockConfigManager } from '../helpers/testUtils.js';

describe('getSupportedCleanModes', () => {
  it('returns smart modes for QREVO models', () => {
    const setting = createMockConfigManager({ useVacationModeToSendVacuumToDock: false });
    const modes = getSupportedCleanModes(DeviceModel.QREVO_EDGE_5V1, setting);
    expect(modes.some((m) => m.mode === 4)).toBe(true);
    expect(modes.some((m) => m.mode === 5)).toBe(true);
  });

  it('returns default modes when forceRunAtDefault is true', () => {
    const setting = createMockConfigManager({ useVacationModeToSendVacuumToDock: false, forceRunAtDefault: true });
    const modes = getSupportedCleanModes(DeviceModel.QREVO_EDGE_5V1, setting);
    // default list contains mode 6 per default implementation
    expect(modes.some((m) => m.mode === 6)).toBe(true);
  });

  it('returns default modes for other models', () => {
    const setting = createMockConfigManager({ useVacationModeToSendVacuumToDock: false });
    const modes = getSupportedCleanModes(DeviceModel.S7_MAXV, setting);
    expect(modes.some((m) => m.mode === 6)).toBe(true);
  });
});
