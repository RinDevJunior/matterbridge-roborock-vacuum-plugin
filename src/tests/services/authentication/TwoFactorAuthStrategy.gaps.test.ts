import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import type { AuthContext } from '../../../services/authentication/AuthContext.js';
import { TwoFactorAuthStrategy } from '../../../services/authentication/TwoFactorAuthStrategy.js';
import type { UserDataRepository } from '../../../services/authentication/UserDataRepository.js';
import type { VerificationCodeService } from '../../../services/authentication/VerificationCodeService.js';
import type { AuthenticationService } from '../../../services/authenticationService.js';
import type { WssSendSnackbarMessage } from '../../../types/WssSendSnackbarMessage.js';
import { asPartial, createMockConfigManager, createMockLogger } from '../../helpers/testUtils.js';

function createMockAuthService(): AuthenticationService {
	return asPartial<AuthenticationService>({
		loginWithCachedToken: vi.fn(),
		loginWithVerificationCode: vi.fn(),
	});
}

function createMockUserDataRepository(): UserDataRepository {
	return asPartial<UserDataRepository>({
		loadUserData: vi.fn().mockResolvedValue(undefined),
		saveUserData: vi.fn().mockResolvedValue(undefined),
		clearUserData: vi.fn().mockResolvedValue(undefined),
	});
}

function createMockVerificationCodeService(): VerificationCodeService {
	return asPartial<VerificationCodeService>({
		isRateLimited: vi.fn().mockResolvedValue(false),
		getRemainingWaitTime: vi.fn().mockResolvedValue(0),
		requestVerificationCode: vi.fn().mockResolvedValue(undefined),
		recordCodeRequest: vi.fn().mockResolvedValue(undefined),
		clearCodeRequestState: vi.fn().mockResolvedValue(undefined),
	});
}

describe('TwoFactorAuthStrategy (gaps)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let mockAuthService: AuthenticationService;
	let mockUserDataRepository: UserDataRepository;
	let mockVerificationCodeService: VerificationCodeService;
	let mockConfigManager: PlatformConfigManager;
	let mockToast: ReturnType<typeof vi.fn>;
	let strategy: TwoFactorAuthStrategy;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		mockAuthService = createMockAuthService();
		mockUserDataRepository = createMockUserDataRepository();
		mockVerificationCodeService = createMockVerificationCodeService();
		mockConfigManager = createMockConfigManager();
		mockToast = vi.fn();
		strategy = new TwoFactorAuthStrategy(
			mockAuthService,
			mockUserDataRepository,
			mockVerificationCodeService,
			mockConfigManager,
			mockToast as WssSendSnackbarMessage,
			mockLogger,
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('authenticateWithCode', () => {
		it('should reject with a verification code required error when context has no verificationCode', async () => {
			// Arrange
			const context = asPartial<AuthContext>({ username: 'user@example.com' });
			// Act
			const result = strategy['authenticateWithCode'](context);
			// Assert
			await expect(result).rejects.toThrow('Verification code is required for authentication.');
			expect(mockAuthService.loginWithVerificationCode).not.toHaveBeenCalled();
		});
	});

	describe('verification code banner', () => {
		it('should log a banner saying the code has been sent when no code was previously requested', async () => {
			// Arrange
			const context = asPartial<AuthContext>({ username: 'user@example.com', password: 'pw' });
			// Act
			const result = await strategy.authenticate(context);
			// Assert
			expect(result).toBeUndefined();
			expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('has been sent to: user@example.com'));
			expect(mockToast).toHaveBeenCalledWith(expect.stringContaining('ACTION REQUIRED'), 60 * 1000, 'warning');
		});

		it('should log a banner saying the code was previously sent when rate limited', async () => {
			// Arrange
			const context = asPartial<AuthContext>({ username: 'user@example.com', password: 'pw' });
			vi.mocked(mockVerificationCodeService.isRateLimited).mockResolvedValue(true);
			vi.mocked(mockVerificationCodeService.getRemainingWaitTime).mockResolvedValue(30);
			// Act
			const result = await strategy.authenticate(context);
			// Assert
			expect(result).toBeUndefined();
			expect(mockLogger.warn).toHaveBeenCalledWith('Please wait 30 seconds before requesting another code.');
			expect(mockLogger.notice).toHaveBeenCalledWith(
				expect.stringContaining('was previously sent to: user@example.com'),
			);
			expect(mockVerificationCodeService.requestVerificationCode).not.toHaveBeenCalled();
		});
	});
});
