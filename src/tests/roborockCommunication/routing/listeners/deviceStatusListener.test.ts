import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeviceStatusListener } from '../../../../roborockCommunication/routing/listeners/implementation/deviceStatusListener.js';
import { ResponseMessage } from '../../../../roborockCommunication/models/responseMessage.js';
import { ResponseBody } from '../../../../roborockCommunication/models/responseBody.js';
import { Protocol } from '../../../../roborockCommunication/models/protocol.js';
import { createMockLogger } from '../../../helpers/testUtils.js';
import type { Dps } from '../../../../roborockCommunication/models/dps.js';

function createMockMessage(protocol: Protocol, payload: Record<string, unknown>): ResponseMessage {
  const header = { isForProtocol: (p: Protocol) => p === protocol } satisfies { isForProtocol: (p: Protocol) => boolean };
  const body = new ResponseBody({ [protocol.toString()]: payload } satisfies Dps);
  return new ResponseMessage('test-duid', header as never, body);
}

describe('DeviceStatusListener', () => {
  let logger: ReturnType<typeof createMockLogger>;
  let listener: DeviceStatusListener;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
    listener = new DeviceStatusListener('test-duid', logger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should have name DeviceStatusListener', () => {
    expect(listener.name).toBe('DeviceStatusListener');
  });

  describe('onMessage', () => {
    it('should ignore messages not for device_status_ota protocol', () => {
      const header = { isForProtocol: (_p: Protocol) => false } satisfies { isForProtocol: (p: Protocol) => boolean };
      const message = new ResponseMessage('test-duid', header as never, undefined);
      listener.onMessage(message);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should ignore message when body is undefined', () => {
      const header = { isForProtocol: (p: Protocol) => p === Protocol.device_status_ota } satisfies { isForProtocol: (p: Protocol) => boolean };
      const message = new ResponseMessage('test-duid', header as never, undefined);
      listener.onMessage(message);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should ignore message when payload is a string', () => {
      const header = { isForProtocol: (p: Protocol) => p === Protocol.device_status_ota } satisfies { isForProtocol: (p: Protocol) => boolean };
      const body = new ResponseBody({ [Protocol.device_status_ota.toString()]: 'invalid' } satisfies Dps);
      const message = new ResponseMessage('test-duid', header as never, body);
      listener.onMessage(message);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should log firmware update status when mqttOtaStatus is present', () => {
      const message = createMockMessage(Protocol.device_status_ota, {
        mqttOtaData: { mqttOtaStatus: { status: 'downloading' } },
      });
      listener.onMessage(message);
      expect(logger.info).toHaveBeenCalledWith('[test-duid] Firmware Update Status: downloading');
    });

    it('should log firmware update progress when mqttOtaProgress is present', () => {
      const message = createMockMessage(Protocol.device_status_ota, {
        mqttOtaData: { mqttOtaProgress: { progress: 42 } },
      });
      listener.onMessage(message);
      expect(logger.info).toHaveBeenCalledWith('[test-duid] Firmware Update Progress: 42%');
    });

    it('should log both status and progress when both are present', () => {
      const message = createMockMessage(Protocol.device_status_ota, {
        mqttOtaData: {
          mqttOtaStatus: { status: 'installing' },
          mqttOtaProgress: { progress: 100 },
        },
      });
      listener.onMessage(message);
      expect(logger.info).toHaveBeenCalledWith('[test-duid] Firmware Update Status: installing');
      expect(logger.info).toHaveBeenCalledWith('[test-duid] Firmware Update Progress: 100%');
    });

    it('should not log status when mqttOtaStatus.status is undefined', () => {
      const message = createMockMessage(Protocol.device_status_ota, { mqttOtaData: { mqttOtaStatus: {} } });
      listener.onMessage(message);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should not log progress when mqttOtaProgress.progress is undefined', () => {
      const message = createMockMessage(Protocol.device_status_ota, { mqttOtaData: { mqttOtaProgress: {} } });
      listener.onMessage(message);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should log device OFFLINE when online is false', () => {
      const message = createMockMessage(Protocol.device_status_ota, { online: false });
      listener.onMessage(message);
      expect(logger.info).toHaveBeenCalledWith('[test-duid] Device OFFLINE');
    });

    it('should log device ONLINE when online is true', () => {
      const message = createMockMessage(Protocol.device_status_ota, { online: true });
      listener.onMessage(message);
      expect(logger.info).toHaveBeenCalledWith('[test-duid] Device ONLINE');
    });

    it('should not log when payload has no online field and no mqttOtaData', () => {
      const message = createMockMessage(Protocol.device_status_ota, {});
      listener.onMessage(message);
      expect(logger.info).not.toHaveBeenCalled();
    });
  });
});
