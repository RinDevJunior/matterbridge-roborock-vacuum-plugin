import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';

describe('RoborockService - Authentication', () => {
  let roborockService: RoborockService;
  let mockLogger: any;
  let mockContainer: any;
  let mockAuthService: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    mockAuthService = {
      authenticate2FAFlow: vi.fn(),
      authenticateWithPasswordFlow: vi.fn(),
    };

    mockContainer = {
      getAuthenticationService: vi.fn(() => mockAuthService),
      getDeviceManagementService: vi.fn(() => ({})),
      getAreaManagementService: vi.fn(() => ({})),
      getMessageRoutingService: vi.fn(() => ({})),
      getPollingService: vi.fn(() => ({})),
      getConnectionService: vi.fn(() => ({})),
      setUserData: vi.fn(),
    };

    const mockConfigManager = {
      username: 'test@example.com',
      password: 'password123',
      verificationCode: undefined,
      authenticationMethod: 'Password',
    } as any;

    roborockService = new RoborockService(
      {
        authenticateApiFactory: () => undefined as any,
        iotApiFactory: () => undefined as any,
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: {} as any,
        configManager: mockConfigManager,
        container: mockContainer,
      },
      mockLogger,
      mockConfigManager,
    );
  });

  it('should return success when authentication succeeds', async () => {
    const mockUserData = { username: 'test@example.com', nickname: 'Test' };
    mockAuthService.authenticateWithPasswordFlow.mockResolvedValue(mockUserData);

    const result = await roborockService.authenticate();

    expect(result.userData).toEqual(mockUserData);
    expect(result.shouldContinue).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Authentication successful'));
  });

  it('should call logger.error and return failure when authentication throws', async () => {
    mockAuthService.authenticateWithPasswordFlow.mockRejectedValue(new Error('auth failed'));

    const result = await roborockService.authenticate();

    expect(result.userData).toBeUndefined();
    expect(result.shouldContinue).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Authentication failed: auth failed'));
  });
});
