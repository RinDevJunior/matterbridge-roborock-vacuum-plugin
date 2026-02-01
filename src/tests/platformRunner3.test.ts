import { RoborockMatterbridgePlatform } from '../module.js';
import { NotifyMessageTypes } from '../types/notifyMessageTypes.js';
import { PlatformRunner } from '../platformRunner.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { asPartial, createMockLogger, createMockDeviceRegistry, createMockConfigManager, createMockRoborockService } from './testUtils.js';

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

    const registry = createMockDeviceRegistry({}, robots as unknown as Map<string, RoborockVacuumCleaner>);

    const configManager = createMockConfigManager({ isMultipleMapEnabled: false });

    platform = asPartial<RoborockMatterbridgePlatform>({
      log: createMockLogger(),
      roborockService: createMockRoborockService(),
      registry: registry,
      configManager: configManager,
    });

    runner = new PlatformRunner(platform);
  });

  it('should handle unknown message types gracefully', async () => {
    const mapUpdated = { duid: '123456', dps: { 128: 4 } };
    await runner.updateFromMQTTMessage(NotifyMessageTypes.CloudMessage, mapUpdated, '123456');
    expect(platform.log.notice).toHaveBeenCalled();
    expect(platform.log.error).not.toHaveBeenCalled();
  });
});
