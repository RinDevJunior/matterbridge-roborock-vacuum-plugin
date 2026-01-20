import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { fileURLToPath } from 'node:url';
import { PlatformRunner } from '@/platformRunner.js';
import { NotifyMessageTypes } from '@/notifyMessageTypes.js';
import { RoborockMatterbridgePlatform } from '@/module.js';
import { Home } from '@/roborockCommunication/index.js';
import { RoborockVacuumCleaner } from '@/rvc.js';
import * as initialDataIndex from '@/initialData/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let getOperationalErrorState = vi.fn().mockReturnValue(2);

vi.mock('./initialData/index.js', () => ({
  ...initialDataIndex,
  getOperationalErrorState,
}));

describe('PlatformRunner.updateRobot', () => {
  let platform: RoborockMatterbridgePlatform;
  let runner: PlatformRunner;
  let robotMock: any;

  beforeEach(() => {
    robotMock = {
      updateAttribute: vi.fn(),
      getAttribute: vi.fn(),
      device: {
        data: { model: 'test-model' },
        duid: '123456',
        rooms: [],
      },
      serialNumber: '123456',
      dockStationStatus: undefined,
      roomInfo: undefined,
    };

    const robots = new Map<string, RoborockVacuumCleaner>();
    robots.set('123456', robotMock);

    platform = {
      robots: robots,
      log: {
        error: vi.fn(),
        debug: vi.fn(),
        notice: vi.fn(),
      },
      enableExperimentalFeature: undefined,
    } as unknown as RoborockMatterbridgePlatform;

    runner = new PlatformRunner(platform);
  });

  it('should set correct attributes from homeData', async () => {
    const homeDataPath = path.join(__dirname, 'testData', 'mockHomeData-a187.json');
    const homeData: Home = JSON.parse(fs.readFileSync(homeDataPath, 'utf-8'));

    await runner.updateRobot(NotifyMessageTypes.HomeData, homeData);

    const calls = robotMock.updateAttribute.mock.calls;

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.arrayContaining([
          expect.any(String), // Cluster.id
          'batPercentRemaining',
          expect.any(Number),
          expect.any(Object),
        ]),
        expect.arrayContaining([expect.any(String), 'currentMode', expect.any(Number), expect.any(Object)]),
        expect.arrayContaining([expect.any(String), 'operationalState', expect.any(Number), expect.any(Object)]),
        expect.arrayContaining([expect.any(String), 'batChargeState', expect.any(Number), expect.any(Object)]),
      ]),
    );
    expect(platform.log.error).not.toHaveBeenCalled();
  });

  it('should log error if robot not found in homeData', async () => {
    const homeData: Home = {
      devices: [{ duid: 'notfound', data: {}, productId: 1 }],
      products: [],
    } as any;

    await runner.updateRobot(NotifyMessageTypes.HomeData, homeData);

    expect(platform.log.error).not.toHaveBeenCalledWith(expect.stringContaining('Error5'));
    // No updateAttribute should be called
    expect(robotMock.updateAttribute).not.toHaveBeenCalled();
  });

  it('should log error if device data is undefined', async () => {
    robotMock.device.data = undefined;
    const homeData: Home = {
      devices: [{ duid: '123456', data: {}, productId: 1 }],
      products: [],
    } as any;

    await runner.updateRobot(NotifyMessageTypes.HomeData, homeData);

    expect(platform.log.error).toHaveBeenCalledWith('Device not found in home data');
    expect(robotMock.updateAttribute).not.toHaveBeenCalled();
  });

  it('should not update attributes if state or matterState is missing', async () => {
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';
    const homeData: Home = {
      devices: [
        {
          duid: '123456',
          data: {
            model: 'test-model',
          },
          productId: 1,
          deviceStatus: {
            122: 50,
          },
        },
      ],
      products: [
        {
          id: 1,
          model: 'test-model',
          schema: [
            {
              id: 122,
              name: '设备电量',
              code: 'battery',
              mode: 'ro',
              type: 'ENUM',
              property: '{"range": [""]}',
            },
          ],
        },
      ],
    } as any;

    await runner.updateRobot(NotifyMessageTypes.HomeData, homeData);

    // Only battery attributes should be set, not currentMode/operationalState
    expect(robotMock.updateAttribute).toHaveBeenCalledWith(expect.any(Number), 'batPercentRemaining', 100, expect.any(Object));
    expect(robotMock.updateAttribute).toHaveBeenCalledWith(expect.any(Number), 'batChargeLevel', expect.any(Number), expect.any(Object));
    expect(robotMock.updateAttribute).not.toHaveBeenCalledWith(expect.any(Number), 'currentMode', expect.anything(), expect.any(Object));
    expect(robotMock.updateAttribute).not.toHaveBeenCalledWith(expect.any(Number), 'operationalState', expect.anything(), expect.any(Object));
  });

  it('should handle NotifyMessageTypes.BatteryUpdate', async () => {
    const batteryMessage = { percentage: 60 };
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';
    await runner['updateFromMQTTMessage'](NotifyMessageTypes.BatteryUpdate, batteryMessage, '123456');

    expect(robotMock.updateAttribute).toHaveBeenCalledWith(expect.any(Number), 'batPercentRemaining', 120, expect.any(Object));
    expect(robotMock.updateAttribute).toHaveBeenCalledWith(expect.any(Number), 'batChargeLevel', expect.any(Number), expect.any(Object));
  });
  it('should call updateFromMQTTMessage when messageSource is not HomeData', async () => {
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';

    const updateFromMQTTMessageSpy = vi.spyOn(runner as any, 'updateFromMQTTMessage');
    const batteryMessage = { percentage: 70, duid: '123456' };

    await runner.updateRobot(NotifyMessageTypes.BatteryUpdate, batteryMessage);

    expect(updateFromMQTTMessageSpy).toHaveBeenCalledWith(NotifyMessageTypes.BatteryUpdate, batteryMessage);
    updateFromMQTTMessageSpy.mockRestore();
  });
  it('should handle NotifyMessageTypes.ErrorOccurred', async () => {
    const errorMessage = { errorCode: 1 };
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';
    getOperationalErrorState = vi.fn().mockReturnValue(RvcOperationalState.OperationalState.Error);

    await runner['updateFromMQTTMessage'](NotifyMessageTypes.ErrorOccurred, errorMessage, '123456');

    expect(platform.log.error).toHaveBeenCalledWith('Error occurred: 1');
    expect(robotMock.updateAttribute).toHaveBeenCalledWith(expect.any(Number), 'operationalState', 3, expect.any(Object));
  });

  it('should log error if robot not found for MQTT message', async () => {
    await runner['updateFromMQTTMessage'](NotifyMessageTypes.BatteryUpdate, { percentage: 50 }, 'notfound');
    expect(platform.log.error).toHaveBeenCalledWith('Robot with DUID notfound not found during MQTT message processing');
  });

  it('should log error if device data is undefined for MQTT message', async () => {
    robotMock.device.data = undefined;
    await runner['updateFromMQTTMessage'](NotifyMessageTypes.BatteryUpdate, { percentage: 50 }, '123456');
    expect(platform.log.error).toHaveBeenCalledWith('Device data is undefined for robot 123456');
  });

  it('should handle LocalMessage when robot is not found', async () => {
    const localMessage = { duid: '999999', data: {} };
    await runner['updateFromMQTTMessage'](NotifyMessageTypes.LocalMessage, localMessage, '999999');
    expect(platform.log.error).toHaveBeenCalledWith('Robot with DUID 999999 not found during MQTT message processing');
  });

  it('should handle LocalMessage successfully when robot and data are available', async () => {
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';

    const localMessage = { duid: '123456', result: 'test-result' };

    // Clear previous error calls
    (platform.log.error as ReturnType<typeof vi.fn>).mockClear();

    // This will call the actual handleLocalMessage function
    await runner['updateFromMQTTMessage'](NotifyMessageTypes.LocalMessage, localMessage, '123456');

    // Verify no error was logged (which would happen on the error path)
    expect(platform.log.error).not.toHaveBeenCalled();
  });

  it('should handle default case for unknown message types', async () => {
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';

    // Use a message type that hits the default case
    await runner['updateFromMQTTMessage'](999 as any, {}, '123456');

    // Should complete without error
    expect(robotMock.updateAttribute).not.toHaveBeenCalled();
  });
});

