import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import { CONNECTION_RETRY_DELAY_MS, MAX_CONNECTION_ATTEMPTS } from '../../constants/index.js';
import type ClientManager from '../../services/clientManager.js';
import { ConnectionService } from '../../services/connectionService.js';
import type { MessageRoutingService } from '../../services/messageRoutingService.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

describe('ConnectionService (gaps)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let service: ConnectionService;
	let setTimeoutSpy: MockInstance<typeof setTimeout> | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		mockLogger = createMockLogger();
		service = new ConnectionService(asPartial<ClientManager>({}), mockLogger, asPartial<MessageRoutingService>({}));
	});

	afterEach(() => {
		setTimeoutSpy?.mockRestore();
		setTimeoutSpy = undefined;
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	describe('waitForConnection', () => {
		it('should retry MAX_CONNECTION_ATTEMPTS times with CONNECTION_RETRY_DELAY_MS when defaults are used', async () => {
			// Arrange
			setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
			const checkConnection = vi.fn().mockReturnValue(false);
			// Act
			const promise = service.waitForConnection(checkConnection);
			const assertion = expect(promise).rejects.toThrow(`Connection timeout after ${MAX_CONNECTION_ATTEMPTS} attempts`);
			await vi.runAllTimersAsync();
			// Assert
			await assertion;
			const retryDelays = setTimeoutSpy.mock.calls.map((call) => call[1]);
			expect(retryDelays).toHaveLength(MAX_CONNECTION_ATTEMPTS);
			expect(retryDelays.every((delay) => delay === CONNECTION_RETRY_DELAY_MS)).toBe(true);
		});

		it('should return the attempt count when the connection becomes ready on a later check', async () => {
			// Arrange
			const checkConnection = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(false).mockReturnValue(true);
			// Act
			const promise = service.waitForConnection(checkConnection);
			await vi.runAllTimersAsync();
			const attempts = await promise;
			// Assert
			expect(attempts).toBe(2);
		});
	});
});
