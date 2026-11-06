import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ClientRouter } from '../../roborockCommunication/routing/clientRouter.js';
import ClientManager from '../../services/clientManager.js';
import { createMockLogger, makeMockClientRouter } from '../helpers/testUtils.js';

describe('ClientManager (gaps)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let manager: ClientManager;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		manager = new ClientManager(mockLogger);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('destroy', () => {
		it('should log an error and still remove the client when disconnect throws', () => {
			// Arrange
			const username = 'user@example.com';
			const disconnectError = new Error('socket closed');
			const client: ClientRouter = makeMockClientRouter({
				disconnect: vi.fn(() => {
					throw disconnectError;
				}),
			});
			manager['clients'].set(username, client);
			// Act
			manager.destroy(username);
			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(`Error disconnecting client for ${username}:`, disconnectError);
			expect(manager['clients'].has(username)).toBe(false);
		});

		it('should do nothing when no client exists for the username', () => {
			// Arrange
			const username = 'unknown@example.com';
			// Act
			manager.destroy(username);
			// Assert
			expect(mockLogger.error).not.toHaveBeenCalled();
			expect(manager['clients'].size).toBe(0);
		});
	});

	describe('destroyAll', () => {
		it('should log an error for the failing client, disconnect the rest, and clear the map', () => {
			// Arrange
			const failingUser = 'failing@example.com';
			const healthyUser = 'healthy@example.com';
			const disconnectError = new Error('timeout');
			const failingClient = makeMockClientRouter({
				disconnect: vi.fn(() => {
					throw disconnectError;
				}),
			});
			const healthyClient = makeMockClientRouter();
			manager['clients'].set(failingUser, failingClient);
			manager['clients'].set(healthyUser, healthyClient);
			// Act
			manager.destroyAll();
			// Assert
			expect(mockLogger.error).toHaveBeenCalledTimes(1);
			expect(mockLogger.error).toHaveBeenCalledWith(`Error disconnecting client for ${failingUser}:`, disconnectError);
			expect(healthyClient.disconnect).toHaveBeenCalledTimes(1);
			expect(manager['clients'].size).toBe(0);
		});
	});
});
