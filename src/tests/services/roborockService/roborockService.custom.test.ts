import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';
import type { RoborockAuthenticateApi } from '../../../roborockCommunication/api/authClient.js';
import type { RoborockIoTApi } from '../../../roborockCommunication/api/iotClient.js';
import type { LocalStorage } from 'node-persist';
import type { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import type { AnsiLogger } from 'matterbridge/logger';
import type { ServiceContainer } from '../../../services/index.js';
import { asPartial } from '../../testUtils.js';

describe('RoborockService (unit)', () => {
  let logger: any;
  let container: any;
  let authService: any;

  beforeEach(() => {
    logger = { debug: vi.fn(), notice: vi.fn(), error: vi.fn() };

    authService = {
      authenticate: vi.fn(),
    };

    // Minimal container mock used by RoborockService when injected
    container = {
      getAuthenticationCoordinator: () => authService,
      getDeviceManagementService: () => ({}),
      getAreaManagementService: () => ({ getSelectedAreas: () => [], getSupportedAreas: () => [] }),
      getMessageRoutingService: () => ({}),
      getPollingService: () => ({ setDeviceNotify: vi.fn(), activateDeviceNotifyOverLocal: vi.fn(), activateDeviceNotifyOverMQTT: vi.fn(), stopPolling: vi.fn() }),
      getConnectionService: () => ({ initializeMessageClient: vi.fn(), initializeMessageClientForLocal: vi.fn().mockResolvedValue(false), setDeviceNotify: vi.fn() }),
      setUserData: vi.fn(),
      getIotApi: () => undefined,
    };
  });

  it('getCustomAPI throws when IoT API not initialized', async () => {
    const svc = new RoborockService(
      {
        authenticateApiFactory: () => asPartial<RoborockAuthenticateApi>({}),
        iotApiFactory: () => asPartial<RoborockIoTApi>({}),
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: asPartial<LocalStorage>({}),
        configManager: asPartial<PlatformConfigManager>({}),
        container: container as ServiceContainer,
        toastMessage: vi.fn(),
      },
      asPartial<AnsiLogger>(logger),
      asPartial<PlatformConfigManager>({}),
    );
    await expect(svc.getCustomAPI('/some')).rejects.toThrow(/IoT API not initialized/);
  });
});
