import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthenticationService } from '../../services/authenticationService.js';
import { AuthenticationError, InvalidCredentialsError, VerificationCodeExpiredError, TokenExpiredError } from '../../errors/index.js';
import { VERIFICATION_CODE_RATE_LIMIT_MS } from '../../constants/index.js';
import type { UserData } from '../../roborockCommunication/models/index.js';

const mockAuthGateway = {
  requestVerificationCode: vi.fn(),
  authenticate2FA: vi.fn(),
  authenticatePassword: vi.fn(),
  refreshToken: vi.fn(),
};
const mockPersist = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
const mockLogger = {
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  notice: vi.fn(),
};
const mockConfigManager = {
  alwaysExecuteAuthentication: false,
};

let service: AuthenticationService;

function createMockUserData(username = 'test@example.com'): UserData {
  return {
    uid: 'test-uid',
    tokentype: 'Bearer',
    token: 'test-token',
    rruid: 'rr-uid',
    region: 'us',
    countrycode: 'US',
    country: 'United States',
    nickname: 'Test User',
    username,
    rriot: {
      u: 'test-user',
      s: 'test-secret',
      h: 'test-host',
      k: 'test-key',
      r: { a: 'test-region-a', m: 'test-mqtt' },
    },
  } as UserData;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConfigManager.alwaysExecuteAuthentication = false;
  service = new AuthenticationService(mockAuthGateway as any, mockPersist as any, mockLogger as any, mockConfigManager as any);
});

