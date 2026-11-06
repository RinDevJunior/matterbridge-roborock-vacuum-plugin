import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DisconnectNotificationListener } from '../../../../../roborockCommunication/routing/listeners/implementation/disconnectNotificationListener.js';
import type { EmailNotificationService } from '../../../../../services/emailNotificationService.js';
import { asPartial, createMockLogger } from '../../../../helpers/testUtils.js';

const DUID = 'duid-1';

function createMockEmailService(): EmailNotificationService {
	return asPartial<EmailNotificationService>({
		send: vi.fn().mockResolvedValue(undefined),
	});
}

describe('DisconnectNotificationListener (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let emailService: EmailNotificationService;
	let listener: DisconnectNotificationListener;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		emailService = createMockEmailService();
		listener = new DisconnectNotificationListener(emailService, mockLogger, 'MQTT');
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('onOffline', () => {
		it('should log a warning and send an offline email containing the duid', async () => {
			// Arrange
			// Act
			await listener.onOffline(DUID);
			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('went offline'));
			expect(emailService.send).toHaveBeenCalledTimes(1);
			expect(vi.mocked(emailService.send).mock.calls[0][0]).toBe(`[Roborock] MQTT connection offline: ${DUID}`);
			expect(vi.mocked(emailService.send).mock.calls[0][1]).toContain(
				`Device ${DUID} lost network connectivity on MQTT.`,
			);
		});
	});

	describe('onClose', () => {
		it('should log a warning and send a closed email containing the duid', async () => {
			// Arrange
			const localListener = new DisconnectNotificationListener(emailService, mockLogger, 'Local');
			// Act
			await localListener.onClose(DUID);
			// Assert
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Local connection closed'));
			expect(emailService.send).toHaveBeenCalledTimes(1);
			expect(vi.mocked(emailService.send).mock.calls[0][0]).toBe(`[Roborock] Local connection closed: ${DUID}`);
			expect(vi.mocked(emailService.send).mock.calls[0][1]).toContain(`Device ${DUID} Local connection was closed.`);
		});
	});
});