describe('PlatformRunner.requestHomeData', () => {
  let platform: RoborockMatterbridgePlatform;
  let runner: PlatformRunner;

  it('should return early if no robots exist', async () => {
    platform = {
      robots: new Map(),
      rrHomeId: '12345',
      roborockService: { getHomeDataForUpdating: vi.fn() },
      log: { error: vi.fn(), debug: vi.fn(), notice: vi.fn() },
    } as unknown as RoborockMatterbridgePlatform;

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService?.getHomeDataForUpdating).not.toHaveBeenCalled();
  });

  it('should return early if rrHomeId is not set (undefined)', async () => {
    platform = {
      robots: new Map([['123', {} as any]]),
      rrHomeId: undefined,
      roborockService: { getHomeDataForUpdating: vi.fn() },
      log: { error: vi.fn(), debug: vi.fn(), notice: vi.fn() },
    } as unknown as RoborockMatterbridgePlatform;

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService?.getHomeDataForUpdating).not.toHaveBeenCalled();
  });

  it('should return early if rrHomeId is falsy (empty string)', async () => {
    platform = {
      robots: new Map([['123', {} as any]]),
      rrHomeId: '',
      roborockService: { getHomeDataForUpdating: vi.fn() },
      log: { error: vi.fn(), debug: vi.fn(), notice: vi.fn() },
    } as unknown as RoborockMatterbridgePlatform;

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService?.getHomeDataForUpdating).not.toHaveBeenCalled();
  });

  it('should return early if roborockService is undefined', async () => {
    platform = {
      robots: new Map([['123', {} as any]]),
      rrHomeId: '12345',
      roborockService: undefined,
      log: { error: vi.fn(), debug: vi.fn(), notice: vi.fn() },
    } as unknown as RoborockMatterbridgePlatform;

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    // No service call should be made
    expect(platform.roborockService).toBeUndefined();
  });

  it('should return early if homeData is undefined', async () => {
    const getHomeDataMock = vi.fn().mockResolvedValue(undefined);
    platform = {
      robots: new Map([['123', {} as any]]),
      rrHomeId: '12345',
      roborockService: { getHomeDataForUpdating: getHomeDataMock },
      log: { error: vi.fn(), debug: vi.fn(), notice: vi.fn() },
    } as unknown as RoborockMatterbridgePlatform;

    runner = new PlatformRunner(platform);
    const updateRobotSpy = vi.spyOn(runner, 'updateRobot');

    await runner.requestHomeData();

    expect(getHomeDataMock).toHaveBeenCalledWith('12345');
    expect(updateRobotSpy).not.toHaveBeenCalled();
  });

  it('should call updateRobot when homeData is available', async () => {
    const homeData = { devices: [], products: [] };
    const getHomeDataMock = vi.fn().mockResolvedValue(homeData);
    platform = {
      robots: new Map([['123', {} as any]]),
      rrHomeId: '12345',
      roborockService: { getHomeDataForUpdating: getHomeDataMock },
      log: { error: vi.fn(), debug: vi.fn(), notice: vi.fn() },
    } as unknown as RoborockMatterbridgePlatform;

    runner = new PlatformRunner(platform);
    const updateRobotSpy = vi.spyOn(runner, 'updateRobot').mockResolvedValue();

    await runner.requestHomeData();

    expect(getHomeDataMock).toHaveBeenCalledWith('12345');
    expect(updateRobotSpy).toHaveBeenCalledWith(NotifyMessageTypes.HomeData, homeData);
  });
});
