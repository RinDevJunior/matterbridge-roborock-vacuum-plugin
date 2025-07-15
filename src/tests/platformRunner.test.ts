import { PlatformRunner } from '../platformRunner';
import { NotifyMessageTypes } from '../notifyMessageTypes';
import { RoborockMatterbridgePlatform } from '../platform';
import { Home } from '../roborockCommunication';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RoborockVacuumCleaner } from '../rvc';
import * as initialDataIndex from '../initialData/index';
import { RvcOperationalState } from 'matterbridge/matter/clusters';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let getOperationalErrorState = jest.fn().mockReturnValue(2);

jest.mock('./src/initialData/index', () => ({
  ...initialDataIndex,
  getOperationalErrorState,
}));

describe('PlatformRunner.updateRobot', () => {
  let platform: RoborockMatterbridgePlatform;
  let runner: PlatformRunner;
  let robotMock: any;

  beforeEach(() => {
    robotMock = {
      updateAttribute: jest.fn(),
      getAttribute: jest.fn(),
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
        error: jest.fn(),
        debug: jest.fn(),
        notice: jest.fn(),
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

  it('should handle NotifyMessageTypes.ErrorOccurred', async () => {
    const errorMessage = { errorCode: 1 };
    robotMock.device.data = { model: 'test-model' };
    robotMock.serialNumber = '123456';
    getOperationalErrorState = jest.fn().mockReturnValue(RvcOperationalState.OperationalState.Error);

    await runner['updateFromMQTTMessage'](NotifyMessageTypes.ErrorOccurred, errorMessage, '123456');

    expect(platform.log.error).toHaveBeenCalledWith('Error occurred: 1');
    expect(robotMock.updateAttribute).toHaveBeenCalledWith(expect.any(Number), 'operationalState', 3, expect.any(Object));
  });

  it('should log error if robot not found for MQTT message', async () => {
    await runner['updateFromMQTTMessage'](NotifyMessageTypes.BatteryUpdate, { percentage: 50 }, 'notfound');
    expect(platform.log.error).toHaveBeenCalledWith('Error1: Robot with DUID notfound not found');
  });

  it('should log error if device data is undefined for MQTT message', async () => {
    robotMock.device.data = undefined;
    await runner['updateFromMQTTMessage'](NotifyMessageTypes.BatteryUpdate, { percentage: 50 }, '123456');
    expect(platform.log.error).toHaveBeenCalledWith('Device data is undefined');
  });

  it('should log error if robot serial number is undefined for MQTT message', async () => {
    robotMock.serialNumber = undefined;
    robotMock.device.data = { model: 'test-model' };
    await runner['updateFromMQTTMessage'](NotifyMessageTypes.BatteryUpdate, { percentage: 50 }, '123456');
    expect(platform.log.error).toHaveBeenCalledWith('Robot serial number is undefined');
  });
});
