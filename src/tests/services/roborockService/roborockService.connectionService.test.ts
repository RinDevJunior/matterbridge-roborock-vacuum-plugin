import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';

describe('initializeMessageClientForLocal', () => {
  let service: RoborockService;
  let mockLogger: any;
  let mockDevice: any;

  beforeEach(() => {
    mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() };
    mockDevice = { duid: 'd1', pv: 'pv', data: { model: 'm1' }, localKey: 'lk' };

    service = new RoborockService(
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false if messageClient is not initialized', async () => {
    // Without message client setup, should throw error
    await expect(service.initializeMessageClientForLocal(mockDevice)).rejects.toThrow('Message client not initialized in ConnectionService');
  });
});
