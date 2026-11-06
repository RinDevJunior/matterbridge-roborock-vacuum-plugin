import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MANUAL_RECONNECT_DELAY_MS } from '../../../../../constants/index.js';
import type { AbstractClient } from '../../../../../roborockCommunication/routing/abstractClient.js';
import { ConnectionStateListener } from '../../../../../roborockCommunication/routing/listeners/implementation/connectionStateListener.js';
import { asPartial, createMockLogger } from '../../../../helpers/testUtils.js';

const DUID = 'duid-1';
const CLIENT_NAME = 'MQTT';

function createMockClient(): AbstractClient {
	return asPartial<AbstractClient>({
		retryCount: 0,
		isInDisconnectingStep: false,
		isConnected: vi.fn().mockReturnValue(false),
		connect: vi.fn(),
	});
}

describe('ConnectionStateListener (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let client: AbstractClient;
	let listener: ConnectionStateListener;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		client = createMockClient();
		listener = new ConnectionStateListener(mockLogger, client, CLIENT_NAME);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	describe('onClose', () => {
		it('should log an error naming the duid and client when the connection closes', async () => {
			// Arrange
			listener.stop();
			// Act
			await listener.onClose(DUID);
			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(`Device ${DUID} connection closed on ${CLIENT_NAME}.`);
		});

		it('should schedule a reconnect attempt when reconnection is enabled', async () => {
			// Arrange
			vi.useFakeTimers();
			listener.start();
			// Act
			await listener.onClose(DUID);
			// Assert
			expect(client.retryCount).toBe(1);
			await vi.advanceTimersByTimeAsync(MANUAL_RECONNECT_DELAY_MS);
			expect(client.connect).toHaveBeenCalledTimes(1);
		});
	});
});
