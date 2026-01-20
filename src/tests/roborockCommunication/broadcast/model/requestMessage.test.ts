import { RequestMessage, Protocol } from '../../../../roborockCommunication/index.js';
import { describe, it, expect } from 'vitest';

describe('RequestMessage', () => {
  it('constructor uses provided values', () => {
    const req = new RequestMessage({
      messageId: 1234,
      protocol: Protocol.rpc_request,
      method: 'testMethod',
      params: { key: 'value' },
      secure: true,
      nonce: 5678,
      timestamp: 9999,
    });

    expect(req.messageId).toBe(1234);
    expect(req.protocol).toBe(Protocol.rpc_request);
    expect(req.method).toBe('testMethod');
    expect(req.params).toEqual({ key: 'value' });
    expect(req.secure).toBe(true);
    expect(req.nonce).toBe(5678);
    expect(req.timestamp).toBe(9999);
  });

  it('constructor uses defaults when values not provided', () => {
    const req = new RequestMessage({});

    expect(typeof req.messageId).toBe('number');
    expect(req.messageId).toBeGreaterThan(0);
    expect(req.protocol).toBe(Protocol.rpc_request);
    expect(req.method).toBeUndefined();
    expect(req.params).toBeUndefined();
    expect(req.secure).toBe(false);
    expect(typeof req.nonce).toBe('number');
    expect(req.nonce).toBeGreaterThan(0);
    expect(typeof req.timestamp).toBe('number');
    expect(req.timestamp).toBeGreaterThan(0);
  });

  it('toMqttRequest returns new instance with same data', () => {
    const req = new RequestMessage({ method: 'test' });
    const mqttReq = req.toMqttRequest();
    expect(mqttReq).toBeInstanceOf(RequestMessage);
    expect(mqttReq.method).toBe(req.method);
    expect(mqttReq.messageId).toBe(req.messageId);
    expect(mqttReq.nonce).toBe(req.nonce);
    expect(mqttReq.timestamp).toBe(req.timestamp);
  });

  it('toLocalRequest converts rpc_request to general_request', () => {
    const req = new RequestMessage({
      messageId: 111,
      protocol: Protocol.rpc_request,
      method: 'myMethod',
      params: ['a', 'b'],
      secure: true,
      timestamp: 8888,
    });

    const local = req.toLocalRequest();
    expect(local).not.toBe(req);
    expect(local.messageId).toBe(111);
    expect(local.protocol).toBe(Protocol.general_request);
    expect(local.method).toBe('myMethod');
    expect(local.params).toEqual(['a', 'b']);
    expect(local.secure).toBe(true);
    expect(local.timestamp).toBe(8888);
  });

  it('toLocalRequest returns this for non-rpc protocols', () => {
    const req = new RequestMessage({
      protocol: Protocol.general_request,
      method: 'otherMethod',
    });

    const local = req.toLocalRequest();
    expect(local).toBe(req);
  });
});
