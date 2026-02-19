import { getVacuumProperty, isSupportedDevice, isStatusUpdate } from '../share/helper.js';
import { describe, test, expect, vi } from 'vitest';
import { type Device } from '../roborockCommunication/models/index.js';
import { asType } from './testUtils.js';

describe('helper utilities', () => {
  test('getVacuumProperty returns undefined with no device', () => {
    expect(getVacuumProperty(asType<Device>(undefined), 'p')).toBeUndefined();
  });

  test('getVacuumProperty reads via schema id and direct property', () => {
    const device: any = {
      schema: [{ code: 'prop', id: '1' }],
      deviceStatus: { '1': '42', prop2: '7' },
    };

    expect(getVacuumProperty(device, 'prop')).toBe(42);
    expect(getVacuumProperty(device, 'prop2')).toBe(7);
  });

  test('isSupportedDevice', () => {
    expect(isSupportedDevice('roborock.vacuum.s5')).toBe(true);
    expect(isSupportedDevice('other.model')).toBe(false);
  });

  test('isStatusUpdate positive and negative', () => {
    expect(isStatusUpdate([{ msg_ver: '1' }])).toBe(true);
    expect(isStatusUpdate([])).toBe(false);
    expect(isStatusUpdate([asType(null)])).toBe(false);
    expect(isStatusUpdate([{}])).toBe(false);
  });
});

const mockLog = {
  notice: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  verbose: vi.fn(),
};

const mockRoborockService = {
  getRoomMap: vi.fn(),
  getMapInfo: vi.fn(),
};

const mockPlatform = {
  log: mockLog,
  roborockService: mockRoborockService,
  configManager: { isMultipleMapEnabled: false },
};
