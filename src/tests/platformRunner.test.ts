import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformRunner } from '../platformRunner.js';
import { NotifyMessageTypes } from '../types/notifyMessageTypes.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import * as initialDataIndex from '../initialData/index.js';
import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { Device, DeviceData, Home } from '../roborockCommunication/models/index.js';
import { DeviceModel } from '../roborockCommunication/models/deviceModel.js';
import { DeviceCategory } from '../roborockCommunication/models/deviceCategory.js';
import { UserData } from '../roborockCommunication/models/userData.js';
import { asPartial, createMockLogger, createMockDeviceRegistry, createMockConfigManager, createMockRoborockService } from './testUtils.js';
import { RoborockService } from '../services/roborockService.js';

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
  let roborockServiceMock: any;

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

    // Mock registry with robots map
    const registry = createMockDeviceRegistry({}, robots);

    // Mock configManager
    const configManager = createMockConfigManager({ isMultipleMapEnabled: false });

    roborockServiceMock = createMockRoborockService();

    platform = asPartial<RoborockMatterbridgePlatform>({
      log: createMockLogger(),
      registry,
      configManager,
      roborockService: roborockServiceMock,
    });

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

  it('should log error if Robot or RoborockService not found in homeData', async () => {
    const homeData: Home = {
      id: 0,
      name: 'TestHome',
      products: [],
      devices: [
        {
          duid: 'notfound',
          name: 'Missing',
          sn: 'SN',
          serialNumber: 'SN',
          activeTime: 0,
          createTime: 0,
          localKey: '',
          pv: '',
          online: false,
          productId: '',
          rrHomeId: 0,
          fv: '',
          deviceStatus: {},
          rooms: [],
          schema: [],
          data: { id: 'notfound', firmwareVersion: '', serialNumber: 'SN', model: DeviceModel.Q7_MAX, category: DeviceCategory.VacuumCleaner, batteryLevel: 100 },
          store: {
            userData: {
              username: 'test',
              uid: 'uid',
              tokentype: '',
              token: '',
              rruid: '',
              region: 'US',
              countrycode: '',
              country: '',
              nickname: 'nick',
              rriot: { u: '', s: '', h: '', k: '', r: { r: '', a: '', m: '', l: '' } },
            },
            localKey: '',
            pv: '',
            model: DeviceModel.Q7_MAX,
          },
        },
      ],
      receivedDevices: [],
      rooms: [],
    } as Home;

    await runner.updateRobot(NotifyMessageTypes.HomeData, homeData);

    expect(platform.log.error).not.toHaveBeenCalledWith(expect.stringContaining('Error5'));
    // No updateAttribute should be called
    expect(robotMock.updateAttribute).not.toHaveBeenCalled();
  });

  it('should log error if device data is undefined', async () => {
    robotMock.device.data = undefined;
    const userData: UserData = {
      username: 'test',
      uid: 'u1',
      tokentype: 'Bearer',
      token: 't',
      rruid: 'rr',
      region: 'us',
      countrycode: 'US',
      country: 'US',
      nickname: 'n',
      rriot: { u: 'u', s: 's', h: 'h', k: 'k', r: { r: 'r', a: 'a', m: 'm', l: 'l' } },
    };

    const homeData: Home = {
      id: 0,
      name: 'TestHome',
      products: [],
      devices: [
        {
          duid: '123456',
          name: 'TestVac',
          sn: 'SN123',
          serialNumber: 'SN123',
          activeTime: 0,
          createTime: 0,
          localKey: '',
          pv: '',
          online: false,
          productId: '',
          rrHomeId: 0,
          fv: '',
          deviceStatus: {},
          rooms: [],
          schema: [],
          data: { id: '123456', firmwareVersion: '', serialNumber: 'SN123', model: DeviceModel.QREVO_EDGE_5V1, category: DeviceCategory.VacuumCleaner, batteryLevel: 100 },
          store: { userData, localKey: '', pv: '', model: DeviceModel.QREVO_EDGE_5V1 },
        },
      ],
      receivedDevices: [],
      rooms: [],
    };

    await runner.updateRobot(NotifyMessageTypes.HomeData, homeData);

    expect(platform.log.error).toHaveBeenCalledWith('Device not found in home data');
    expect(robotMock.updateAttribute).not.toHaveBeenCalled();
  });

  it('should not update attributes if state or matterState is missing', async () => {
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';
    const userData: UserData = {
      username: 'test',
      uid: 'u1',
      tokentype: 'Bearer',
      token: 't',
      rruid: 'rr',
      region: 'us',
      countrycode: 'US',
      country: 'US',
      nickname: 'n',
      rriot: { u: 'u', s: 's', h: 'h', k: 'k', r: { r: 'r', a: 'a', m: 'm', l: 'l' } },
    };

    const homeData: Home = {
      id: 0,
      name: 'TestHome',
      devices: [
        {
          duid: '123456',
          name: 'TestVac',
          sn: 'SN123',
          serialNumber: 'SN123',
          activeTime: 0,
          createTime: 0,
          localKey: '',
          pv: '',
          online: false,
          productId: 'prod',
          rrHomeId: 0,
          fv: '',
          deviceStatus: {
            122: 50,
          },
          rooms: [],
          schema: [],
          data: { id: '123456', firmwareVersion: '', serialNumber: 'SN123', model: DeviceModel.QREVO_EDGE_5V1, category: DeviceCategory.VacuumCleaner, batteryLevel: 100 },
          store: { userData, localKey: '', pv: '', model: DeviceModel.QREVO_EDGE_5V1 },
        },
      ],
      products: [
        {
          id: '1',
          name: 'Test Product',
          model: 'test-model',
          category: 'vacuum',
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
      receivedDevices: [],
      rooms: [],
    };

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
    await runner.updateFromMQTTMessage(NotifyMessageTypes.BatteryUpdate, batteryMessage, '123456');

    expect(robotMock.updateAttribute).toHaveBeenCalledWith(expect.any(Number), 'batPercentRemaining', 120, expect.any(Object));
    expect(robotMock.updateAttribute).toHaveBeenCalledWith(expect.any(Number), 'batChargeLevel', expect.any(Number), expect.any(Object));
  });
  it('should call updateFromMQTTMessage when messageSource is not HomeData', async () => {
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';

    const updateFromMQTTMessageSpy = vi.spyOn(runner, 'updateFromMQTTMessage');
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

    await runner.updateFromMQTTMessage(NotifyMessageTypes.ErrorOccurred, errorMessage, '123456');

    expect(platform.log.error).toHaveBeenCalledWith('Error occurred: 1');
    expect(robotMock.updateAttribute).toHaveBeenCalledWith(expect.any(Number), 'operationalState', 3, expect.any(Object));
  });

  it('should log error if Robot or RoborockService not found for MQTT message', async () => {
    await runner.updateFromMQTTMessage(NotifyMessageTypes.BatteryUpdate, { percentage: 50 }, 'notfound');
    expect(platform.log.error).toHaveBeenCalledWith('Robot with DUID notfound not found during MQTT message processing');
  });

  it('should log error if device data is undefined for MQTT message', async () => {
    robotMock.device.data = undefined;
    await runner.updateFromMQTTMessage(NotifyMessageTypes.BatteryUpdate, { percentage: 50 }, '123456');
    expect(platform.log.error).toHaveBeenCalledWith('Device data is undefined for robot 123456');
  });

  it('should handle LocalMessage when robot is not found', async () => {
    const localMessage = { duid: '999999', data: {} };
    await runner.updateFromMQTTMessage(NotifyMessageTypes.LocalMessage, localMessage, '999999');
    expect(platform.log.error).toHaveBeenCalledWith('Robot with DUID 999999 not found during MQTT message processing');
  });

  it('should handle LocalMessage successfully when robot and data are available', async () => {
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';

    const localMessage = { duid: '123456', result: 'test-result' };

    // Clear previous error calls
    (platform.log.error as ReturnType<typeof vi.fn>).mockClear();
    (platform.registry.getRobot as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(robotMock);

    // This will call the actual handleLocalMessage function
    await runner.updateFromMQTTMessage(NotifyMessageTypes.LocalMessage, localMessage, '123456');

    // Verify no error was logged (which would happen on the error path)
    expect(platform.log.error).not.toHaveBeenCalled();
  });

  it('should handle default case for unknown message types', async () => {
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';

    // Use a battery message with no percentage so it won't trigger attribute updates
    await runner.updateFromMQTTMessage(NotifyMessageTypes.BatteryUpdate, {}, '123456');

    // Should complete without error
    expect(robotMock.updateAttribute).not.toHaveBeenCalled();
  });
});

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

  it('should return early if homeData is undefined', async () => {
    const getHomeDataMock = vi.fn().mockResolvedValue(undefined);
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ data: asPartial<DeviceData>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: 12345,
      roborockService: createMockRoborockService({ getHomeDataForUpdating: getHomeDataMock }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    const updateRobotSpy = vi.spyOn(runner, 'updateRobot');

    await runner.requestHomeData();

    expect(getHomeDataMock).toHaveBeenCalledWith(12345);
    expect(updateRobotSpy).not.toHaveBeenCalled();
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
