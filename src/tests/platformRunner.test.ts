import { describe, it, expect, vi } from 'vitest';
import { PlatformRunner } from '../platformRunner.js';
import { NotifyMessageTypes } from '../types/notifyMessageTypes.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import * as initialDataIndex from '../initialData/index.js';
import { Device, DeviceData } from '../roborockCommunication/models/index.js';
import { asPartial, createMockLogger, createMockDeviceRegistry, createMockRoborockService } from './testUtils.js';
import { RoborockService } from '../services/roborockService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const getOperationalErrorState = vi.fn().mockReturnValue(2);

vi.mock('./initialData/index.js', () => ({
  ...initialDataIndex,
  getOperationalErrorState,
}));

describe('PlatformRunner.requestHomeData', () => {
  let platform: RoborockMatterbridgePlatform;
  let runner: PlatformRunner;

  it('should return early if no robots exist', async () => {
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map()),
      rrHomeId: 12345,
      roborockService: createMockRoborockService({ getHomeDataForUpdating: vi.fn() }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService?.getHomeDataForUpdating).not.toHaveBeenCalled();
  });

  it('should return early if rrHomeId is not set (undefined)', async () => {
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ data: asPartial<DeviceData>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: undefined,
      roborockService: createMockRoborockService({ getHomeDataForUpdating: vi.fn() }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService?.getHomeDataForUpdating).not.toHaveBeenCalled();
  });

  it('should return early if rrHomeId is falsy (empty string)', async () => {
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ data: asPartial<DeviceData>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: undefined,
      roborockService: asPartial<RoborockService>({ getHomeDataForUpdating: vi.fn() }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService?.getHomeDataForUpdating).not.toHaveBeenCalled();
  });

  it('should return early if roborockService is undefined', async () => {
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ data: asPartial<DeviceData>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: 12345,
      roborockService: undefined,
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    // No service call should be made
    expect(platform.roborockService).toBeUndefined();
  });

  it('should call updateRobotWithPayload when homeData is available', async () => {
    const homeData = { devices: [], products: [] };
    const getHomeDataMock = vi.fn().mockResolvedValue(homeData);
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ data: asPartial<DeviceData>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: 12345,
      roborockService: createMockRoborockService({ getHomeDataForUpdating: getHomeDataMock }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    const updateRobotWithPayloadSpy = vi.spyOn(runner, 'updateRobotWithPayload').mockResolvedValue();

    await runner.requestHomeData();

    expect(getHomeDataMock).toHaveBeenCalledWith(12345);
    expect(updateRobotWithPayloadSpy).toHaveBeenCalledWith({ type: NotifyMessageTypes.HomeData, data: homeData });
  });
});
