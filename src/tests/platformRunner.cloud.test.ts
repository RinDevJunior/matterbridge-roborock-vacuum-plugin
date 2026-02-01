import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cloud handler before importing PlatformRunner
vi.mock('../runtimes/handleCloudMessage.js', () => ({
  handleCloudMessage: vi.fn(),
}));

import { PlatformRunner } from '../platformRunner.js';
import { NotifyMessageTypes } from '../types/notifyMessageTypes.js';
import { handleCloudMessage } from '../runtimes/handleCloudMessage.js';
import type { RoborockMatterbridgePlatform } from '../module.js';
import type { DeviceRegistry } from '../platform/deviceRegistry.js';
import { createMockLogger, asPartial, asType } from './helpers/testUtils.js';

describe('PlatformRunner CloudMessage handling', () => {
  let platform: Partial<RoborockMatterbridgePlatform>;
  let runner: PlatformRunner;
  let robotMock: { updateAttribute: ReturnType<typeof vi.fn>; device: { data: { model: string } }; serialNumber: string };

  beforeEach(() => {
    robotMock = {
      updateAttribute: vi.fn(),
      device: { data: { model: 'test' } },
      serialNumber: '123',
    };
    const robots = new Map<string, any>();
    robots.set('123', robotMock);

    platform = asPartial<RoborockMatterbridgePlatform>({
      log: createMockLogger(),
      registry: asPartial<DeviceRegistry>({
        getRobot: (duid: string) => robots.get(duid),
        robotsMap: robots,
      }),
    });

    runner = new PlatformRunner(asPartial<RoborockMatterbridgePlatform>(platform));
    asType<{ mockClear?: () => void }>(handleCloudMessage).mockClear?.();
  });

  it('calls handleCloudMessage when CloudMessage is received and robot exists', async () => {
    const data = { some: 'payload' };
    await runner.updateFromMQTTMessage(NotifyMessageTypes.CloudMessage, data, '123');
    expect(handleCloudMessage).toHaveBeenCalledWith(data, platform, runner, '123');
  });
});
