import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockDeviceGateway } from '../../../roborockCommunication/adapters/RoborockDeviceGateway.js';
import { ClientRouter } from '../../../roborockCommunication/routing/clientRouter.js';
import type { DeviceCommand, DeviceStatus, StatusCallback } from '../../../core/ports/IDeviceGateway.js';
import { Protocol, RequestMessage, ResponseMessage } from '../../../roborockCommunication/models/index.js';
import type { AbstractMessageListener } from '../../../roborockCommunication/routing/listeners/abstractMessageListener.js';
import { Security } from '../../../types/device.js';
import { HeaderMessage } from '../../../roborockCommunication/models/headerMessage.js';
import { ResponseBody } from '../../../roborockCommunication/models/responseBody.js';
import type { DpsPayload } from '../../../roborockCommunication/models/dps.js';
import { createMockLogger, makeMockClientRouter } from '../../helpers/testUtils.js';

describe('RoborockDeviceGateway', () => {
  let mockLogger: AnsiLogger;
  let mockClientRouter: ClientRouter;
  let gateway: RoborockDeviceGateway;
  let registeredListener: AbstractMessageListener;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockClientRouter = makeMockClientRouter();

    // Capture the registered message listener
    vi.mocked(mockClientRouter.registerMessageListener).mockImplementation((listener) => {
      registeredListener = listener;
    });

    gateway = new RoborockDeviceGateway(mockClientRouter, mockLogger);
  });

  describe('constructor', () => {
    it('should register a message listener on clientRouter', () => {
      expect(mockClientRouter.registerMessageListener).toHaveBeenCalledTimes(1);
      expect(registeredListener).toBeDefined();
    });

    it('should handle ResponseMessage with battery protocol by filtering it out', async () => {
      const header = new HeaderMessage('1.0', 1, 1000, Date.now(), Number(Protocol.battery));
      const mockResponseMessage = new ResponseMessage('device123', header);

      await registeredListener.onMessage(mockResponseMessage);

      expect(mockClientRouter.updateNonce).not.toHaveBeenCalled();
    });

    it('should handle ResponseMessage with hello_response protocol and update nonce', async () => {
      const mockNonce: DpsPayload = {
        id: 1,
        result: {
          nonce: 12345,
        } as Security,
      };

      const header = new HeaderMessage('1.0', 1, 1000, Date.now(), Number(Protocol.hello_response));
      const body = new ResponseBody({
        [Protocol.hello_response]: mockNonce,
      });
      const mockResponseMessage = new ResponseMessage('device123', header, body);

      await registeredListener.onMessage(mockResponseMessage);

      expect(mockClientRouter.updateNonce).toHaveBeenCalledWith('device123', 12345);
    });

    it('should notify status callbacks for non-filtered ResponseMessage', async () => {
      const statusCallback = vi.fn();
      gateway.subscribe('device123', statusCallback);

      const header = new HeaderMessage('1.0', 1, 1000, Date.now(), 101);
      const mockResponseMessage = new ResponseMessage('device123', header);

      await registeredListener.onMessage(mockResponseMessage);

      expect(statusCallback).toHaveBeenCalledWith(mockResponseMessage);
    });

    it('should not process ResponseMessage without duid', async () => {
      const header = new HeaderMessage('1.0', 1, 1000, Date.now(), 101);
      const mockResponseMessage = new ResponseMessage('', header);

      await registeredListener.onMessage(mockResponseMessage);

      expect(mockClientRouter.updateNonce).not.toHaveBeenCalled();
    });

    it('should ignore non-ResponseMessage messages', async () => {
      const mockMessage = new ResponseMessage('device123', new HeaderMessage('1.0', 1, 1000, Date.now(), Protocol.error));

      await registeredListener.onMessage(mockMessage);

      expect(mockClientRouter.updateNonce).not.toHaveBeenCalled();
    });
  });

  describe('sendCommand', () => {
    it('should send command to device via clientRouter', async () => {
      const command: DeviceCommand = {
        method: 'app_start',
        params: [],
      };

      await gateway.sendCommand('device123', command);

      expect(mockClientRouter.send).toHaveBeenCalledTimes(1);
      const [duid, request] = vi.mocked(mockClientRouter.send).mock.calls[0];
      expect(duid).toBe('device123');
      expect(request).toBeInstanceOf(RequestMessage);
      expect(request.method).toBe('app_start');
      expect(request.params).toEqual([]);
      expect(request.secure).toBe(false);
    });

    it('should log debug message after sending command', async () => {
      const command: DeviceCommand = {
        method: 'app_stop',
        params: [],
      };

      await gateway.sendCommand('device456', command);

      expect(mockLogger.debug).toHaveBeenCalledWith('Sent command app_stop to device device456');
    });

    it('should send command with params', async () => {
      const command: DeviceCommand = {
        method: 'app_segment_clean',
        params: [{ segments: [1, 2, 3] }],
      };

      await gateway.sendCommand('device789', command);

      const [, request] = vi.mocked(mockClientRouter.send).mock.calls[0];
      expect(request.params).toEqual([{ segments: [1, 2, 3] }]);
    });
  });

  describe('getStatus', () => {
    it('should get status from device via clientRouter', async () => {
      const mockStatus: DeviceStatus = {
        state: 'charging',
        battery: 95,
      };

      vi.mocked(mockClientRouter.get).mockResolvedValue(mockStatus);

      const result = await gateway.getStatus('device123');

      expect(mockClientRouter.get).toHaveBeenCalledTimes(1);
      const [duid, request] = vi.mocked(mockClientRouter.get).mock.calls[0];
      expect(duid).toBe('device123');
      expect(request).toBeInstanceOf(RequestMessage);
      expect(request.method).toBe('get_status');
      expect(request.params).toEqual([]);
      expect(request.secure).toBe(false);
      expect(result).toEqual(mockStatus);
    });

    it('should throw error when response is undefined', async () => {
      vi.mocked(mockClientRouter.get).mockResolvedValue(undefined);

      await expect(gateway.getStatus('device123')).rejects.toThrow('Failed to get status for device device123');
    });

    it('should return status with custom properties', async () => {
      const mockStatus: DeviceStatus = {
        state: 'docked',
        battery: 100,
        fan_power: 50,
        clean_area: 1500000,
      };

      vi.mocked(mockClientRouter.get).mockResolvedValue(mockStatus);

      const result = await gateway.getStatus('device999');

      expect(result).toEqual(mockStatus);
      expect(result.fan_power).toBe(50);
      expect(result.clean_area).toBe(1500000);
    });
  });

  describe('subscribe', () => {
    it('should add callback to statusCallbacks and return unsubscribe function', () => {
      const callback: StatusCallback = vi.fn();

      const unsubscribe = gateway.subscribe('device123', callback);

      expect(unsubscribe).toBeInstanceOf(Function);
    });

    it('should notify callback when status update is received', async () => {
      const callback: StatusCallback = vi.fn();
      gateway.subscribe('device123', callback);

      const header = new HeaderMessage('1.0', 1, 1000, Date.now(), 101);
      const mockResponseMessage = new ResponseMessage('device123', header);

      await registeredListener.onMessage(mockResponseMessage);

      expect(callback).toHaveBeenCalledWith(mockResponseMessage);
    });

    it('should support multiple callbacks for the same device', async () => {
      const callback1: StatusCallback = vi.fn();
      const callback2: StatusCallback = vi.fn();

      gateway.subscribe('device123', callback1);
      gateway.subscribe('device123', callback2);

      const header = new HeaderMessage('1.0', 1, 1000, Date.now(), 101);
      const mockResponseMessage = new ResponseMessage('device123', header);

      await registeredListener.onMessage(mockResponseMessage);

      expect(callback1).toHaveBeenCalledWith(mockResponseMessage);
      expect(callback2).toHaveBeenCalledWith(mockResponseMessage);
    });

    it('should support callbacks for different devices', async () => {
      const callback1: StatusCallback = vi.fn();
      const callback2: StatusCallback = vi.fn();

      gateway.subscribe('device123', callback1);
      gateway.subscribe('device456', callback2);

      const header1 = new HeaderMessage('1.0', 1, 1000, Date.now(), 101);
      const mockResponseMessage1 = new ResponseMessage('device123', header1);

      const header2 = new HeaderMessage('1.0', 2, 1001, Date.now(), 101);
      const mockResponseMessage2 = new ResponseMessage('device456', header2);

      await registeredListener.onMessage(mockResponseMessage1);
      await registeredListener.onMessage(mockResponseMessage2);

      expect(callback1).toHaveBeenCalledWith(mockResponseMessage1);
      expect(callback1).not.toHaveBeenCalledWith(mockResponseMessage2);
      expect(callback2).toHaveBeenCalledWith(mockResponseMessage2);
      expect(callback2).not.toHaveBeenCalledWith(mockResponseMessage1);
    });

    it('should remove callback when unsubscribe is called', async () => {
      const callback: StatusCallback = vi.fn();
      const unsubscribe = gateway.subscribe('device123', callback);

      unsubscribe();

      const header = new HeaderMessage('1.0', 1, 1000, Date.now(), 101);
      const mockResponseMessage = new ResponseMessage('device123', header);

      await registeredListener.onMessage(mockResponseMessage);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should clean up statusCallbacks when last callback is removed', async () => {
      const callback1: StatusCallback = vi.fn();
      const callback2: StatusCallback = vi.fn();

      const unsubscribe1 = gateway.subscribe('device123', callback1);
      const unsubscribe2 = gateway.subscribe('device123', callback2);

      unsubscribe1();
      unsubscribe2();

      const header = new HeaderMessage('1.0', 1, 1000, Date.now(), 101);
      const mockResponseMessage = new ResponseMessage('device123', header);

      await registeredListener.onMessage(mockResponseMessage);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should handle unsubscribe when device has no callbacks', () => {
      const callback: StatusCallback = vi.fn();
      const unsubscribe = gateway.subscribe('device123', callback);

      unsubscribe();
      unsubscribe(); // Call again - should not throw

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle errors in status callbacks gracefully', async () => {
      const errorCallback: StatusCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const normalCallback: StatusCallback = vi.fn();

      gateway.subscribe('device123', errorCallback);
      gateway.subscribe('device123', normalCallback);

      const header = new HeaderMessage('1.0', 1, 1000, Date.now(), 101);
      const mockResponseMessage = new ResponseMessage('device123', header);

      await registeredListener.onMessage(mockResponseMessage);

      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Error in status callback for device device123:', expect.any(Error));
    });
  });
});
