import { AnsiLogger } from 'matterbridge/logger';
import { PollingService } from '../../services/pollingService.js';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import { Device, MessageProcessor } from '../../roborockCommunication/index.js';
import { LOCAL_REFRESH_INTERVAL_MULTIPLIER, MQTT_REFRESH_INTERVAL_MULTIPLIER } from '../../constants/index.js';
import { NotifyMessageTypes } from '../../notifyMessageTypes.js';

describe('PollingService', () => {
  let service: PollingService;
  let mockLogger: jest.Mocked<AnsiLogger>;
  let mockMessageRoutingService: jest.Mocked<MessageRoutingService>;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;
  const TEST_REFRESH_INTERVAL = 100;

  const mockDevice: Device = {
    duid: 'test-duid-123',
    name: 'Test Vacuum',
    localKey: 'test-local-key',
  } as Device;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockLogger = {
      debug: jest.fn(),
      notice: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    } as unknown as jest.Mocked<AnsiLogger>;

    mockMessageProcessor = {
      getDeviceStatus: jest.fn(),
      getDeviceStatusOverMQTT: jest.fn(),
    } as unknown as jest.Mocked<MessageProcessor>;

    mockMessageRoutingService = {
      getMessageProcessor: jest.fn().mockReturnValue(mockMessageProcessor),
      getCleanModeData: jest.fn(),
      getRoomIdFromMap: jest.fn(),
      changeCleanMode: jest.fn(),
      startClean: jest.fn(),
      pauseClean: jest.fn(),
      stopAndGoHome: jest.fn(),
      resumeClean: jest.fn(),
      playSoundToLocate: jest.fn(),
      customGet: jest.fn(),
      customSend: jest.fn(),
      registerMessageProcessor: jest.fn(),
      setMqttAlwaysOn: jest.fn(),
      getMqttAlwaysOn: jest.fn(),
      setIotApi: jest.fn(),
      clearAll: jest.fn(),
    } as any;

    service = new PollingService(TEST_REFRESH_INTERVAL, mockLogger, mockMessageRoutingService);
  });

  afterEach(() => {
    service.stopPolling();
    jest.useRealTimers();
  });

  describe('setDeviceNotify', () => {
    it('should set the device notification callback', () => {
      const mockCallback = jest.fn();
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
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      expect(mockLogger.debug).toHaveBeenCalledWith('Activating device status polling for:', mockDevice.duid);
      expect(service['localRequestDeviceStatusInterval']).toBeDefined();
    });

    it('should clear existing interval before creating new one', () => {
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);
      const firstInterval = service['localRequestDeviceStatusInterval'];

      service.activateDeviceNotifyOverLocal(mockDevice);
      const secondInterval = service['localRequestDeviceStatusInterval'];

      expect(firstInterval).not.toBe(secondInterval);
    });

    it('should poll device status at correct intervals', async () => {
      const mockCallback = jest.fn();
      const mockResponse = {
        errorStatus: { error: 0 },
        message: { state: 8, battery: 100 },
      };
      mockMessageProcessor.getDeviceStatus.mockResolvedValue(mockResponse as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockMessageProcessor.getDeviceStatus).toHaveBeenCalledWith(mockDevice.duid);
      expect(mockCallback).toHaveBeenCalledWith(NotifyMessageTypes.LocalMessage, {
        duid: mockDevice.duid,
        error: 0,
        state: 8,
        battery: 100,
      });
    });

    it('should handle multiple polling cycles', async () => {
      const mockCallback = jest.fn();
      const mockResponse = {
        errorStatus: { error: 0 },
        message: { state: 8 },
      };
      mockMessageProcessor.getDeviceStatus.mockResolvedValue(mockResponse as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      for (let i = 0; i < 3; i++) {
        await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);
      }

      expect(mockMessageProcessor.getDeviceStatus).toHaveBeenCalledTimes(3);
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });

    it('should log error when message processor is not found', async () => {
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);
      mockMessageRoutingService.getMessageProcessor.mockReturnValue(undefined as any);

      service.activateDeviceNotifyOverLocal(mockDevice);

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockLogger.error).toHaveBeenCalledWith('Local Polling - No message processor for device:', mockDevice.duid);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle getDeviceStatus errors gracefully', async () => {
      const mockCallback = jest.fn();
      const testError = new Error('Network timeout');
      mockMessageProcessor.getDeviceStatus.mockRejectedValue(testError);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get device status:', testError);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle null/undefined response from getDeviceStatus', async () => {
      const mockCallback = jest.fn();
      mockMessageProcessor.getDeviceStatus.mockResolvedValue(null as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('activateDeviceNotifyOverMQTT', () => {
    it('should warn and return early when deviceNotify callback is not set', () => {
      service.activateDeviceNotifyOverMQTT(mockDevice);

      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot activate device notify over MQTT: deviceNotify callback not set');
      expect(mockLogger.notice).not.toHaveBeenCalled();
    });

    it('should activate MQTT polling and start interval', () => {
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverMQTT(mockDevice);

      expect(mockLogger.notice).toHaveBeenCalledWith('Requesting device info for device over MQTT', mockDevice.duid);
      expect(service['mqttRequestDeviceStatusInterval']).toBeDefined();
    });

    it('should clear existing interval before creating new one', () => {
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverMQTT(mockDevice);
      const firstInterval = service['mqttRequestDeviceStatusInterval'];

      service.activateDeviceNotifyOverMQTT(mockDevice);
      const secondInterval = service['mqttRequestDeviceStatusInterval'];

      expect(firstInterval).not.toBe(secondInterval);
    });

    it('should poll device status over MQTT at correct intervals', async () => {
      const mockCallback = jest.fn();
      const mockResponse = {
        errorStatus: { error: 0 },
        message: { state: 5, battery: 85 },
      };
      mockMessageProcessor.getDeviceStatusOverMQTT.mockResolvedValue(mockResponse as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverMQTT(mockDevice);

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * MQTT_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockMessageProcessor.getDeviceStatusOverMQTT).toHaveBeenCalledWith(mockDevice.duid);
      expect(mockCallback).toHaveBeenCalledWith(NotifyMessageTypes.LocalMessage, {
        duid: mockDevice.duid,
        error: 0,
        state: 5,
        battery: 85,
      });
    });

    it('should handle multiple MQTT polling cycles', async () => {
      const mockCallback = jest.fn();
      const mockResponse = {
        errorStatus: { error: 0 },
        message: { state: 5 },
      };
      mockMessageProcessor.getDeviceStatusOverMQTT.mockResolvedValue(mockResponse as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverMQTT(mockDevice);

      for (let i = 0; i < 3; i++) {
        await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * MQTT_REFRESH_INTERVAL_MULTIPLIER);
      }

      expect(mockMessageProcessor.getDeviceStatusOverMQTT).toHaveBeenCalledTimes(3);
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });

    it('should log error when message processor is not found', async () => {
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);
      mockMessageRoutingService.getMessageProcessor.mockReturnValue(undefined as any);

      service.activateDeviceNotifyOverMQTT(mockDevice);

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * MQTT_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockLogger.error).toHaveBeenCalledWith('MQTT - No message processor for device:', mockDevice.duid);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle getDeviceStatusOverMQTT errors gracefully', async () => {
      const mockCallback = jest.fn();
      const testError = new Error('MQTT connection lost');
      mockMessageProcessor.getDeviceStatusOverMQTT.mockRejectedValue(testError);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverMQTT(mockDevice);

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * MQTT_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get device status over MQTT:', testError);
      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle null/undefined response from getDeviceStatusOverMQTT', async () => {
      const mockCallback = jest.fn();
      mockMessageProcessor.getDeviceStatusOverMQTT.mockResolvedValue(undefined as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverMQTT(mockDevice);

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * MQTT_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('stopPolling', () => {
    it('should clear the polling interval', () => {
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);
      service.activateDeviceNotifyOverLocal(mockDevice);

      expect(service['localRequestDeviceStatusInterval']).toBeDefined();

      service.stopPolling();

      expect(service['localRequestDeviceStatusInterval']).toBeUndefined();
      expect(service['mqttRequestDeviceStatusInterval']).toBeUndefined();
    });

    it('should handle calling stopPolling when no interval is active', () => {
      expect(() => service.stopPolling()).not.toThrow();
      expect(service['localRequestDeviceStatusInterval']).toBeUndefined();
      expect(service['mqttRequestDeviceStatusInterval']).toBeUndefined();
    });

    it('should prevent further polling after stopPolling is called', async () => {
      const mockCallback = jest.fn();
      mockMessageProcessor.getDeviceStatus.mockResolvedValue({
        errorStatus: { error: 0 },
        message: { state: 8 },
      } as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);
      service.stopPolling();

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER * 3);

      expect(mockMessageProcessor.getDeviceStatus).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should stop polling and clear deviceNotify callback', async () => {
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);
      service.activateDeviceNotifyOverLocal(mockDevice);

      await service.shutdown();

      expect(service['localRequestDeviceStatusInterval']).toBeUndefined();
      expect(service['mqttRequestDeviceStatusInterval']).toBeUndefined();
      expect(service['deviceNotify']).toBeUndefined();
    });

    it('should handle shutdown when nothing is active', async () => {
      await expect(service.shutdown()).resolves.not.toThrow();
    });

    it('should prevent polling after shutdown', async () => {
      const mockCallback = jest.fn();
      mockMessageProcessor.getDeviceStatus.mockResolvedValue({
        errorStatus: { error: 0 },
        message: { state: 8 },
      } as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);
      await service.shutdown();

      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER * 3);

      expect(mockMessageProcessor.getDeviceStatus).not.toHaveBeenCalled();
    });
  });

  describe('integration scenarios', () => {
    it('should switch from local to MQTT polling', async () => {
      const mockCallback = jest.fn();
      const localResponse = {
        errorStatus: { error: 0 },
        message: { state: 8 },
      };
      const mqttResponse = {
        errorStatus: { error: 0 },
        message: { state: 5 },
      };
      mockMessageProcessor.getDeviceStatus.mockResolvedValue(localResponse as never);
      mockMessageProcessor.getDeviceStatusOverMQTT.mockResolvedValue(mqttResponse as never);
      service.setDeviceNotify(mockCallback);

      service.activateDeviceNotifyOverLocal(mockDevice);
      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockMessageProcessor.getDeviceStatus).toHaveBeenCalledTimes(1);

      service.activateDeviceNotifyOverMQTT(mockDevice);
      await jest.advanceTimersByTimeAsync(TEST_REFRESH_INTERVAL * MQTT_REFRESH_INTERVAL_MULTIPLIER);

      expect(mockMessageProcessor.getDeviceStatusOverMQTT).toHaveBeenCalledTimes(1);
      expect(mockMessageProcessor.getDeviceStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle rapid activation/deactivation cycles', () => {
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);

      for (let i = 0; i < 5; i++) {
        service.activateDeviceNotifyOverLocal(mockDevice);
        service.stopPolling();
      }

      expect(service['localRequestDeviceStatusInterval']).toBeUndefined();
      expect(service['mqttRequestDeviceStatusInterval']).toBeUndefined();
    });
  });
});
