import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { PollingService } from '../../services/pollingService.js';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import { LOCAL_REFRESH_INTERVAL_MULTIPLIER, MQTT_REFRESH_INTERVAL_MULTIPLIER } from '../../constants/index.js';
import { NotifyMessageTypes } from '../../types/notifyMessageTypes.js';
import { MessageProcessor } from '../../roborockCommunication/mqtt/messageProcessor.js';
import { Device } from '../../roborockCommunication/models/index.js';
import { AbstractMessageDispatcher } from '../../roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.js';
import { createMockLogger, asPartial, asType } from '../helpers/testUtils.js';

describe('PollingService', () => {
  let service: PollingService;
  let mockLogger: AnsiLogger;
  let mockMessageRoutingService: MessageRoutingService;
  let mockMessageProcessor: MessageProcessor;
  let mockMessageDispatcher: AbstractMessageDispatcher;
  const TEST_REFRESH_INTERVAL = 100;

  const mockDevice: Device = {
    duid: 'test-duid-123',
    name: 'Test Vacuum',
    localKey: 'test-local-key',
  } as Device;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockLogger = createMockLogger();
    mockMessageProcessor = asPartial<MessageProcessor>({
      registerHandler: vi.fn(),
    });
    // logger is not a public member on MessageProcessor; assign on typed any for tests
    Object.defineProperty(mockMessageProcessor, 'logger', {
      value: mockLogger,
      writable: true,
    });

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
      getMessageProcessor: vi.fn().mockReturnValue(mockMessageProcessor),
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
      registerMessageProcessor: vi.fn(),
      setIotApi: vi.fn(),
      clearAll: vi.fn(),
    });
    service = new PollingService(TEST_REFRESH_INTERVAL, mockLogger, mockMessageRoutingService);
  });

  afterEach(() => {
    service.stopPolling();
    vi.useRealTimers();
  });

  describe('setDeviceNotify', () => {
    it('should set the device notification callback', () => {
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);
      expect(service['deviceNotify']).toBe(mockCallback);
    });
  });

  describe('activateDeviceNotifyOverLocal', () => {
    it('should warn and return early when deviceNotify callback is not set', () => {
      service.activateDeviceNotifyOverLocal(mockDevice);

      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot activate device notify over local: deviceNotify callback not set');
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should activate polling and start interval', () => {
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      expect(mockLogger.debug).toHaveBeenCalledWith('Activating device status polling for:', mockDevice.duid);
      expect(service['localRequestDeviceStatusInterval']).toBeDefined();
    });

    it('should clear existing interval before creating new one', () => {
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);
      const firstInterval = service['localRequestDeviceStatusInterval'];

      service.activateDeviceNotifyOverLocal(mockDevice);
      const secondInterval = service['localRequestDeviceStatusInterval'];

      expect(firstInterval).not.toBe(secondInterval);
    });

    it('should poll device status at correct intervals', async () => {
      const mockCallback = vi.fn();
      const mockResponse = {
        errorStatus: { error: 0 },
        message: { state: 8, battery: 100 },
      };
      mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue(mockResponse as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockMessageDispatcher.getDeviceStatus).toHaveBeenCalledWith(mockDevice.duid);
      expect(mockCallback).toHaveBeenCalledWith(NotifyMessageTypes.LocalMessage, {
        duid: mockDevice.duid,
        error: 0,
        state: 8,
        battery: 100,
      });
    });

    it('should handle multiple polling cycles', async () => {
      const mockCallback = vi.fn();
      const mockResponse = {
        errorStatus: { error: 0 },
        message: { state: 8 },
      };
      mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue(mockResponse as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);
      }

      expect(mockMessageDispatcher.getDeviceStatus).toHaveBeenCalledTimes(3);
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });

    it('should handle getDeviceStatus errors gracefully', async () => {
      const mockCallback = vi.fn();
      const testError = new Error('Network timeout');
      mockMessageDispatcher.getDeviceStatus = vi.fn().mockRejectedValue(testError);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get device status:', testError);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle null/undefined response from getDeviceStatus', async () => {
      const mockCallback = vi.fn();
      mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue(null as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('stopPolling', () => {
    it('should clear the polling interval', () => {
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);
      service.activateDeviceNotifyOverLocal(mockDevice);

      expect(service['localRequestDeviceStatusInterval']).toBeDefined();

      service.stopPolling();

      expect(service['localRequestDeviceStatusInterval']).toBeUndefined();
    });

    it('should handle calling stopPolling when no interval is active', () => {
      expect(() => {
        service.stopPolling();
      }).not.toThrow();
      expect(service['localRequestDeviceStatusInterval']).toBeUndefined();
    });

    it('should prevent further polling after stopPolling is called', async () => {
      const mockCallback = vi.fn();
      mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue({
        errorStatus: { error: 0 },
        message: { state: 8 },
      } as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);
      service.stopPolling();

      await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER * 3);

      expect(mockMessageDispatcher.getDeviceStatus).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should stop polling and clear deviceNotify callback', async () => {
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);
      service.activateDeviceNotifyOverLocal(mockDevice);

      await service.shutdown();

      expect(service['localRequestDeviceStatusInterval']).toBeUndefined();
      expect(service['deviceNotify']).toBeUndefined();
    });

    it('should handle shutdown when nothing is active', async () => {
      await expect(service.shutdown()).resolves.not.toThrow();
    });

    it('should prevent polling after shutdown', async () => {
      const mockCallback = vi.fn();
      mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue({
        errorStatus: { error: 0 },
        message: { state: 8 },
      } as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);
      await service.shutdown();

      await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER * 3);

      expect(mockMessageDispatcher.getDeviceStatus).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should switch from local to MQTT polling', async () => {
      const mockCallback = vi.fn();
      const localResponse = {
        errorStatus: { error: 0 },
        message: { state: 8 },
      };
      const mqttResponse = {
        errorStatus: { error: 0 },
        message: { state: 5 },
      };
      mockMessageDispatcher.getDeviceStatus = vi.fn().mockResolvedValue(localResponse as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);
      await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockMessageDispatcher.getDeviceStatus).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * MQTT_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockMessageDispatcher.getDeviceStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid activation/deactivation cycles', () => {
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);

      for (let i = 0; i < 5; i++) {
        service.activateDeviceNotifyOverLocal(mockDevice);
        service.stopPolling();
      }

      expect(service['localRequestDeviceStatusInterval']).toBeUndefined();
    });
  });
});
