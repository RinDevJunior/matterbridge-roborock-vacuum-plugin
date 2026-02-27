import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeviceStatusListener } from '../../../../roborockCommunication/routing/listeners/implementation/deviceStatusListener.js';
import { ResponseMessage } from '../../../../roborockCommunication/models/responseMessage.js';
import { ResponseBody } from '../../../../roborockCommunication/models/responseBody.js';
import { Protocol } from '../../../../roborockCommunication/models/protocol.js';
import type { AnsiLogger } from 'matterbridge/logger';

const makeMockLogger = (): AnsiLogger =>
  ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    notice: vi.fn(),
  }) as unknown as AnsiLogger;

const makeMessage = (protocol: Protocol, payload: unknown): ResponseMessage => {
  const header = { isForProtocol: (p: Protocol) => p === protocol } as never;
  const body = new ResponseBody({ [protocol.toString()]: payload as Record<string, unknown> });
  return new ResponseMessage('test-duid', header, body);
};

describe('DeviceStatusListener', () => {
  let logger: AnsiLogger;
  let listener: DeviceStatusListener;

  beforeEach(() => {
    logger = makeMockLogger();
    listener = new DeviceStatusListener('test-duid', logger);
  });

  it('should have name DeviceStatusListener', () => {
    expect(listener.name).toBe('DeviceStatusListener');
  });

  it('should ignore messages not for device_status_ota protocol', () => {
    const message = makeMessage(Protocol.rpc_response, {});
    listener.onMessage(message);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should ignore message when payload is null', () => {
    const message = makeMessage(Protocol.device_status_ota, null);
    listener.onMessage(message);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should ignore message when payload is undefined', () => {
    const header = { isForProtocol: (p: Protocol) => p === Protocol.device_status_ota } as never;
    const message = new ResponseMessage('test-duid', header, undefined);
    listener.onMessage(message);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should ignore message when payload is not an object', () => {
    const message = makeMessage(Protocol.device_status_ota, 'some string');
    listener.onMessage(message);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should log firmware update status when mqttOtaStatus is present', () => {
    const payload = { mqttOtaData: { mqttOtaStatus: { status: 'downloading' } } };
    const message = makeMessage(Protocol.device_status_ota, payload);
    listener.onMessage(message);
    expect(logger.info).toHaveBeenCalledWith('[test-duid] Firmware Update Status: downloading');
  });

  it('should log firmware update progress when mqttOtaProgress is present', () => {
    const payload = { mqttOtaData: { mqttOtaProgress: { progress: 42 } } };
    const message = makeMessage(Protocol.device_status_ota, payload);
    listener.onMessage(message);
    expect(logger.info).toHaveBeenCalledWith('[test-duid] Firmware Update Progress: 42%');
  });

  it('should log both status and progress when both are present', () => {
    const payload = {
      mqttOtaData: {
        mqttOtaStatus: { status: 'installing' },
        mqttOtaProgress: { progress: 100 },
      },
    };
    const message = makeMessage(Protocol.device_status_ota, payload);
    listener.onMessage(message);
    expect(logger.info).toHaveBeenCalledWith('[test-duid] Firmware Update Status: installing');
    expect(logger.info).toHaveBeenCalledWith('[test-duid] Firmware Update Progress: 100%');
  });

  it('should not log status when mqttOtaStatus.status is undefined', () => {
    const payload = { mqttOtaData: { mqttOtaStatus: {} } };
    const message = makeMessage(Protocol.device_status_ota, payload);
    listener.onMessage(message);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should not log progress when mqttOtaProgress.progress is undefined', () => {
    const payload = { mqttOtaData: { mqttOtaProgress: {} } };
    const message = makeMessage(Protocol.device_status_ota, payload);
    listener.onMessage(message);
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('should log device OFFLINE when online is false', () => {
    const payload = { online: false };
    const message = makeMessage(Protocol.device_status_ota, payload);
    listener.onMessage(message);
    expect(logger.info).toHaveBeenCalledWith('[test-duid] Device OFFLINE');
  });

  it('should log device ONLINE when online is true', () => {
    const payload = { online: true };
    const message = makeMessage(Protocol.device_status_ota, payload);
    listener.onMessage(message);
    expect(logger.info).toHaveBeenCalledWith('[test-duid] Device ONLINE');
  });

  it('should not log online/offline when payload has no online field and no mqttOtaData', () => {
    const payload = {};
    const message = makeMessage(Protocol.device_status_ota, payload);
    listener.onMessage(message);
    expect(logger.info).not.toHaveBeenCalled();
  });
});
