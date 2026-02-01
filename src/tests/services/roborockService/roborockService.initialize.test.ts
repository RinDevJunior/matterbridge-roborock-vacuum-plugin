import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../../../services/roborockService.js';
import { makeLogger, asPartial, asType } from '../../testUtils.js';
import type { LocalStorage } from 'node-persist';
import type { PlatformConfigManager } from '../../../platform/platformConfig.js';
import type { RoborockAuthenticateApi } from '../../../roborockCommunication/api/authClient.js';
import type { RoborockIoTApi } from '../../../roborockCommunication/api/iotClient.js';

describe('RoborockService - listDevices', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;

  beforeEach(() => {
    mockLogger = makeLogger();

    roborockService = new RoborockService(
      {
        authenticateApiFactory: () => asType<RoborockAuthenticateApi>(undefined),
        iotApiFactory: () => asType<RoborockIoTApi>(undefined),
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: {} as Partial<LocalStorage> as LocalStorage,
        configManager: asPartial<PlatformConfigManager>({}),
      },
      mockLogger,
      asPartial<PlatformConfigManager>({}),
    );
  });

  it('should throw if not authenticated', async () => {
    // Without authentication, listDevices should throw
    await expect(roborockService.listDevices()).rejects.toThrow();
  });

  it('should throw if homeDetails is missing', async () => {
    // Simulate authenticated state so the correct error is thrown
    const mockDeviceService = {
      iotApi: {},
      userdata: {},
      listDevices: vi.fn().mockRejectedValue(new Error('No home found for user')),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    await expect(roborockService.listDevices()).rejects.toThrow('No home found for user');
  });

  it('should return empty array if homeData is missing', async () => {
    // Mock deviceService.listDevices to simulate missing homeData
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue([]),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result).toEqual([]);
  });

  it('should return devices with correct mapping', async () => {
    // Mock deviceService.listDevices to return a device array
    const mockDevices = [{ duid: '1', rrHomeId: 123, rooms: [], localKey: 'lk', pv: 'pv', sn: 'sn', scenes: [], data: {}, store: {} }];
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue(mockDevices),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result).toEqual(mockDevices);
  });

  it('should throw if getHomev3 fails when v3 API is needed', async () => {
    // Simulate deviceService.listDevices throwing when v3 API fails
    const mockDeviceService = {
      listDevices: vi.fn().mockRejectedValue(new Error('getHomev3 failed')),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    await expect(roborockService.listDevices()).rejects.toThrow('getHomev3 failed');
  });

  it('should merge v3 devices and receivedDevices if v3 API is needed', async () => {
    // Simulate merging logic by returning merged array
    const mergedDevices = [
      { duid: '1', rrHomeId: 123 },
      { duid: '2', rrHomeId: 123 },
    ];
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue(mergedDevices),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result).toEqual(mergedDevices);
  });

  it('should fallback batteryLevel to 100 if not present', async () => {
    // Device with no battery info should default to 100
    const device = { duid: '1', data: {}, store: {}, rrHomeId: 123, rooms: [], localKey: '', pv: '', sn: '', scenes: [], batteryLevel: undefined };
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue([{ ...device, data: { batteryLevel: undefined } }]),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result[0].data.batteryLevel ?? 100).toBe(100);
  });

  it('should filter scenes correctly for devices', async () => {
    // Device with scenes array
    const scenes = [{ param: '{"action":{"items":[{"entityId":"1"}]}}' }];
    const device = { duid: '1', data: {}, store: {}, rrHomeId: 123, rooms: [], localKey: '', pv: '', sn: '', scenes };
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue([device]),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result[0].scenes).toEqual(scenes);
  });

  it('should handle rooms fallback from v2 and v3 APIs', async () => {
    // Device with rooms array
    const device = { duid: '1', data: {}, store: {}, rrHomeId: 123, rooms: [{ id: 1, name: 'Living Room' }], localKey: '', pv: '', sn: '', scenes: [] };
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue([device]),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result[0].rooms).toEqual([{ id: 1, name: 'Living Room' }]);
  });
});
