import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';
import { Device } from '../../../roborockCommunication/models/index.js';

describe('RoborockService - Polling', () => {
  let roborockService: RoborockService;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() };
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

  it('activateDeviceNotify delegates to device service', () => {
    const device: Device = { duid: 'test-duid' } as Device;

    // Test that method exists and doesn't throw with basic call
    expect(() => {
      roborockService.activateDeviceNotify(device);
    }).not.toThrow();
  });
});
