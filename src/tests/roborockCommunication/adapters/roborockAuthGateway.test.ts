import { AnsiLogger } from 'matterbridge/logger';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { RoborockAuthGateway } from '../../../roborockCommunication/adapters/RoborockAuthGateway.js';
import { AuthenticationError } from '../../../errors/index.js';
import { UserData } from '../../../roborockCommunication/models/index.js';
import { asType, createMockLogger } from '../../testUtils.js';

// Mock the authenticate API
const mockAuthApi = {
  requestCodeV4: vi.fn(),
  loginWithCodeV4: vi.fn(),
  loginWithPassword: vi.fn(),
  loginWithUserData: vi.fn(),
  getHomeDetails: vi.fn(),
};

describe('RoborockAuthGateway', () => {
  let authGateway: RoborockAuthGateway;
  let mockLogger: AnsiLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();

    authGateway = new RoborockAuthGateway(asType(mockAuthApi), mockLogger);

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('requestVerificationCode', () => {
    it('should successfully request verification code', async () => {
      mockAuthApi.requestCodeV4.mockResolvedValue(undefined);

      await authGateway.requestVerificationCode('test@example.com');

      expect(mockAuthApi.requestCodeV4).toHaveBeenCalledWith('test@example.com');
      expect(mockLogger.info).toHaveBeenCalledWith('Requesting verification code for test@example.com');
    });

    it('should handle API errors gracefully', async () => {
      const apiError = new Error('Network timeout');
      mockAuthApi.requestCodeV4.mockRejectedValue(apiError);

      await expect(authGateway.requestVerificationCode('test@example.com')).rejects.toThrow(Error);
    });
  });

  describe('loginWithVerificationCode', () => {
    const mockUserData: UserData = {
      username: 'test@example.com',
      uid: 'test-uid',
      token: 'test-token',
      rruid: 'test-rruid',
      region: 'us',
      countrycode: 'US',
    } as UserData;

    it('should login successfully with verification code', async () => {
      mockAuthApi.loginWithCodeV4.mockResolvedValue(mockUserData);
      const result = await authGateway.authenticate2FA('test@example.com', '123456');

      expect(mockAuthApi.loginWithCodeV4).toHaveBeenCalledWith('test@example.com', '123456');
      expect(result).toBe(mockUserData);
      expect(mockLogger.info).toHaveBeenCalledWith('2FA Authentication successful');
    });

    it('should handle network errors during code login', async () => {
      mockAuthApi.loginWithCodeV4.mockRejectedValue(new Error('Connection failed'));
      await expect(authGateway.authenticate2FA('test@example.com', '123456')).rejects.toThrow(Error);
    });
  });

  describe('loginWithPassword', () => {
    const mockUserData: UserData = {
      username: 'test@example.com',
      uid: 'test-uid',
      token: 'test-token',
      rruid: 'test-rruid',
      region: 'us',
      countrycode: 'US',
    } as UserData;

    it('should use cached user data when available', async () => {
      mockAuthApi.loginWithPassword.mockResolvedValue(mockUserData);

      const result = await authGateway.authenticatePassword('test@example.com', 'password123');

      expect(mockAuthApi.loginWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(result).toBe(mockUserData);
      expect(mockLogger.info).toHaveBeenCalledWith('Password authentication successful');
    });
  });

  describe('refreshToken', () => {
    const mockCachedData: UserData = {
      username: 'test@example.com',
      uid: 'cached-uid',
      token: 'cached-token',
      rruid: 'cached-rruid',
      region: 'eu',
      countrycode: 'DE',
    } as UserData;

    it('should validate and refresh cached token', async () => {
      const refreshedData = { ...mockCachedData, token: 'refreshed-token' } as UserData;
      mockAuthApi.loginWithUserData.mockResolvedValue(refreshedData);

      const result = await authGateway.refreshToken(mockCachedData);

      expect(mockAuthApi.loginWithUserData).toHaveBeenCalledWith('test@example.com', mockCachedData);
      expect(result).toEqual(refreshedData);
      expect(mockLogger.info).toHaveBeenCalledWith('Token refreshed successfully');
    });

    it('should handle expired cached tokens', async () => {
      mockAuthApi.loginWithUserData.mockRejectedValue(new Error('Token expired'));
      await expect(authGateway.refreshToken(mockCachedData)).rejects.toThrow(Error);
    });

    it('should validate cached data structure', async () => {
      const invalidData = { uid: 'test' } as UserData;
      mockAuthApi.loginWithUserData.mockRejectedValue(new Error('Invalid user data'));
      await expect(authGateway.refreshToken(invalidData)).rejects.toThrow(Error);
    });

    it('should handle network errors during token validation', async () => {
      mockAuthApi.loginWithUserData.mockRejectedValue(new Error('Network unreachable'));

      await expect(authGateway.refreshToken(mockCachedData)).rejects.toThrow(Error);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle API rate limiting', async () => {
      mockAuthApi.requestCodeV4.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(authGateway.requestVerificationCode('test@example.com')).rejects.toThrow(Error);
    });

    it('should handle malformed API responses', async () => {
      mockAuthApi.loginWithPassword.mockResolvedValue(null);

      const result = await authGateway.authenticatePassword('test@example.com', 'password123');
      expect(result).toBeNull();
    });

    it('should preserve original error context', async () => {
      const originalError = new Error('Specific API error');
      originalError.stack = 'Original stack trace';
      mockAuthApi.loginWithPassword.mockRejectedValue(originalError);

      let caughtError;
      try {
        await authGateway.authenticatePassword('test@example.com', 'password123');
      } catch (error) {
        caughtError = error;
      }
      expect(caughtError).toBeInstanceOf(Error);
      expect((caughtError as Error).message).toBe('Specific API error');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete authentication workflow', async () => {
      const userData: UserData = {
        uid: 'workflow-uid',
        token: 'workflow-token',
        rruid: 'workflow-rruid',
        region: 'us',
        countrycode: 'US',
      } as UserData;

      // Step 1: Request verification code
      mockAuthApi.requestCodeV4.mockResolvedValue(undefined);
      await authGateway.requestVerificationCode('test@example.com');

      // Step 2: Login with verification code
      mockAuthApi.loginWithCodeV4.mockResolvedValue(userData);
      const result = await authGateway.authenticate2FA('test@example.com', '123456');

      expect(result).toBe(userData);
    });

    it('should handle authentication retry scenarios', async () => {
      const userData: UserData = { uid: 'retry-uid', token: 'retry-token' } as UserData;

      // First attempt fails
      mockAuthApi.loginWithPassword.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce(userData);

      // Should throw on first attempt
      await expect(authGateway.authenticatePassword('test@example.com', 'password123')).rejects.toThrow(Error);

      // Second attempt should succeed
      const result = await authGateway.authenticatePassword('test@example.com', 'password123');

      expect(result).toBe(userData);
    });
  });
});
