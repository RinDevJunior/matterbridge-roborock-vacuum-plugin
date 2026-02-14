import { AnsiLogger } from 'matterbridge/logger';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { PasswordAuthStrategy } from '../../../services/authentication/PasswordAuthStrategy.js';
import { AuthenticationService } from '../../../services/authenticationService.js';
import { UserDataRepository } from '../../../services/authentication/UserDataRepository.js';
import { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import { AuthContext } from '../../../services/authentication/AuthContext.js';
import { UserData } from '../../../roborockCommunication/models/index.js';
import { createMockLogger, asPartial, asType } from '../../testUtils.js';
import { AuthenticationConfiguration, RoborockPluginPlatformConfig } from '../../../model/RoborockPluginPlatformConfig.js';

describe('PasswordAuthStrategy', () => {
  let strategy: PasswordAuthStrategy;
  let mockAuthService: AuthenticationService;
  let mockUserDataRepository: UserDataRepository;
  let mockConfigManager: PlatformConfigManager;
  let mockLogger: AnsiLogger;

  const mockUserData = asPartial<UserData>({
    uid: 'user123',
    username: 'test@example.com',
    token: 'valid-token',
    tokentype: 'Bearer',
    region: 'us',
  });

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockAuthService = asPartial<AuthenticationService>({
      loginWithPassword: vi.fn(),
      loginWithCachedToken: vi.fn(),
      loginWithVerificationCode: vi.fn(),
    });

    mockUserDataRepository = asPartial<UserDataRepository>({
      loadUserData: vi.fn(),
      saveUserData: vi.fn(),
      clearUserData: vi.fn(),
    });

    const mockRawConfig = asPartial<RoborockPluginPlatformConfig>({
      authentication: asPartial<AuthenticationConfiguration>({
        forceAuthentication: false,
      }),
    });

    mockConfigManager = asPartial<PlatformConfigManager>({
      get rawConfig() {
        return mockRawConfig;
      },
      get alwaysExecuteAuthentication() {
        return mockRawConfig.authentication.forceAuthentication ?? false;
      },
    });

    strategy = new PasswordAuthStrategy(mockAuthService, mockUserDataRepository, mockConfigManager, mockLogger);

    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    const createContext = (username: string, password: string): AuthContext => ({
      username,
      password,
    });

    describe('cached token authentication', () => {
      it('should authenticate successfully with cached token', async () => {
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(mockUserData);
        vi.mocked(mockAuthService.loginWithCachedToken).mockResolvedValue(mockUserData);

        const result = await strategy.authenticate(context);

        expect(result).toEqual(mockUserData);
        expect(mockUserDataRepository.loadUserData).toHaveBeenCalledWith('test@example.com');
        expect(mockAuthService.loginWithCachedToken).toHaveBeenCalledWith('test@example.com', mockUserData);
        expect(mockAuthService.loginWithPassword).not.toHaveBeenCalled();
        expect(mockLogger.notice).toHaveBeenCalledWith('Successfully authenticated with cached token');
      });

      it('should skip cached token when alwaysExecuteAuthentication is true', async () => {
        asType<AuthenticationConfiguration>(mockConfigManager.rawConfig.authentication).forceAuthentication = true;
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();

        const result = await strategy.authenticate(context);

        expect(mockUserDataRepository.clearUserData).toHaveBeenCalled();
        expect(mockUserDataRepository.loadUserData).not.toHaveBeenCalled();
        expect(mockAuthService.loginWithCachedToken).not.toHaveBeenCalled();
        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(result).toEqual(mockUserData);
      });

      it('should fall back to password auth when no cached token exists', async () => {
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();

        const result = await strategy.authenticate(context);

        expect(mockUserDataRepository.loadUserData).toHaveBeenCalledWith('test@example.com');
        expect(mockAuthService.loginWithCachedToken).not.toHaveBeenCalled();
        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(result).toEqual(mockUserData);
      });

      it('should fall back to password auth when cached token is invalid', async () => {
        const context = createContext('test@example.com', 'password123');
        const tokenError = new Error('Token expired');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(mockUserData);
        vi.mocked(mockAuthService.loginWithCachedToken).mockRejectedValue(tokenError);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();
        vi.mocked(mockUserDataRepository.clearUserData).mockResolvedValue();

        const result = await strategy.authenticate(context);

        expect(mockAuthService.loginWithCachedToken).toHaveBeenCalledWith('test@example.com', mockUserData);
        expect(mockUserDataRepository.clearUserData).toHaveBeenCalled();
        expect(mockLogger.warn).toHaveBeenCalledWith('Cached token invalid or expired: Token expired');
        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(result).toEqual(mockUserData);
      });

      it('should handle non-Error objects when cached token fails', async () => {
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(mockUserData);
        vi.mocked(mockAuthService.loginWithCachedToken).mockRejectedValue('String error');
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();
        vi.mocked(mockUserDataRepository.clearUserData).mockResolvedValue();

        const result = await strategy.authenticate(context);

        expect(mockLogger.warn).toHaveBeenCalledWith('Cached token invalid or expired: String error');
        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(result).toEqual(mockUserData);
      });
    });

    describe('password authentication', () => {
      it('should authenticate successfully with password', async () => {
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();

        const result = await strategy.authenticate(context);

        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockUserDataRepository.saveUserData).toHaveBeenCalledWith(mockUserData);
        expect(mockLogger.notice).toHaveBeenCalledWith('Authentication successful!');
        expect(result).toEqual(mockUserData);
      });

      it('should log debug message when starting password authentication', async () => {
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();

        await strategy.authenticate(context);

        expect(mockLogger.debug).toHaveBeenCalledWith('Authenticating with password for user:', 'test@example.com');
      });

      it('should return undefined when password authentication fails', async () => {
        const context = createContext('test@example.com', 'wrong-password');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(undefined as unknown as UserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();

        const result = await strategy.authenticate(context);

        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('test@example.com', 'wrong-password');
        expect(mockUserDataRepository.saveUserData).toHaveBeenCalledWith(undefined);
        expect(mockLogger.notice).toHaveBeenCalledWith('Authentication failed!');
        expect(result).toBeUndefined();
      });

      it('should save new user data after successful authentication', async () => {
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();

        await strategy.authenticate(context);

        expect(mockUserDataRepository.saveUserData).toHaveBeenCalledWith(mockUserData);
      });

      it('should continue when save fails but log warning', async () => {
        const context = createContext('test@example.com', 'password123');
        const saveError = new Error('Save failed');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockRejectedValue(saveError);

        const result = await strategy.authenticate(context);

        expect(mockLogger.warn).toHaveBeenCalledWith('Failed to save user data, but login succeeded:', saveError);
        expect(mockLogger.notice).toHaveBeenCalledWith('Authentication successful!');
        expect(result).toEqual(mockUserData);
      });

      it('should handle non-Error objects in save failures', async () => {
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockRejectedValue('String save error');

        const result = await strategy.authenticate(context);

        expect(mockLogger.warn).toHaveBeenCalledWith('Failed to save user data, but login succeeded:', 'String save error');
        expect(result).toEqual(mockUserData);
      });

      it('should use password from context', async () => {
        const context = createContext('user@test.com', 'my-secret-password');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();

        await strategy.authenticate(context);

        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('user@test.com', 'my-secret-password');
      });
    });

    describe('integration scenarios', () => {
      it('should handle complete flow from cached token failure to successful password auth', async () => {
        const context = createContext('test@example.com', 'password123');
        const oldUserData: UserData = { ...mockUserData, token: 'old-token' };
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(oldUserData);
        vi.mocked(mockAuthService.loginWithCachedToken).mockRejectedValue(new Error('Token expired'));
        vi.mocked(mockUserDataRepository.clearUserData).mockResolvedValue();
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();

        const result = await strategy.authenticate(context);

        expect(mockUserDataRepository.loadUserData).toHaveBeenCalledWith('test@example.com');
        expect(mockAuthService.loginWithCachedToken).toHaveBeenCalledWith('test@example.com', oldUserData);
        expect(mockUserDataRepository.clearUserData).toHaveBeenCalled();
        expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockUserDataRepository.saveUserData).toHaveBeenCalledWith(mockUserData);
        expect(result).toEqual(mockUserData);
      });

      it('should attempt to save even when password authentication returns undefined', async () => {
        const context = createContext('test@example.com', 'wrong-password');
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockAuthService.loginWithPassword).mockResolvedValue(undefined as unknown as UserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();

        await strategy.authenticate(context);

        expect(mockUserDataRepository.saveUserData).toHaveBeenCalledWith(undefined);
      });
    });
  });
});
