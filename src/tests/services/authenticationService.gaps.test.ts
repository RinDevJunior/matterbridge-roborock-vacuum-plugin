import type { AnsiLogger } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationError } from '../../errors/index.js';
import type { RoborockAuthGateway } from '../../roborockCommunication/adapters/RoborockAuthGateway.js';
import type { UserData } from '../../roborockCommunication/models/index.js';
import { AuthenticationService } from '../../services/authenticationService.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

function createMockAuthGateway(): RoborockAuthGateway {
	return asPartial<RoborockAuthGateway>({
		authenticate2FA: vi.fn(),
		authenticatePassword: vi.fn(),
		refreshToken: vi.fn(),
	});
}

describe('AuthenticationService (gaps)', () => {
	let authGateway: RoborockAuthGateway;
	let logger: AnsiLogger;
	let service: AuthenticationService;

	beforeEach(() => {
		vi.clearAllMocks();
		authGateway = createMockAuthGateway();
		logger = createMockLogger();
		service = new AuthenticationService(authGateway, logger);
	});

	it('should wrap a plain string rejection in AuthenticationError when verification code login fails', async () => {
		// Arrange
		vi.mocked(authGateway.authenticate2FA).mockRejectedValue('boom');
		// Act
		const promise = service.loginWithVerificationCode('user@example.com', '123456');
		// Assert
		await expect(promise).rejects.toBeInstanceOf(AuthenticationError);
		await expect(promise).rejects.toMatchObject({ metadata: { originalError: 'boom' } });
		expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
	});

	it('should wrap a plain string rejection in AuthenticationError when cached token login fails', async () => {
		// Arrange
		vi.mocked(authGateway.refreshToken).mockRejectedValue('boom');
		// Act
		const promise = service.loginWithCachedToken('user@example.com', asPartial<UserData>({}));
		// Assert
		await expect(promise).rejects.toBeInstanceOf(AuthenticationError);
		await expect(promise).rejects.toMatchObject({ metadata: { originalError: 'boom' } });
		expect(logger.error).toHaveBeenCalledWith(
			'Failed to authenticate with cached token:',
			expect.objectContaining({ error: 'boom' }),
		);
	});

	it('should wrap a plain string rejection in AuthenticationError when password login fails', async () => {
		// Arrange
		vi.mocked(authGateway.authenticatePassword).mockRejectedValue('boom');
		// Act
		const promise = service.loginWithPassword('user@example.com', 'secret');
		// Assert
		await expect(promise).rejects.toBeInstanceOf(AuthenticationError);
		await expect(promise).rejects.toMatchObject({ metadata: { originalError: 'boom' } });
		expect(logger.error).toHaveBeenCalledWith(
			'Failed to login with password:',
			expect.objectContaining({ error: 'boom' }),
		);
	});
});
