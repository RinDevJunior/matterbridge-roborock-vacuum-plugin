import { AnsiLogger } from 'matterbridge/logger';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { AuthenticationCoordinator } from '../../../services/authentication/AuthenticationCoordinator.js';
import { PasswordAuthStrategy } from '../../../services/authentication/PasswordAuthStrategy.js';
import { TwoFactorAuthStrategy } from '../../../services/authentication/TwoFactorAuthStrategy.js';
import { AuthContext } from '../../../services/authentication/AuthContext.js';
import { UserData } from '../../../roborockCommunication/models/index.js';
import { createMockLogger, asPartial } from '../../testUtils.js';

describe('AuthenticationCoordinator', () => {
  let coordinator: AuthenticationCoordinator;
  let mockPasswordStrategy: PasswordAuthStrategy;
  let mockTwoFactorStrategy: TwoFactorAuthStrategy;
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

    mockPasswordStrategy = asPartial<PasswordAuthStrategy>({
      authenticate: vi.fn(),
    });

    mockTwoFactorStrategy = asPartial<TwoFactorAuthStrategy>({
      authenticate: vi.fn(),
    });

    coordinator = new AuthenticationCoordinator(mockPasswordStrategy, mockTwoFactorStrategy, mockLogger);

    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    const createContext = (username: string, password: string, verificationCode?: string): AuthContext => ({
      username,
      password,
      verificationCode,
    });

    describe('Password authentication', () => {
      it('should authenticate successfully with Password method', async () => {
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockPasswordStrategy.authenticate).mockResolvedValue(mockUserData);

        const result = await coordinator.authenticate('Password', context);

        expect(result).toEqual(mockUserData);
        expect(mockPasswordStrategy.authenticate).toHaveBeenCalledWith(context);
        expect(mockPasswordStrategy.authenticate).toHaveBeenCalledTimes(1);
      });

      it('should return undefined when Password strategy returns undefined', async () => {
        const context = createContext('test@example.com', 'wrong-password');
        vi.mocked(mockPasswordStrategy.authenticate).mockResolvedValue(undefined);

        const result = await coordinator.authenticate('Password', context);

        expect(result).toBeUndefined();
        expect(mockPasswordStrategy.authenticate).toHaveBeenCalledWith(context);
      });

      it('should not call TwoFactorStrategy when using Password method', async () => {
        const context = createContext('test@example.com', 'password123');
        vi.mocked(mockPasswordStrategy.authenticate).mockResolvedValue(mockUserData);

        await coordinator.authenticate('Password', context);

        expect(mockTwoFactorStrategy.authenticate).not.toHaveBeenCalled();
      });
    });

    describe('VerificationCode authentication', () => {
      it('should authenticate successfully with VerificationCode method', async () => {
        const context = createContext('test@example.com', 'password123', '123456');
        vi.mocked(mockTwoFactorStrategy.authenticate).mockResolvedValue(mockUserData);

        const result = await coordinator.authenticate('VerificationCode', context);

        expect(result).toEqual(mockUserData);
        expect(mockTwoFactorStrategy.authenticate).toHaveBeenCalledWith(context);
        expect(mockTwoFactorStrategy.authenticate).toHaveBeenCalledTimes(1);
      });

      it('should return undefined when VerificationCode strategy returns undefined', async () => {
        const context = createContext('test@example.com', 'password123', 'wrong-code');
        vi.mocked(mockTwoFactorStrategy.authenticate).mockResolvedValue(undefined);

        const result = await coordinator.authenticate('VerificationCode', context);

        expect(result).toBeUndefined();
        expect(mockTwoFactorStrategy.authenticate).toHaveBeenCalledWith(context);
      });

      it('should not call PasswordStrategy when using VerificationCode method', async () => {
        const context = createContext('test@example.com', 'password123', '123456');
        vi.mocked(mockTwoFactorStrategy.authenticate).mockResolvedValue(mockUserData);

        await coordinator.authenticate('VerificationCode', context);

        expect(mockPasswordStrategy.authenticate).not.toHaveBeenCalled();
      });
    });

    describe('Unknown method handling', () => {
      it('should throw error for unknown authentication method', async () => {
        const context = createContext('test@example.com', 'password123');

        await expect(coordinator.authenticate('UnknownMethod', context)).rejects.toThrow(
          'Unknown authentication method: UnknownMethod',
        );
      });

      it('should log error with available methods for unknown method', async () => {
        const context = createContext('test@example.com', 'password123');

        try {
          await coordinator.authenticate('InvalidMethod', context);
        } catch {
          // Expected to throw
        }

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Unknown authentication method: InvalidMethod. Available methods: Password, VerificationCode',
        );
      });

      it('should not call any strategy for unknown method', async () => {
        const context = createContext('test@example.com', 'password123');

        try {
          await coordinator.authenticate('BadMethod', context);
        } catch {
          // Expected to throw
        }

        expect(mockPasswordStrategy.authenticate).not.toHaveBeenCalled();
        expect(mockTwoFactorStrategy.authenticate).not.toHaveBeenCalled();
      });

      it('should throw for empty string method', async () => {
        const context = createContext('test@example.com', 'password123');

        await expect(coordinator.authenticate('', context)).rejects.toThrow('Unknown authentication method: ');
      });

      it('should throw for case-sensitive method mismatch', async () => {
        const context = createContext('test@example.com', 'password123');

        await expect(coordinator.authenticate('password', context)).rejects.toThrow(
          'Unknown authentication method: password',
        );
      });
    });

    describe('Strategy delegation', () => {
      it('should pass context correctly to Password strategy', async () => {
        const context = createContext('user@test.com', 'my-password');
        vi.mocked(mockPasswordStrategy.authenticate).mockResolvedValue(mockUserData);

        await coordinator.authenticate('Password', context);

        expect(mockPasswordStrategy.authenticate).toHaveBeenCalledWith(context);
        const calledContext = vi.mocked(mockPasswordStrategy.authenticate).mock.calls[0][0];
        expect(calledContext.username).toBe('user@test.com');
        expect(calledContext.password).toBe('my-password');
      });

      it('should pass context correctly to VerificationCode strategy', async () => {
        const context = createContext('user@test.com', 'my-password', '654321');
        vi.mocked(mockTwoFactorStrategy.authenticate).mockResolvedValue(mockUserData);

        await coordinator.authenticate('VerificationCode', context);

        expect(mockTwoFactorStrategy.authenticate).toHaveBeenCalledWith(context);
        const calledContext = vi.mocked(mockTwoFactorStrategy.authenticate).mock.calls[0][0];
        expect(calledContext.username).toBe('user@test.com');
        expect(calledContext.password).toBe('my-password');
        expect(calledContext.verificationCode).toBe('654321');
      });

      it('should propagate errors from Password strategy', async () => {
        const context = createContext('test@example.com', 'password123');
        const strategyError = new Error('Password strategy failed');
        vi.mocked(mockPasswordStrategy.authenticate).mockRejectedValue(strategyError);

        await expect(coordinator.authenticate('Password', context)).rejects.toThrow('Password strategy failed');
      });

      it('should propagate errors from VerificationCode strategy', async () => {
        const context = createContext('test@example.com', 'password123', '123456');
        const strategyError = new Error('2FA strategy failed');
        vi.mocked(mockTwoFactorStrategy.authenticate).mockRejectedValue(strategyError);

        await expect(coordinator.authenticate('VerificationCode', context)).rejects.toThrow('2FA strategy failed');
      });
    });
  });
});
