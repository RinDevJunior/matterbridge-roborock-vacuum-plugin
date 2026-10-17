import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Device } from '../../roborockCommunication/models/index.js';
import type { MessageRoutingService } from '../../services/messageRoutingService.js';
import { PollingService } from '../../services/pollingService.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

const REFRESH_INTERVAL = 1;
const INTERVAL_MS = REFRESH_INTERVAL * 1000;

describe('PollingService (gaps)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let mockMessageRoutingService: MessageRoutingService;
	let service: PollingService;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		mockLogger = createMockLogger();
		mockMessageRoutingService = asPartial<MessageRoutingService>({
			getMessageDispatcher: vi.fn().mockReturnValue(undefined),
		});
		service = new PollingService(REFRESH_INTERVAL, mockLogger, mockMessageRoutingService);
	});

	afterEach(() => {
		service.stopPolling();
		vi.clearAllMocks();
		vi.useRealTimers();
	});

	describe('activateDeviceNotifyOverLocal', () => {
		it('should log an error and skip the poll without throwing when no dispatcher is registered', async () => {
			// Arrange
			const device = asPartial<Device>({ duid: 'duid-1' });
			service.activateDeviceNotifyOverLocal(device);
			// Act
			await vi.advanceTimersByTimeAsync(INTERVAL_MS);
			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith('Local Polling - No message dispatcher for device:', 'duid-1');
			expect(mockMessageRoutingService.getMessageDispatcher).toHaveBeenCalledWith('duid-1');
		});
	});
});
