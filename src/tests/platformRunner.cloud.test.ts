import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cloud handler before importing PlatformRunner
vi.mock('../runtimes/handleCloudMessage.js', () => ({
  handleCloudMessage: vi.fn(),
}));

import { PlatformRunner } from '../platformRunner.js';
import { NotifyMessageTypes } from '../notifyMessageTypes.js';
import { handleCloudMessage } from '../runtimes/handleCloudMessage.js';

describe('PlatformRunner CloudMessage handling', () => {
  let platform: any;
  let runner: PlatformRunner;
  let robotMock: any;

  beforeEach(() => {
    robotMock = {
      updateAttribute: vi.fn(),
      device: { data: { model: 'test' } },
      serialNumber: '123',
    };
    const robots = new Map<string, any>();
    robots.set('123', robotMock);

    platform = {
      robots,
      log: { error: vi.fn(), debug: vi.fn(), notice: vi.fn() },
    } as any;

    runner = new PlatformRunner(platform as any);
    if ((handleCloudMessage as any)?.mockClear) {
      (handleCloudMessage as any).mockClear();
    }
  });

  it('calls handleCloudMessage when CloudMessage is received and robot exists', async () => {
    const data = { some: 'payload' };
    await runner.updateFromMQTTMessage(NotifyMessageTypes.CloudMessage, data, '123');
    expect(handleCloudMessage as any).toHaveBeenCalledWith(data, platform, runner, '123');
  });
});
