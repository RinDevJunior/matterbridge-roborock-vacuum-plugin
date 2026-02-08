import { AnsiLogger } from 'matterbridge/logger';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { TwoFactorAuthStrategy } from '../../../services/authentication/TwoFactorAuthStrategy.js';
import { AuthenticationService } from '../../../services/authenticationService.js';
import { UserDataRepository } from '../../../services/authentication/UserDataRepository.js';
import { VerificationCodeService } from '../../../services/authentication/VerificationCodeService.js';
import { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import { UserData } from '../../../roborockCommunication/models/index.js';
import { AuthContext } from '../../../services/authentication/AuthContext.js';
import { createMockLogger, asType, asPartial } from '../../testUtils.js';
import { AuthenticationConfiguration, RoborockPluginPlatformConfig } from '../../../model/RoborockPluginPlatformConfig.js';

describe('TwoFactorAuthStrategy', () => {
  let strategy: TwoFactorAuthStrategy;
  let mockAuthService: AuthenticationService;
  let mockUserDataRepository: UserDataRepository;
  let mockVerificationCodeService: VerificationCodeService;
  let mockConfigManager: PlatformConfigManager;
  let mockLogger: AnsiLogger;

  const mockUserData: UserData = {
    username: 'test@example.com',
    uid: 'test-uid',
    token: 'test-token',
    rruid: 'test-rruid',
    region: 'us',
    countrycode: 'US',
  } satisfies Partial<UserData> as UserData;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockAuthService = asPartial<AuthenticationService>({
      loginWithVerificationCode: vi.fn(),
      loginWithCachedToken: vi.fn(),
    });

    mockUserDataRepository = asPartial<UserDataRepository>({
      loadUserData: vi.fn(),
      saveUserData: vi.fn(),
      clearUserData: vi.fn(),
    });

    mockVerificationCodeService = asPartial<VerificationCodeService>({
      isRateLimited: vi.fn(),
      getRemainingWaitTime: vi.fn(),
      requestVerificationCode: vi.fn(),
      recordCodeRequest: vi.fn(),
      clearCodeRequestState: vi.fn(),
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

    strategy = new TwoFactorAuthStrategy(mockAuthService, mockUserDataRepository, mockVerificationCodeService, mockConfigManager, mockLogger);

    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    const createContext = (username: string, verificationCode?: string): AuthContext => ({
      username,
      password: '',
      verificationCode,
    });

    describe('cached token authentication', () => {
      it('should return cached user data when token is valid', async () => {
        const savedUserData = { ...mockUserData };
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(savedUserData);
        vi.mocked(mockAuthService.loginWithCachedToken).mockResolvedValue(mockUserData);

        const context = createContext('test@example.com');
        const result = await strategy.authenticate(context);

        expect(result).toBe(mockUserData);
        expect(mockUserDataRepository.loadUserData).toHaveBeenCalledWith('test@example.com');
        expect(mockAuthService.loginWithCachedToken).toHaveBeenCalledWith('test@example.com', savedUserData);
        expect(mockVerificationCodeService.requestVerificationCode).not.toHaveBeenCalled();
      });

      it('should proceed with verification code flow when cached token is invalid', async () => {
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(mockUserData);
        vi.mocked(mockAuthService.loginWithCachedToken).mockRejectedValue(new Error('Token expired'));
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(false);
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.recordCodeRequest).mockResolvedValue();

        const context = createContext('test@example.com');
        const result = await strategy.authenticate(context);

        expect(result).toBeUndefined();
        expect(mockUserDataRepository.clearUserData).toHaveBeenCalled();
        expect(mockVerificationCodeService.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
      });

      it('should skip cached token when alwaysExecuteAuthentication is true', async () => {
        mockConfigManager.rawConfig.authentication.forceAuthentication = true;
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(false);
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.recordCodeRequest).mockResolvedValue();

        const context = createContext('test@example.com');
        const result = await strategy.authenticate(context);

        expect(result).toBeUndefined();
        expect(mockUserDataRepository.clearUserData).toHaveBeenCalled();
        expect(mockUserDataRepository.loadUserData).not.toHaveBeenCalled();
        expect(mockVerificationCodeService.requestVerificationCode).toHaveBeenCalled();
      });

      it('should proceed with verification code flow when no cached data exists', async () => {
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(false);
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.recordCodeRequest).mockResolvedValue();

        const context = createContext('test@example.com');
        const result = await strategy.authenticate(context);

        expect(result).toBeUndefined();
        expect(mockVerificationCodeService.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
      });
    });

    describe('verification code validation', () => {
      beforeEach(() => {
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
      });

      it('should return undefined when verification code is missing', async () => {
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(false);
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.recordCodeRequest).mockResolvedValue();

        const context = createContext('test@example.com', undefined);
        const result = await strategy.authenticate(context);

        expect(result).toBeUndefined();
        expect(mockVerificationCodeService.requestVerificationCode).toHaveBeenCalled();
      });

      it('should return undefined when verification code is empty string', async () => {
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(false);
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.recordCodeRequest).mockResolvedValue();

        const context = createContext('test@example.com', '');
        const result = await strategy.authenticate(context);

        expect(result).toBeUndefined();
        expect(mockVerificationCodeService.requestVerificationCode).toHaveBeenCalled();
      });

      it('should return undefined when verification code is only whitespace', async () => {
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(false);
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.recordCodeRequest).mockResolvedValue();

        const context = createContext('test@example.com', '   ');
        const result = await strategy.authenticate(context);

        expect(result).toBeUndefined();
        expect(mockVerificationCodeService.requestVerificationCode).toHaveBeenCalled();
      });

      it('should authenticate with valid verification code', async () => {
        vi.mocked(mockAuthService.loginWithVerificationCode).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.clearCodeRequestState).mockResolvedValue();

        const context = createContext('test@example.com', '123456');
        const result = await strategy.authenticate(context);

        expect(result).toBe(mockUserData);
        expect(mockAuthService.loginWithVerificationCode).toHaveBeenCalledWith('test@example.com', '123456');
      });

      it('should trim verification code before authentication', async () => {
        vi.mocked(mockAuthService.loginWithVerificationCode).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.clearCodeRequestState).mockResolvedValue();

        const context = createContext('test@example.com', '  123456  ');
        const result = await strategy.authenticate(context);

        expect(result).toBe(mockUserData);
        expect(mockAuthService.loginWithVerificationCode).toHaveBeenCalledWith('test@example.com', '123456');
      });
    });

    describe('rate limiting', () => {
      beforeEach(() => {
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
      });

      it('should return undefined when rate limited', async () => {
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(true);
        vi.mocked(mockVerificationCodeService.getRemainingWaitTime).mockResolvedValue(45);

        const context = createContext('test@example.com');
        const result = await strategy.authenticate(context);

        expect(result).toBeUndefined();
        expect(mockLogger.warn).toHaveBeenCalledWith('Please wait 45 seconds before requesting another code.');
        expect(mockVerificationCodeService.requestVerificationCode).not.toHaveBeenCalled();
      });

      it('should log verification code banner when rate limited', async () => {
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(true);
        vi.mocked(mockVerificationCodeService.getRemainingWaitTime).mockResolvedValue(30);

        const context = createContext('test@example.com');
        await strategy.authenticate(context);

        expect(mockLogger.notice).toHaveBeenCalledWith('============================================');
        expect(mockLogger.notice).toHaveBeenCalledWith('ACTION REQUIRED: Enter verification code');
        expect(mockLogger.notice).toHaveBeenCalledWith('A verification code was previously sent to: test@example.com');
      });

      it('should proceed with code request when not rate limited', async () => {
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(false);
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.recordCodeRequest).mockResolvedValue();

        const context = createContext('test@example.com');
        const result = await strategy.authenticate(context);

        expect(result).toBeUndefined();
        expect(mockVerificationCodeService.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
        expect(mockVerificationCodeService.recordCodeRequest).toHaveBeenCalledWith('test@example.com');
      });
    });

    describe('verification code request', () => {
      beforeEach(() => {
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(false);
      });

      it('should successfully request verification code', async () => {
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.recordCodeRequest).mockResolvedValue();

        const context = createContext('test@example.com');
        const result = await strategy.authenticate(context);

        expect(result).toBeUndefined();
        expect(mockLogger.notice).toHaveBeenCalledWith('Requesting verification code for: test@example.com');
        expect(mockVerificationCodeService.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
        expect(mockVerificationCodeService.recordCodeRequest).toHaveBeenCalledWith('test@example.com');
      });

      it('should log verification code banner after requesting code', async () => {
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.recordCodeRequest).mockResolvedValue();

        const context = createContext('test@example.com');
        await strategy.authenticate(context);

        expect(mockLogger.notice).toHaveBeenCalledWith('A verification code has been sent to: test@example.com');
        expect(mockLogger.notice).toHaveBeenCalledWith('Enter the 6-digit code in the plugin configuration');
        expect(mockLogger.notice).toHaveBeenCalledWith('under the "verificationCode" field, then restart the plugin.');
      });

      it('should throw error when code request fails', async () => {
        const error = new Error('Network error');
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockRejectedValue(error);

        const context = createContext('test@example.com');

        await expect(strategy.authenticate(context)).rejects.toThrow('Network error');
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to request verification code: Network error');
      });

      it('should handle non-Error objects in request failures', async () => {
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockRejectedValue('String error');

        const context = createContext('test@example.com');

        await expect(strategy.authenticate(context)).rejects.toBe('String error');
        expect(mockLogger.error).toHaveBeenCalledWith('Failed to request verification code: String error');
      });
    });

    describe('authentication with code', () => {
      beforeEach(() => {
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
      });

      it('should successfully authenticate with verification code', async () => {
        vi.mocked(mockAuthService.loginWithVerificationCode).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.clearCodeRequestState).mockResolvedValue();

        const context = createContext('test@example.com', '123456');
        const result = await strategy.authenticate(context);

        expect(result).toEqual({ ...mockUserData, username: 'test@example.com' });
        expect(mockLogger.notice).toHaveBeenCalledWith('Attempting login with verification code...');
        expect(mockLogger.notice).toHaveBeenCalledWith('Authentication successful!');
      });

      it('should set username on userData after authentication', async () => {
        const userDataWithoutUsername = asPartial<UserData>({ ...mockUserData, username: undefined });
        vi.mocked(mockAuthService.loginWithVerificationCode).mockResolvedValue(userDataWithoutUsername);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.clearCodeRequestState).mockResolvedValue();

        const context = createContext('test@example.com', '123456');
        const result = await strategy.authenticate(context);

        expect(result?.username).toBe('test@example.com');
        expect(mockUserDataRepository.saveUserData).toHaveBeenCalledWith(expect.objectContaining({ username: 'test@example.com' }));
      });

      it('should save user data after successful authentication', async () => {
        vi.mocked(mockAuthService.loginWithVerificationCode).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.clearCodeRequestState).mockResolvedValue();

        const context = createContext('test@example.com', '123456');
        await strategy.authenticate(context);

        expect(mockUserDataRepository.saveUserData).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'test@example.com',
            token: 'test-token',
          }),
        );
      });

      it('should clear code request state after successful authentication', async () => {
        vi.mocked(mockAuthService.loginWithVerificationCode).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.clearCodeRequestState).mockResolvedValue();

        const context = createContext('test@example.com', '123456');
        await strategy.authenticate(context);

        expect(mockVerificationCodeService.clearCodeRequestState).toHaveBeenCalled();
      });

      it('should continue authentication when save user data fails', async () => {
        vi.mocked(mockAuthService.loginWithVerificationCode).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockRejectedValue(new Error('Save failed'));
        vi.mocked(mockVerificationCodeService.clearCodeRequestState).mockResolvedValue();

        const context = createContext('test@example.com', '123456');
        const result = await strategy.authenticate(context);

        expect(result).toBe(mockUserData);
        expect(mockLogger.warn).toHaveBeenCalledWith('Failed to save user data, but login succeeded:', expect.any(Error));
        expect(mockLogger.notice).toHaveBeenCalledWith('Authentication successful!');
      });

      it('should continue authentication when clear state fails', async () => {
        vi.mocked(mockAuthService.loginWithVerificationCode).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockResolvedValue();
        vi.mocked(mockVerificationCodeService.clearCodeRequestState).mockRejectedValue(new Error('Clear failed'));

        const context = createContext('test@example.com', '123456');
        const result = await strategy.authenticate(context);

        expect(result).toBe(mockUserData);
        expect(mockLogger.warn).toHaveBeenCalledWith('Failed to clear auth state, but login succeeded:', expect.any(Error));
        expect(mockLogger.notice).toHaveBeenCalledWith('Authentication successful!');
      });

      it('should handle both save and clear failures gracefully', async () => {
        vi.mocked(mockAuthService.loginWithVerificationCode).mockResolvedValue(mockUserData);
        vi.mocked(mockUserDataRepository.saveUserData).mockRejectedValue(new Error('Save failed'));
        vi.mocked(mockVerificationCodeService.clearCodeRequestState).mockRejectedValue(new Error('Clear failed'));

        const context = createContext('test@example.com', '123456');
        const result = await strategy.authenticate(context);

        expect(result).toBe(mockUserData);
        expect(mockLogger.warn).toHaveBeenCalledTimes(2);
        expect(mockLogger.notice).toHaveBeenCalledWith('Authentication successful!');
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        vi.mocked(mockUserDataRepository.loadUserData).mockResolvedValue(undefined);
      });

      it('should propagate authentication errors', async () => {
        vi.mocked(mockAuthService.loginWithVerificationCode).mockRejectedValue(new Error('Invalid code'));

        const context = createContext('test@example.com', '123456');

        await expect(strategy.authenticate(context)).rejects.toThrow('Invalid code');
      });

      it('should propagate code request errors', async () => {
        vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(false);
        vi.mocked(mockVerificationCodeService.requestVerificationCode).mockRejectedValue(new Error('API error'));

        const context = createContext('test@example.com');

        await expect(strategy.authenticate(context)).rejects.toThrow('API error');
      });
    });
  });
});
