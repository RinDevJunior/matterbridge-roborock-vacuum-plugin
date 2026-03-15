import { AnsiLogger } from 'matterbridge/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_REFRESH_INTERVAL_MULTIPLIER, MQTT_REFRESH_INTERVAL_MULTIPLIER } from '../../constants/index.js';
import { Device } from '../../roborockCommunication/models/index.js';
import { AbstractMessageDispatcher } from '../../roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.js';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import { PollingService } from '../../services/pollingService.js';
import { NotifyMessageTypes } from '../../types/notifyMessageTypes.js';
import { asPartial, asType, createMockLogger } from '../helpers/testUtils.js';

describe('PollingService', () => {
	let service: PollingService;
	let mockLogger: AnsiLogger;
	let mockMessageRoutingService: MessageRoutingService;
	let mockMessageDispatcher: AbstractMessageDispatcher;
	const TEST_REFRESH_INTERVAL = 100;

	const mockDevice: Device = {
		duid: 'test-duid-123',
		name: 'Test Vacuum',
		localKey: 'test-local-key',
	} as Device;

	const mockDevice2: Device = {
		duid: 'test-duid-456',
		name: 'Test Vacuum 2',
		localKey: 'test-local-key-2',
	} as Device;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();

		mockLogger = createMockLogger();

		mockMessageDispatcher = asPartial<AbstractMessageDispatcher>({
			getDeviceStatus: vi.fn(async (_duid: string) => undefined),
			startRoomCleaning: vi.fn(),
			pauseCleaning: vi.fn(),
			resumeCleaning: vi.fn(),
			stopCleaning: vi.fn(),
			goHome: vi.fn(),
			findMyRobot: vi.fn(),
			getRoomMap: vi.fn(),
			sendCustomMessage: vi.fn(),
			getCustomMessage: vi.fn(),
			getCleanModeData: vi.fn(),
			changeCleanMode: vi.fn(),
		});

		mockMessageRoutingService = asPartial<MessageRoutingService>({
			getMessageDispatcher: vi.fn().mockReturnValue(mockMessageDispatcher),
			getCleanModeData: vi.fn(),
			getRoomIdFromMap: vi.fn(),
			changeCleanMode: vi.fn(),
			startClean: vi.fn(),
			pauseClean: vi.fn(),
			stopAndGoHome: vi.fn(),
			resumeClean: vi.fn(),
			playSoundToLocate: vi.fn(),
			customGet: vi.fn(),
			customSend: vi.fn(),
			setIotApi: vi.fn(),
			clearAll: vi.fn(),
		});
		service = new PollingService(TEST_REFRESH_INTERVAL, mockLogger, mockMessageRoutingService);
	});

	afterEach(() => {
		service.stopPolling();
		vi.useRealTimers();
	});

	describe('activateDeviceNotifyOverLocal', () => {
		it('should activate polling and start interval', () => {
			service.activateDeviceNotifyOverLocal(mockDevice);

			expect(mockLogger.debug).toHaveBeenCalledWith('Activating device status polling for:', mockDevice.duid);
			expect(service['localIntervals'].has(mockDevice.duid)).toBe(true);
		});

		it('should clear existing interval before creating new one for the same device', () => {
			service.activateDeviceNotifyOverLocal(mockDevice);
			const firstInterval = service['localIntervals'].get(mockDevice.duid);

			service.activateDeviceNotifyOverLocal(mockDevice);
			const secondInterval = service['localIntervals'].get(mockDevice.duid);

			expect(firstInterval).not.toBe(secondInterval);
		});

		it('should handle multiple polling cycles', async () => {
			const mockMessageData = { state: 8, error_code: 0, dock_error_status: 0, dock_type: 1 };
			const mockResponse = {
				getMessage: () => mockMessageData,
			};
			mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue(mockResponse as never);

			service.activateDeviceNotifyOverLocal(mockDevice);

			for (let i = 0; i < 3; i++) {
				await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);
			}

			expect(mockMessageDispatcher.getDeviceStatus).toHaveBeenCalledTimes(3);
		});

		it('should handle getDeviceStatus errors gracefully', async () => {
			const testError = new Error('Network timeout');
			mockMessageDispatcher.getDeviceStatus = vi.fn().mockRejectedValue(testError);

			service.activateDeviceNotifyOverLocal(mockDevice);

			await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

			expect(mockLogger.error).toHaveBeenCalledWith('Failed to get device status:', testError);
		});
	});

	describe('requestStatusOnce', () => {
		it('should call getDeviceStatus for the given duid', async () => {
			await service.requestStatusOnce(mockDevice.duid);
			expect(mockMessageDispatcher.getDeviceStatus).toHaveBeenCalledWith(mockDevice.duid);
		});

		it('should return early when no dispatcher is found', async () => {
			vi.mocked(mockMessageRoutingService.getMessageDispatcher).mockReturnValue(
				asType<AbstractMessageDispatcher>(undefined),
			);
			await service.requestStatusOnce(mockDevice.duid);
			expect(mockMessageDispatcher.getDeviceStatus).not.toHaveBeenCalled();
		});

		it('should log error and not throw when getDeviceStatus fails', async () => {
			const testError = new Error('Network timeout');
			vi.mocked(mockMessageDispatcher.getDeviceStatus).mockRejectedValue(testError);
			await expect(service.requestStatusOnce(mockDevice.duid)).resolves.not.toThrow();
			expect(mockLogger.error).toHaveBeenCalledWith('Failed to get device status:', testError);
		});

		it('should not affect the recurring polling interval', async () => {
			service.activateDeviceNotifyOverLocal(mockDevice);
			const intervalBefore = service['localIntervals'].get(mockDevice.duid);

			await service.requestStatusOnce(mockDevice.duid);

			expect(service['localIntervals'].get(mockDevice.duid)).toBe(intervalBefore);
		});
	});

	describe('stopPolling', () => {
		it('should clear the polling interval', () => {
			service.activateDeviceNotifyOverLocal(mockDevice);

			expect(service['localIntervals'].has(mockDevice.duid)).toBe(true);

			service.stopPolling();

			expect(service['localIntervals'].size).toBe(0);
		});

		it('should handle calling stopPolling when no interval is active', () => {
			expect(() => {
				service.stopPolling();
			}).not.toThrow();
			expect(service['localIntervals'].size).toBe(0);
		});

		it('should prevent further polling after stopPolling is called', async () => {
			mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue({
				errorStatus: { error: 0 },
				message: { state: 8 },
			} as never);

			service.activateDeviceNotifyOverLocal(mockDevice);
			service.stopPolling();

			await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER * 3);

			expect(mockMessageDispatcher.getDeviceStatus).not.toHaveBeenCalled();
		});
	});

	describe('shutdown', () => {
		it('should stop polling and clear deviceNotify callback', async () => {
			service.activateDeviceNotifyOverLocal(mockDevice);

			await service.shutdown();

			expect(service['localIntervals'].size).toBe(0);
		});

		it('should handle shutdown when nothing is active', async () => {
			await expect(service.shutdown()).resolves.not.toThrow();
		});

		it('should prevent polling after shutdown', async () => {
			mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue({
				errorStatus: { error: 0 },
				message: { state: 8 },
			} as never);

			service.activateDeviceNotifyOverLocal(mockDevice);
			await service.shutdown();

			await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER * 3);

			expect(mockMessageDispatcher.getDeviceStatus).not.toHaveBeenCalled();
		});
	});

	describe('multi-device polling', () => {
		it('should not stop device1 polling when device2 is activated', async () => {
			service.activateDeviceNotifyOverLocal(mockDevice);
			service.activateDeviceNotifyOverLocal(mockDevice2);

			await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

			const calls = vi.mocked(mockMessageDispatcher.getDeviceStatus).mock.calls;
			const device1Calls = calls.filter(([duid]) => duid === mockDevice.duid);
			expect(device1Calls.length).toBeGreaterThan(0);
		});

		it('should poll both devices independently when two devices are activated', async () => {
			service.activateDeviceNotifyOverLocal(mockDevice);
			service.activateDeviceNotifyOverLocal(mockDevice2);

			await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

			const calls = vi.mocked(mockMessageDispatcher.getDeviceStatus).mock.calls;
			const device1Calls = calls.filter(([duid]) => duid === mockDevice.duid);
			const device2Calls = calls.filter(([duid]) => duid === mockDevice2.duid);
			expect(device1Calls.length).toBeGreaterThan(0);
			expect(device2Calls.length).toBeGreaterThan(0);
		});
	});

	describe('integration scenarios', () => {
		it('should switch from local to MQTT polling', async () => {
			const localResponse = {
				errorStatus: { error: 0 },
				message: { state: 8 },
			};
			const mqttResponse = {
				errorStatus: { error: 0 },
				message: { state: 5 },
			};
			mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue(localResponse as never);

			service.activateDeviceNotifyOverLocal(mockDevice);
			await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

			expect(mockMessageDispatcher.getDeviceStatus).toHaveBeenCalledTimes(1);
			await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * MQTT_REFRESH_INTERVAL_MULTIPLIER);

			expect(mockMessageDispatcher.getDeviceStatus).toHaveBeenCalledTimes(1);
		});

		it('should handle rapid activation/deactivation cycles', () => {
			for (let i = 0; i < 5; i++) {
				service.activateDeviceNotifyOverLocal(mockDevice);
				service.stopPolling();
			}

			expect(service['localIntervals'].size).toBe(0);
		});
	});
});
