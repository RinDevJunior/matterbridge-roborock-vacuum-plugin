import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthenticationService } from '../../services/authenticationService.js';
import { AuthenticationError, InvalidCredentialsError, VerificationCodeExpiredError, TokenExpiredError } from '../../errors/index.js';
import type { UserData } from '../../roborockCommunication/models/index.js';
import { asPartial, makeLogger } from '../testUtils.js';
import { RoborockAuthGateway } from '../../roborockCommunication/adapters/RoborockAuthGateway.js';

const mockAuthGateway = asPartial<RoborockAuthGateway>({
  requestVerificationCode: vi.fn(),
  authenticate2FA: vi.fn(),
  authenticatePassword: vi.fn(),
  refreshToken: vi.fn(),
});
const mockLogger = makeLogger();

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
  service = new AuthenticationService(mockAuthGateway, mockLogger);
});

describe('AuthenticationService', () => {
  describe('loginWithVerificationCode', () => {
    it('should login with verification code', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.authenticate2FA).mockResolvedValue(userData);
      const result = await service.loginWithVerificationCode('test@example.com', '123456');
      expect(result).toBe(userData);
      expect(mockAuthGateway.authenticate2FA).toHaveBeenCalledWith('test@example.com', '123456');
    });

    it('should throw VerificationCodeExpiredError when error message contains expired', async () => {
      vi.mocked(mockAuthGateway.authenticate2FA).mockRejectedValue(new Error('Code expired'));
      await expect(service.loginWithVerificationCode('test@example.com', '123456')).rejects.toThrow(VerificationCodeExpiredError);
    });

    it('should throw VerificationCodeExpiredError when error message contains invalid', async () => {
      vi.mocked(mockAuthGateway.authenticate2FA).mockRejectedValue(new Error('Code invalid'));
      await expect(service.loginWithVerificationCode('test@example.com', '123456')).rejects.toThrow(VerificationCodeExpiredError);
    });

    it('should throw generic AuthenticationError for other errors', async () => {
      vi.mocked(mockAuthGateway.authenticate2FA).mockRejectedValue(new Error('Network error'));
      await expect(service.loginWithVerificationCode('test@example.com', '123456')).rejects.toThrow(AuthenticationError);
      await expect(service.loginWithVerificationCode('test@example.com', '123456')).rejects.toThrow('Authentication failed');
    });

    it('should log debug message when authenticating', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.authenticate2FA).mockResolvedValue(userData);
      await service.loginWithVerificationCode('test@example.com', '123456');
      expect(mockLogger.debug).toHaveBeenCalledWith('Authenticating with verification code for email:', 'test@example.com');
    });

    it('should log notice when authentication succeeds', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.authenticate2FA).mockResolvedValue(userData);
      await service.loginWithVerificationCode('test@example.com', '123456');
      expect(mockLogger.notice).toHaveBeenCalledWith('Successfully authenticated with verification code');
    });
  });

  describe('loginWithCachedToken', () => {
    it('should login with cached token', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.refreshToken).mockResolvedValue(userData);
      const result = await service.loginWithCachedToken('test@example.com', userData);
      expect(result).toBe(userData);
      expect(mockAuthGateway.refreshToken).toHaveBeenCalledWith(userData);
    });

    it('should set username on userData before refreshing token', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.refreshToken).mockImplementation((data) => {
        expect(data.username).toBe('test@example.com');
        return Promise.resolve(data);
      });
      await service.loginWithCachedToken('test@example.com', userData);
    });

    it('should throw TokenExpiredError when error message contains expired', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.refreshToken).mockRejectedValue(new Error('Token expired'));
      await expect(service.loginWithCachedToken('test@example.com', userData)).rejects.toThrow(TokenExpiredError);
    });

    it('should throw TokenExpiredError when error message contains token', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.refreshToken).mockRejectedValue(new Error('Invalid token'));
      await expect(service.loginWithCachedToken('test@example.com', userData)).rejects.toThrow(TokenExpiredError);
    });

    it('should throw generic AuthenticationError for other errors', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.refreshToken).mockRejectedValue(new Error('Network error'));
      await expect(service.loginWithCachedToken('test@example.com', userData)).rejects.toThrow(AuthenticationError);
      await expect(service.loginWithCachedToken('test@example.com', userData)).rejects.toThrow('Session expired or invalid');
    });

    it('should log debug message when authenticating', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.refreshToken).mockResolvedValue(userData);
      await service.loginWithCachedToken('test@example.com', userData);
      expect(mockLogger.debug).toHaveBeenCalledWith('Authenticating with cached token for user:', 'test@example.com');
    });

    it('should log notice when authentication succeeds', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.refreshToken).mockResolvedValue(userData);
      await service.loginWithCachedToken('test@example.com', userData);
      expect(mockLogger.notice).toHaveBeenCalledWith('[loginWithCachedToken]: Successfully authenticated with cached token');
    });
  });

  describe('loginWithPassword', () => {
    it('should login with password', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.authenticatePassword).mockResolvedValue(userData);
      const result = await service.loginWithPassword('test@example.com', 'pw');
      expect(result).toBe(userData);
      expect(mockAuthGateway.authenticatePassword).toHaveBeenCalledWith('test@example.com', 'pw');
    });

    it('should throw InvalidCredentialsError when error message contains invalid', async () => {
      vi.mocked(mockAuthGateway.authenticatePassword).mockRejectedValue(new Error('invalid password'));
      await expect(service.loginWithPassword('test@example.com', 'pw')).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError when error message contains incorrect', async () => {
      vi.mocked(mockAuthGateway.authenticatePassword).mockRejectedValue(new Error('incorrect credentials'));
      await expect(service.loginWithPassword('test@example.com', 'pw')).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError when error message contains wrong', async () => {
      vi.mocked(mockAuthGateway.authenticatePassword).mockRejectedValue(new Error('wrong password'));
      await expect(service.loginWithPassword('test@example.com', 'pw')).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw generic AuthenticationError for other errors', async () => {
      vi.mocked(mockAuthGateway.authenticatePassword).mockRejectedValue(new Error('Network error'));
      await expect(service.loginWithPassword('test@example.com', 'pw')).rejects.toThrow(AuthenticationError);
      await expect(service.loginWithPassword('test@example.com', 'pw')).rejects.toThrow('Authentication failed. Please use verification code login.');
    });

    it('should log debug when authenticating with password', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.authenticatePassword).mockResolvedValue(userData);
      await service.loginWithPassword('test@example.com', 'pw');
      expect(mockLogger.debug).toHaveBeenCalledWith('Authenticating with password for user:', 'test@example.com');
    });

    it('should log notice when password authentication succeeds', async () => {
      const userData = createMockUserData();
      vi.mocked(mockAuthGateway.authenticatePassword).mockResolvedValue(userData);
      await service.loginWithPassword('test@example.com', 'pw');
      expect(mockLogger.notice).toHaveBeenCalledWith('Successfully authenticated with password');
    });
  });
});