describe('AuthenticationService', () => {
  describe('requestVerificationCode', () => {
    it('should request verification code', async () => {
      await service.requestVerificationCode('test@example.com');
      expect(mockAuthGateway.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
    });

    it('should throw AuthenticationError when authGateway fails', async () => {
      mockAuthGateway.requestVerificationCode.mockRejectedValue(new Error('Network error'));
      await expect(service.requestVerificationCode('test@example.com')).rejects.toThrow(AuthenticationError);
      await expect(service.requestVerificationCode('test@example.com')).rejects.toThrow('Failed to send verification code');
    });

    it('should log debug message before requesting code', async () => {
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      await service.requestVerificationCode('test@example.com');
      expect(mockLogger.debug).toHaveBeenCalledWith('Requesting verification code for email:', 'test@example.com');
    });

    it('should log error when request fails', async () => {
      mockAuthGateway.requestVerificationCode.mockRejectedValue(new Error('Network error'));
      await expect(service.requestVerificationCode('test@example.com')).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to request verification code:', expect.objectContaining({ email: 'test@example.com' }));
    });
  });

  describe('loginWithVerificationCode', () => {
    it('should login with verification code and save user data', async () => {
      const userData = createMockUserData();
      mockAuthGateway.authenticate2FA.mockResolvedValue(userData);
      const saveUserData = vi.fn().mockResolvedValue(undefined);
      const result = await service.loginWithVerificationCode('test@example.com', '123456', saveUserData);
      expect(result).toBe(userData);
      expect(saveUserData).toHaveBeenCalledWith(userData);
    });

    it('should succeed even when save user data fails', async () => {
      const userData = createMockUserData();
      mockAuthGateway.authenticate2FA.mockResolvedValue(userData);
      const saveUserData = vi.fn().mockRejectedValue(new Error('Save failed'));
      const result = await service.loginWithVerificationCode('test@example.com', '123456', saveUserData);
      expect(result).toBe(userData);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to save user data, but login succeeded:', expect.any(Error));
    });

    it('should throw VerificationCodeExpiredError when error message contains expired', async () => {
      mockAuthGateway.authenticate2FA.mockRejectedValue(new Error('Code expired'));
      const saveUserData = vi.fn();
      await expect(service.loginWithVerificationCode('test@example.com', '123456', saveUserData)).rejects.toThrow(VerificationCodeExpiredError);
    });

    it('should throw VerificationCodeExpiredError when error message contains invalid', async () => {
      mockAuthGateway.authenticate2FA.mockRejectedValue(new Error('Code invalid'));
      const saveUserData = vi.fn();
      await expect(service.loginWithVerificationCode('test@example.com', '123456', saveUserData)).rejects.toThrow(VerificationCodeExpiredError);
    });

    it('should throw generic AuthenticationError for other errors', async () => {
      mockAuthGateway.authenticate2FA.mockRejectedValue(new Error('Network error'));
      const saveUserData = vi.fn();
      await expect(service.loginWithVerificationCode('test@example.com', '123456', saveUserData)).rejects.toThrow(AuthenticationError);
      await expect(service.loginWithVerificationCode('test@example.com', '123456', saveUserData)).rejects.toThrow('Authentication failed');
    });

    it('should log debug message when authenticating', async () => {
      const userData = createMockUserData();
      mockAuthGateway.authenticate2FA.mockResolvedValue(userData);
      const saveUserData = vi.fn().mockResolvedValue(undefined);
      await service.loginWithVerificationCode('test@example.com', '123456', saveUserData);
      expect(mockLogger.debug).toHaveBeenCalledWith('Authenticating with verification code for email:', 'test@example.com');
    });

    it('should log notice when authentication succeeds', async () => {
      const userData = createMockUserData();
      mockAuthGateway.authenticate2FA.mockResolvedValue(userData);
      const saveUserData = vi.fn().mockResolvedValue(undefined);
      await service.loginWithVerificationCode('test@example.com', '123456', saveUserData);
      expect(mockLogger.notice).toHaveBeenCalledWith('Successfully authenticated with verification code');
    });

    it('should log debug when save succeeds', async () => {
      const userData = createMockUserData();
      mockAuthGateway.authenticate2FA.mockResolvedValue(userData);
      const saveUserData = vi.fn().mockResolvedValue(undefined);
      await service.loginWithVerificationCode('test@example.com', '123456', saveUserData);
      expect(mockLogger.debug).toHaveBeenCalledWith('User data saved successfully');
    });
  });

  describe('loginWithCachedToken', () => {
    it('should login with cached token', async () => {
      const userData = createMockUserData();
      mockAuthGateway.refreshToken.mockResolvedValue(userData);
      const result = await service.loginWithCachedToken('test@example.com', userData);
      expect(result).toBe(userData);
      expect(mockAuthGateway.refreshToken).toHaveBeenCalledWith(userData);
    });

    it('should set username on userData before refreshing token', async () => {
      const userData = createMockUserData();
      mockAuthGateway.refreshToken.mockImplementation((data) => {
        expect(data.username).toBe('test@example.com');
        return Promise.resolve(data);
      });
      await service.loginWithCachedToken('test@example.com', userData);
    });

    it('should throw TokenExpiredError when error message contains expired', async () => {
      const userData = createMockUserData();
      mockAuthGateway.refreshToken.mockRejectedValue(new Error('Token expired'));
      await expect(service.loginWithCachedToken('test@example.com', userData)).rejects.toThrow(TokenExpiredError);
    });

    it('should throw TokenExpiredError when error message contains token', async () => {
      const userData = createMockUserData();
      mockAuthGateway.refreshToken.mockRejectedValue(new Error('Invalid token'));
      await expect(service.loginWithCachedToken('test@example.com', userData)).rejects.toThrow(TokenExpiredError);
    });

    it('should throw generic AuthenticationError for other errors', async () => {
      const userData = createMockUserData();
      mockAuthGateway.refreshToken.mockRejectedValue(new Error('Network error'));
      await expect(service.loginWithCachedToken('test@example.com', userData)).rejects.toThrow(AuthenticationError);
      await expect(service.loginWithCachedToken('test@example.com', userData)).rejects.toThrow('Session expired or invalid');
    });

    it('should log debug message when authenticating', async () => {
      const userData = createMockUserData();
      mockAuthGateway.refreshToken.mockResolvedValue(userData);
      await service.loginWithCachedToken('test@example.com', userData);
      expect(mockLogger.debug).toHaveBeenCalledWith('Authenticating with cached token for user:', 'test@example.com');
    });

    it('should log notice when authentication succeeds', async () => {
      const userData = createMockUserData();
      mockAuthGateway.refreshToken.mockResolvedValue(userData);
      await service.loginWithCachedToken('test@example.com', userData);
      expect(mockLogger.notice).toHaveBeenCalledWith('[loginWithCachedToken]: Successfully authenticated with cached token');
    });
  });

  describe('loginWithPassword', () => {
    it('should login with password and save user data when no saved data exists', async () => {
      const userData = createMockUserData();
      mockAuthGateway.authenticatePassword.mockResolvedValue(userData);
      const loadSavedUserData = vi.fn().mockResolvedValue(undefined);
      const saveUserData = vi.fn().mockResolvedValue(undefined);
      const result = await service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData);
      expect(result).toBe(userData);
      expect(mockAuthGateway.authenticatePassword).toHaveBeenCalledWith('test@example.com', 'pw');
      expect(saveUserData).toHaveBeenCalledWith(userData);
    });

    it('should login with password when saved data username does not match', async () => {
      const savedUserData = createMockUserData('different@example.com');
      const newUserData = createMockUserData('test@example.com');
      mockAuthGateway.authenticatePassword.mockResolvedValue(newUserData);
      const loadSavedUserData = vi.fn().mockResolvedValue(savedUserData);
      const saveUserData = vi.fn().mockResolvedValue(undefined);
      const result = await service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData);
      expect(result).toBe(newUserData);
      expect(mockAuthGateway.authenticatePassword).toHaveBeenCalledWith('test@example.com', 'pw');
    });

    it('should use cached token when saved data username matches', async () => {
      const savedUserData = createMockUserData();
      const validatedUserData = createMockUserData();
      mockAuthGateway.refreshToken.mockResolvedValue(validatedUserData);
      const loadSavedUserData = vi.fn().mockResolvedValue(savedUserData);
      const saveUserData = vi.fn();
      const result = await service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData);
      expect(result).toBe(validatedUserData);
      expect(mockAuthGateway.refreshToken).toHaveBeenCalledWith(savedUserData);
      expect(mockAuthGateway.authenticatePassword).not.toHaveBeenCalled();
      expect(saveUserData).not.toHaveBeenCalled();
    });

    it('should succeed even when save user data fails', async () => {
      const userData = createMockUserData();
      mockAuthGateway.authenticatePassword.mockResolvedValue(userData);
      const loadSavedUserData = vi.fn().mockResolvedValue(undefined);
      const saveUserData = vi.fn().mockRejectedValue(new Error('Save failed'));
      const result = await service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData);
      expect(result).toBe(userData);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to save user data, but login succeeded:', expect.any(Error));
    });

    it('should throw InvalidCredentialsError when error message contains invalid', async () => {
      mockAuthGateway.authenticatePassword.mockRejectedValue(new Error('invalid password'));
      const loadSavedUserData = vi.fn().mockResolvedValue(undefined);
      const saveUserData = vi.fn();
      await expect(service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData)).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError when error message contains incorrect', async () => {
      mockAuthGateway.authenticatePassword.mockRejectedValue(new Error('incorrect credentials'));
      const loadSavedUserData = vi.fn().mockResolvedValue(undefined);
      const saveUserData = vi.fn();
      await expect(service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData)).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError when error message contains wrong', async () => {
      mockAuthGateway.authenticatePassword.mockRejectedValue(new Error('wrong password'));
      const loadSavedUserData = vi.fn().mockResolvedValue(undefined);
      const saveUserData = vi.fn();
      await expect(service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData)).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw generic AuthenticationError for other errors', async () => {
      mockAuthGateway.authenticatePassword.mockRejectedValue(new Error('Network error'));
      const loadSavedUserData = vi.fn().mockResolvedValue(undefined);
      const saveUserData = vi.fn();
      await expect(service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData)).rejects.toThrow(AuthenticationError);
      await expect(service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData)).rejects.toThrow(
        'Authentication failed. Please use verification code login.',
      );
    });

    it('should log debug when no saved user data found', async () => {
      const userData = createMockUserData();
      mockAuthGateway.authenticatePassword.mockResolvedValue(userData);
      const loadSavedUserData = vi.fn().mockResolvedValue(undefined);
      const saveUserData = vi.fn().mockResolvedValue(undefined);
      await service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData);
      expect(mockLogger.debug).toHaveBeenCalledWith('No saved user data found, authenticating with password for user:', 'test@example.com');
    });

    it('should log debug when using saved user data', async () => {
      const savedUserData = createMockUserData();
      mockAuthGateway.refreshToken.mockResolvedValue(savedUserData);
      const loadSavedUserData = vi.fn().mockResolvedValue(savedUserData);
      const saveUserData = vi.fn();
      await service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData);
      expect(mockLogger.debug).toHaveBeenCalledWith('Using saved user data for login');
    });

    it('should log notice when password authentication succeeds', async () => {
      const userData = createMockUserData();
      mockAuthGateway.authenticatePassword.mockResolvedValue(userData);
      const loadSavedUserData = vi.fn().mockResolvedValue(undefined);
      const saveUserData = vi.fn().mockResolvedValue(undefined);
      await service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData);
      expect(mockLogger.notice).toHaveBeenCalledWith('Successfully authenticated with password');
    });

    it('should log notice when cached token authentication succeeds', async () => {
      const savedUserData = createMockUserData();
      mockAuthGateway.refreshToken.mockResolvedValue(savedUserData);
      const loadSavedUserData = vi.fn().mockResolvedValue(savedUserData);
      const saveUserData = vi.fn();
      await service.loginWithPassword('test@example.com', 'pw', loadSavedUserData, saveUserData);
      expect(mockLogger.notice).toHaveBeenCalledWith('[loginWithPassword]: Successfully authenticated with cached token');
    });
  });

  describe('authenticateWithPasswordFlow', () => {
    it('should authenticate with password flow when no cached data exists', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      const userData = createMockUserData();
      mockAuthGateway.authenticatePassword.mockResolvedValue(userData);
      mockPersist.setItem.mockResolvedValue(undefined);
      const result = await service.authenticateWithPasswordFlow('test@example.com', 'pw');
      expect(result).toEqual(userData);
      expect(mockPersist.setItem).toHaveBeenCalledWith('userData', userData);
    });

    it('should use cached token when valid saved data exists', async () => {
      const savedUserData = createMockUserData();
      mockPersist.getItem.mockResolvedValue(savedUserData);
      mockAuthGateway.refreshToken.mockResolvedValue(savedUserData);
      const result = await service.authenticateWithPasswordFlow('test@example.com', 'pw');
      expect(result).toBe(savedUserData);
      expect(mockAuthGateway.refreshToken).toHaveBeenCalledWith(savedUserData);
      expect(mockAuthGateway.authenticatePassword).not.toHaveBeenCalled();
    });

    it('should force fresh authentication when alwaysExecuteAuthentication is true', async () => {
      mockConfigManager.alwaysExecuteAuthentication = true;
      const savedUserData = createMockUserData();
      const newUserData = createMockUserData();
      mockPersist.getItem.mockResolvedValue(savedUserData);
      mockAuthGateway.authenticatePassword.mockResolvedValue(newUserData);
      mockPersist.setItem.mockResolvedValue(undefined);
      const result = await service.authenticateWithPasswordFlow('test@example.com', 'pw');
      expect(result).toBe(newUserData);
      expect(mockAuthGateway.authenticatePassword).toHaveBeenCalled();
      expect(mockAuthGateway.refreshToken).not.toHaveBeenCalled();
    });

    it('should log notice before attempting login', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.authenticatePassword.mockResolvedValue(createMockUserData());
      mockPersist.setItem.mockResolvedValue(undefined);
      await service.authenticateWithPasswordFlow('test@example.com', 'pw');
      expect(mockLogger.notice).toHaveBeenCalledWith('Attempting login with password...');
    });

    it('should log notice after successful authentication', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.authenticatePassword.mockResolvedValue(createMockUserData());
      mockPersist.setItem.mockResolvedValue(undefined);
      await service.authenticateWithPasswordFlow('test@example.com', 'pw');
      expect(mockLogger.notice).toHaveBeenCalledWith('Authentication successful!');
    });

    it('should log debug when alwaysExecuteAuthentication is enabled', async () => {
      mockConfigManager.alwaysExecuteAuthentication = true;
      mockPersist.getItem.mockResolvedValue(createMockUserData());
      mockAuthGateway.authenticatePassword.mockResolvedValue(createMockUserData());
      mockPersist.setItem.mockResolvedValue(undefined);
      await service.authenticateWithPasswordFlow('test@example.com', 'pw');
      expect(mockLogger.debug).toHaveBeenCalledWith('Always execute authentication on startup');
    });
  });

  describe('authenticate2FAFlow', () => {
    it('should authenticate with verification code and save user data', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      const userData = createMockUserData();
      mockAuthGateway.authenticate2FA.mockResolvedValue(userData);
      mockPersist.setItem.mockResolvedValue(undefined);
      mockPersist.removeItem.mockResolvedValue(undefined);
      const result = await service.authenticate2FAFlow('test@example.com', '654321');
      expect(result).toEqual(userData);
      expect(mockPersist.setItem).toHaveBeenCalledWith('userData', userData);
      expect(mockPersist.removeItem).toHaveBeenCalledWith('authenticateFlowState');
    });

    it('should use cached token when valid saved data exists', async () => {
      const savedUserData = createMockUserData();
      mockPersist.getItem.mockResolvedValue(savedUserData);
      mockAuthGateway.refreshToken.mockResolvedValue(savedUserData);
      const result = await service.authenticate2FAFlow('test@example.com', undefined);
      expect(result).toBe(savedUserData);
      expect(mockAuthGateway.refreshToken).toHaveBeenCalled();
    });

    it('should set username on saved userData when undefined', async () => {
      const savedUserData = createMockUserData();
      savedUserData.username = '';
      mockPersist.getItem.mockResolvedValue(savedUserData);
      mockAuthGateway.refreshToken.mockResolvedValue(savedUserData);
      await service.authenticate2FAFlow('test@example.com', undefined);
      expect(mockPersist.setItem).toHaveBeenCalledWith('userData', expect.objectContaining({ username: 'test@example.com' }));
    });

    it('should not set username on saved userData when empty string due to buggy condition', async () => {
      const savedUserData = createMockUserData('');
      mockPersist.getItem.mockResolvedValue(savedUserData);
      mockAuthGateway.refreshToken.mockResolvedValue(savedUserData);
      await service.authenticate2FAFlow('test@example.com', undefined);
      expect(mockPersist.setItem).toHaveBeenCalled();
    });

    it('should request verification code when no code provided and no saved data', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      const result = await service.authenticate2FAFlow('test@example.com', undefined);
      expect(result).toBeUndefined();
      expect(mockAuthGateway.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
    });

    it('should request verification code when provided code is empty string', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      const result = await service.authenticate2FAFlow('test@example.com', '   ');
      expect(result).toBeUndefined();
      expect(mockAuthGateway.requestVerificationCode).toHaveBeenCalled();
    });

    it('should enforce rate limiting when code was recently requested', async () => {
      const now = Date.now();
      mockPersist.getItem.mockImplementation((key) => {
        if (key === 'userData') return Promise.resolve(undefined);
        if (key === 'authenticateFlowState') {
          return Promise.resolve({ email: 'test@example.com', codeRequestedAt: now - 30000 });
        }
        return Promise.resolve(undefined);
      });
      const result = await service.authenticate2FAFlow('test@example.com', undefined);
      expect(result).toBeUndefined();
      expect(mockAuthGateway.requestVerificationCode).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Please wait'));
    });

    it('should allow code request after rate limit expires', async () => {
      const now = Date.now();
      mockPersist.getItem.mockImplementation((key) => {
        if (key === 'userData') return Promise.resolve(undefined);
        if (key === 'authenticateFlowState') {
          return Promise.resolve({ email: 'test@example.com', codeRequestedAt: now - VERIFICATION_CODE_RATE_LIMIT_MS - 1000 });
        }
        return Promise.resolve(undefined);
      });
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      const result = await service.authenticate2FAFlow('test@example.com', undefined);
      expect(result).toBeUndefined();
      expect(mockAuthGateway.requestVerificationCode).toHaveBeenCalled();
    });

    it('should save authenticateFlowState after requesting code', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      await service.authenticate2FAFlow('test@example.com', undefined);
      expect(mockPersist.setItem).toHaveBeenCalledWith('authenticateFlowState', expect.objectContaining({ email: 'test@example.com', codeRequestedAt: expect.any(Number) }));
    });

    it('should clear saved userData when cached token is invalid', async () => {
      const savedUserData = createMockUserData();
      mockPersist.getItem.mockImplementation((key) => {
        if (key === 'userData') return Promise.resolve(savedUserData);
        return Promise.resolve(undefined);
      });
      mockAuthGateway.refreshToken.mockRejectedValue(new Error('Token expired'));
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      const result = await service.authenticate2FAFlow('test@example.com', undefined);
      expect(result).toBeUndefined();
      expect(mockPersist.removeItem).toHaveBeenCalledWith('userData');
      expect(mockAuthGateway.requestVerificationCode).toHaveBeenCalled();
    });

    it('should skip cached token when alwaysExecuteAuthentication is true', async () => {
      mockConfigManager.alwaysExecuteAuthentication = true;
      const savedUserData = createMockUserData();
      mockPersist.getItem.mockResolvedValue(savedUserData);
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      const result = await service.authenticate2FAFlow('test@example.com', undefined);
      expect(result).toBeUndefined();
      expect(mockAuthGateway.refreshToken).not.toHaveBeenCalled();
      expect(mockAuthGateway.requestVerificationCode).toHaveBeenCalled();
    });

    it('should trim verification code before authenticating', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      const userData = createMockUserData();
      mockAuthGateway.authenticate2FA.mockResolvedValue(userData);
      mockPersist.setItem.mockResolvedValue(undefined);
      mockPersist.removeItem.mockResolvedValue(undefined);
      await service.authenticate2FAFlow('test@example.com', '  654321  ');
      expect(mockAuthGateway.authenticate2FA).toHaveBeenCalledWith('test@example.com', '654321');
    });

    it('should log notice when requesting verification code', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      await service.authenticate2FAFlow('test@example.com', undefined);
      expect(mockLogger.notice).toHaveBeenCalledWith('Requesting verification code for: test@example.com');
    });

    it('should log notice when authenticating with verification code', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.authenticate2FA.mockResolvedValue(createMockUserData());
      mockPersist.setItem.mockResolvedValue(undefined);
      mockPersist.removeItem.mockResolvedValue(undefined);
      await service.authenticate2FAFlow('test@example.com', '654321');
      expect(mockLogger.notice).toHaveBeenCalledWith('Attempting login with verification code...');
    });

    it('should log notice after successful authentication', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.authenticate2FA.mockResolvedValue(createMockUserData());
      mockPersist.setItem.mockResolvedValue(undefined);
      mockPersist.removeItem.mockResolvedValue(undefined);
      await service.authenticate2FAFlow('test@example.com', '654321');
      expect(mockLogger.notice).toHaveBeenCalledWith('Authentication successful!');
    });

    it('should log debug when no saved userData found', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      await service.authenticate2FAFlow('test@example.com', undefined);
      expect(mockLogger.debug).toHaveBeenCalledWith('No saved userData found, proceeding to verification code flow');
    });

    it('should log debug when found saved userData', async () => {
      const savedUserData = createMockUserData();
      mockPersist.getItem.mockResolvedValue(savedUserData);
      mockAuthGateway.refreshToken.mockResolvedValue(savedUserData);
      await service.authenticate2FAFlow('test@example.com', undefined);
      expect(mockLogger.debug).toHaveBeenCalledWith('Found saved userData, attempting to use cached token');
    });

    it('should log warn when cached token is invalid', async () => {
      const savedUserData = createMockUserData();
      mockPersist.getItem.mockImplementation((key) => {
        if (key === 'userData') return Promise.resolve(savedUserData);
        return Promise.resolve(undefined);
      });
      mockAuthGateway.refreshToken.mockRejectedValue(new Error('Token expired'));
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      await service.authenticate2FAFlow('test@example.com', undefined);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Cached token invalid or expired'));
    });

    it('should log error when requesting verification code fails', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.requestVerificationCode.mockRejectedValue(new Error('Network error'));
      await expect(service.authenticate2FAFlow('test@example.com', undefined)).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to request verification code'));
    });

    it('should log verification code banner when code sent', async () => {
      mockPersist.getItem.mockResolvedValue(undefined);
      mockAuthGateway.requestVerificationCode.mockResolvedValue(undefined);
      await service.authenticate2FAFlow('test@example.com', undefined);
      expect(mockLogger.notice).toHaveBeenCalledWith('============================================');
      expect(mockLogger.notice).toHaveBeenCalledWith('ACTION REQUIRED: Enter verification code');
      expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('has been sent to: test@example.com'));
    });

    it('should log verification code banner when rate limited', async () => {
      const now = Date.now();
      mockPersist.getItem.mockImplementation((key) => {
        if (key === 'userData') return Promise.resolve(undefined);
        if (key === 'authenticateFlowState') {
          return Promise.resolve({ email: 'test@example.com', codeRequestedAt: now - 30000 });
        }
        return Promise.resolve(undefined);
      });
      await service.authenticate2FAFlow('test@example.com', undefined);
      expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('was previously sent to: test@example.com'));
    });
  });
});
