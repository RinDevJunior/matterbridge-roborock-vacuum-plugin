import { AnsiLogger } from 'matterbridge/logger';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';
import { VerificationCodeService } from '../../../services/authentication/VerificationCodeService.js';
import { AuthenticationStateRepository } from '../../../services/authentication/AuthenticationStateRepository.js';
import { IAuthGateway } from '../../../core/ports/IAuthGateway.js';
import { AuthenticationError } from '../../../errors/index.js';
import { AuthenticateFlowState } from '../../../roborockCommunication/models/index.js';
import { createMockLogger, asType, asPartial } from '../../testUtils.js';
import { VERIFICATION_CODE_RATE_LIMIT_MS } from '../../../constants/index.js';

describe('VerificationCodeService', () => {
  let service: VerificationCodeService;
  let mockAuthGateway: IAuthGateway;
  let mockStateRepository: AuthenticationStateRepository;
  let mockLogger: AnsiLogger;
  let dateNowSpy: ReturnType<typeof vi.spyOn>;
  const FIXED_NOW = 1000000000000;

  beforeEach(() => {
    mockLogger = createMockLogger();

    mockAuthGateway = {
      requestVerificationCode: vi.fn(),
      authenticate2FA: vi.fn(),
      authenticatePassword: vi.fn(),
      refreshToken: vi.fn(),
    } satisfies Partial<IAuthGateway> as IAuthGateway;

    mockStateRepository = asPartial<AuthenticationStateRepository>({
      getAuthState: vi.fn(),
      saveAuthState: vi.fn(),
      clearAuthState: vi.fn(),
    });

    service = new VerificationCodeService(mockAuthGateway, mockStateRepository, mockLogger);

    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);

    vi.clearAllMocks();
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  describe('requestVerificationCode', () => {
    it('should successfully request verification code', async () => {
      vi.mocked(mockAuthGateway.requestVerificationCode).mockResolvedValue();

      await service.requestVerificationCode('test@example.com');

      expect(mockAuthGateway.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
      expect(mockLogger.debug).toHaveBeenCalledWith('Requesting verification code for email:', 'test@example.com');
    });

    it('should throw AuthenticationError when gateway fails', async () => {
      const originalError = new Error('Network error');
      vi.mocked(mockAuthGateway.requestVerificationCode).mockRejectedValue(originalError);

      await expect(service.requestVerificationCode('test@example.com')).rejects.toThrow(AuthenticationError);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to request verification code:', {
        email: 'test@example.com',
        error: originalError,
      });
    });

    it('should include email in thrown error context', async () => {
      vi.mocked(mockAuthGateway.requestVerificationCode).mockRejectedValue(new Error('API error'));

      const promise = service.requestVerificationCode('test@example.com');
      await expect(promise).rejects.toThrow(AuthenticationError);

      const error = await promise.catch((e) => e);
      expect(error.metadata).toEqual({
        email: 'test@example.com',
        originalError: 'API error',
      });
    });

    it('should include original error message in thrown error', async () => {
      vi.mocked(mockAuthGateway.requestVerificationCode).mockRejectedValue(new Error('Timeout'));

      const promise = service.requestVerificationCode('test@example.com');
      await expect(promise).rejects.toThrow(AuthenticationError);

      const error = await promise.catch((e) => e);
      expect(error.message).toBe('Failed to send verification code. Please check your email address and try again.');
      expect(error.metadata?.originalError).toBe('Timeout');
    });

    it('should handle non-Error objects in failures', async () => {
      vi.mocked(mockAuthGateway.requestVerificationCode).mockRejectedValue('String error');

      const promise = service.requestVerificationCode('test@example.com');
      await expect(promise).rejects.toThrow(AuthenticationError);

      const error = await promise.catch((e) => e);
      expect(error.metadata?.originalError).toBe('String error');
    });
  });

  describe('isRateLimited', () => {
    it('should return false when no auth state exists', async () => {
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(undefined);

      const result = await service.isRateLimited();

      expect(result).toBe(false);
      expect(mockStateRepository.getAuthState).toHaveBeenCalled();
    });

    it('should return false when codeRequestedAt is undefined', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: undefined,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.isRateLimited();

      expect(result).toBe(false);
    });

    it('should return false when rate limit period has expired', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - VERIFICATION_CODE_RATE_LIMIT_MS - 1000,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.isRateLimited();

      expect(result).toBe(false);
    });

    it('should return false when rate limit period has exactly expired', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - VERIFICATION_CODE_RATE_LIMIT_MS,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.isRateLimited();

      expect(result).toBe(false);
    });

    it('should return true when within rate limit period', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - 5 * 60 * 1000,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.isRateLimited();

      expect(result).toBe(true);
    });

    it('should return true when just requested', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.isRateLimited();

      expect(result).toBe(true);
    });

    it('should return true when one millisecond before expiry', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - VERIFICATION_CODE_RATE_LIMIT_MS + 1,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.isRateLimited();

      expect(result).toBe(true);
    });
  });

  describe('getRemainingWaitTime', () => {
    it('should return 0 when no auth state exists', async () => {
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(undefined);

      const result = await service.getRemainingWaitTime();

      expect(result).toBe(0);
      expect(mockStateRepository.getAuthState).toHaveBeenCalled();
    });

    it('should return 0 when codeRequestedAt is undefined', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: undefined,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.getRemainingWaitTime();

      expect(result).toBe(0);
    });

    it('should return 0 when rate limit period has expired', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - VERIFICATION_CODE_RATE_LIMIT_MS - 1000,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.getRemainingWaitTime();

      expect(result).toBe(0);
    });

    it('should return 0 when rate limit period has exactly expired', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - VERIFICATION_CODE_RATE_LIMIT_MS,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.getRemainingWaitTime();

      expect(result).toBe(0);
    });

    it('should return correct remaining seconds when within rate limit period', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - 5 * 60 * 1000,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.getRemainingWaitTime();

      expect(result).toBe(600);
    });

    it('should return full rate limit period when just requested', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.getRemainingWaitTime();

      expect(result).toBe(900);
    });

    it('should round up to nearest second', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - 500,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.getRemainingWaitTime();

      expect(result).toBe(900);
    });

    it('should round up fractional seconds', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - 14 * 60 * 1000 - 500,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.getRemainingWaitTime();

      expect(result).toBe(60);
    });

    it('should return 1 second when less than 1 second remaining', async () => {
      const authState: AuthenticateFlowState = {
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW - VERIFICATION_CODE_RATE_LIMIT_MS + 999,
      };
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(authState);

      const result = await service.getRemainingWaitTime();

      expect(result).toBe(1);
    });
  });

  describe('recordCodeRequest', () => {
    it('should save auth state with current timestamp', async () => {
      vi.mocked(mockStateRepository.saveAuthState).mockResolvedValue();

      await service.recordCodeRequest('test@example.com');

      expect(mockStateRepository.saveAuthState).toHaveBeenCalledWith({
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW,
      });
    });

    it('should save auth state with email', async () => {
      vi.mocked(mockStateRepository.saveAuthState).mockResolvedValue();

      await service.recordCodeRequest('user@test.com');

      expect(mockStateRepository.saveAuthState).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@test.com',
        }),
      );
    });

    it('should use Date.now() for timestamp', async () => {
      vi.mocked(mockStateRepository.saveAuthState).mockResolvedValue();

      await service.recordCodeRequest('test@example.com');

      expect(mockStateRepository.saveAuthState).toHaveBeenCalledWith(
        expect.objectContaining({
          codeRequestedAt: FIXED_NOW,
        }),
      );
      expect(dateNowSpy).toHaveBeenCalled();
    });
  });

  describe('clearCodeRequestState', () => {
    it('should call clearAuthState on repository', async () => {
      vi.mocked(mockStateRepository.clearAuthState).mockResolvedValue();

      await service.clearCodeRequestState();

      expect(mockStateRepository.clearAuthState).toHaveBeenCalled();
    });

    it('should propagate repository errors', async () => {
      const error = new Error('Clear failed');
      vi.mocked(mockStateRepository.clearAuthState).mockRejectedValue(error);

      await expect(service.clearCodeRequestState()).rejects.toThrow('Clear failed');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete request flow', async () => {
      vi.mocked(mockAuthGateway.requestVerificationCode).mockResolvedValue();
      vi.mocked(mockStateRepository.saveAuthState).mockResolvedValue();

      await service.requestVerificationCode('test@example.com');
      await service.recordCodeRequest('test@example.com');

      expect(mockAuthGateway.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
      expect(mockStateRepository.saveAuthState).toHaveBeenCalledWith({
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW,
      });
    });

    it('should properly check rate limit after recording request', async () => {
      vi.mocked(mockStateRepository.saveAuthState).mockResolvedValue();
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue({
        email: 'test@example.com',
        codeRequestedAt: FIXED_NOW,
      });

      await service.recordCodeRequest('test@example.com');
      const isLimited = await service.isRateLimited();

      expect(isLimited).toBe(true);
    });

    it('should allow request after clearing state', async () => {
      vi.mocked(mockStateRepository.clearAuthState).mockResolvedValue();
      vi.mocked(mockStateRepository.getAuthState).mockResolvedValue(undefined);

      await service.clearCodeRequestState();
      const isLimited = await service.isRateLimited();

      expect(isLimited).toBe(false);
    });
  });
});
