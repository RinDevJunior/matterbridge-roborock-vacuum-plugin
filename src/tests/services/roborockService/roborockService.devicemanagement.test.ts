import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../../../services/roborockService.js';
import { ServiceContainer } from '../../../services/serviceContainer.js';

describe('RoborockService - listDevices', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;

  beforeEach(() => {
    mockLogger = { debug: vi.fn(), error: vi.fn() } as any;

    roborockService = new RoborockService(
      {
        authenticateApiFactory: () => undefined as any,
        iotApiFactory: () => undefined as any,
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: {} as any,
        configManager: {} as any,
      },
      mockLogger,
      {} as any,
    );
  });

  it('should throw if not authenticated', async () => {
    await expect(roborockService.listDevices()).rejects.toThrow();
  });

  it('should throw if homeDetails is missing', async () => {
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
    const mockDeviceService = {
      listDevices: vi.fn().mockRejectedValue(new Error('getHomev3 failed')),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    await expect(roborockService.listDevices()).rejects.toThrow('getHomev3 failed');
  });

  it('should merge v3 devices and receivedDevices if v3 API is needed', async () => {
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

describe('getHomeDataForUpdating', () => {
  let service: RoborockService;
  let mockLogger: AnsiLogger;
  const homeid = 123;

  beforeEach(() => {
    mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() } as any;

    service = new RoborockService(
      {
        authenticateApiFactory: () => undefined as any,
        iotApiFactory: () => undefined as any,
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: {} as any,
        configManager: {} as any,
      },
      mockLogger,
      {} as any,
    );
  });

  it('should throw if not authenticated', async () => {
    const result = await service.getHomeDataForUpdating(homeid);
    expect(result).toBeUndefined();
  });
});

describe('Device Management Methods', () => {
  let service: RoborockService;
  let mockLogger: AnsiLogger;
  let mockContainer: ServiceContainer;
  const homeid = 123;

  beforeEach(() => {
    mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() } as any;
    mockContainer = {
      setUserData: vi.fn(),
      getIotApi: vi.fn(),
    } as unknown as ServiceContainer;
    service = new RoborockService(
      {
        authenticateApiFactory: () => undefined as any,
        iotApiFactory: () => undefined as any,
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: {} as any,
        configManager: {} as any,
      },
      mockLogger,
      mockContainer as any,
    );
  });

  it('should throw error when getting custom API without IoT API', async () => {
    (mockContainer.getIotApi as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    await expect(service.getCustomAPI('/test')).rejects.toThrow('IoT API not initialized. Please login first.');
  });

  it('should throw if not authenticated', async () => {
    const result = await service.getHomeDataForUpdating(homeid);
    expect(result).toBeUndefined();
  });
});
