import { PlatformRunner } from '../platformRunner';
import { NotifyMessageTypes } from '../notifyMessageTypes';
import { RoborockMatterbridgePlatform } from '../platform';
import { RoborockVacuumCleaner } from '../rvc';

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

  it('should handle unknown message types gracefully', async () => {
    const mapUpdated = { duid: '123456', dps: { 128: 4 } };
    await runner['updateFromMQTTMessage'](NotifyMessageTypes.CloudMessage, mapUpdated, '123456');
    expect(platform.log.notice).toHaveBeenCalled();
  });
});
