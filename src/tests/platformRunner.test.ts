import { PlatformRunner } from '../platformRunner';
import { NotifyMessageTypes } from '../notifyMessageTypes';
import { RoborockMatterbridgePlatform } from '../platform';
import { Home } from '../roborockCommunication';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('PlatformRunner.updateRobot', () => {
  let platform: RoborockMatterbridgePlatform;
  let runner: PlatformRunner;

  beforeEach(() => {
    platform = {
      robot: {
        serialNumber: '123456',
        device: { data: { model: 'roborock.vacuum.a187' }, updateAttribute: jest.fn() },
        updateAttribute: jest.fn(),
      },
      log: {
        error: jest.fn(),
        debug: jest.fn(),
        notice: jest.fn(),
      },
    } as unknown as RoborockMatterbridgePlatform;

    runner = new PlatformRunner(platform);
  });

  it('should set correct attributes from homeData', async () => {
    const homeDataPath = path.join(__dirname, 'testData', 'mockHomeData-a187.json');
    const homeData: Home = JSON.parse(fs.readFileSync(homeDataPath, 'utf-8'));

    await runner.updateRobot(NotifyMessageTypes.HomeData, homeData);

    const calls = (platform.robot?.updateAttribute as jest.Mock).mock.calls;

    // Kiểm tra các attribute cụ thể đã được set
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
});
