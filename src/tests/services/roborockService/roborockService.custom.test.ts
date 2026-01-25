import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';

describe('RoborockService (unit)', () => {
  let logger: any;
  let container: any;
  let authService: any;

  beforeEach(() => {
    logger = { debug: vi.fn(), notice: vi.fn(), error: vi.fn() };

    authService = {
      loginWithPassword: vi.fn(async (u: string, p: string) => ({ username: u, token: 't' })),
      loginWithVerificationCode: vi.fn(),
      loginWithCachedToken: vi.fn(),
      requestVerificationCode: vi.fn(),
    };

    // Minimal container mock used by RoborockService when injected
    container = {
      getAuthenticationService: () => authService,
      getDeviceManagementService: () => ({}),
      getAreaManagementService: () => ({ getSelectedAreas: () => [], getSupportedAreas: () => [] }),
      getMessageRoutingService: () => ({}),
      getPollingService: () => ({ setDeviceNotify: vi.fn(), activateDeviceNotifyOverLocal: vi.fn(), activateDeviceNotifyOverMQTT: vi.fn(), stopPolling: vi.fn() }),
      setUserData: vi.fn(),
      getIotApi: () => undefined,
    };
  });

  it('getCustomAPI throws when IoT API not initialized', async () => {
    const svc = new RoborockService(
      {
        authenticateApiFactory: () => undefined as any,
        iotApiFactory: () => undefined as any,
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: {} as any,
        configManager: {} as any,
      },
      logger as any,
      container as any,
    );
    await expect(svc.getCustomAPI('/some')).rejects.toThrow(/IoT API not initialized/);
  });
});
