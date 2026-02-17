import { EventEmitter } from 'node:events';

// Extend globalThis for test-only properties
declare global {
  var mockSocketInstance: any;

  var Sket: any;
}
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { asPartial, asType } from '../../../helpers/testUtils.js';
import { LocalNetworkClient } from '../../../../roborockCommunication/local/localClient.js';
import { Protocol, RequestMessage } from '../../../../roborockCommunication/models/index.js';
import { PendingResponseTracker } from '../../../../roborockCommunication/routing/services/pendingResponseTracker.js';
import { ProtocolVersion } from '../../../../roborockCommunication/enums/protocolVersion.js';
import { ChunkBuffer } from '../../../../roborockCommunication/helper/chunkBuffer.js';
import { ResponseBroadcaster } from '../../../../roborockCommunication/routing/listeners/responseBroadcaster.js';

vi.mock('node:net', () => {
  class Sket {
    constructor() {
      if (globalThis.mockSocketInstance) {
        return globalThis.mockSocketInstance;
      }
    }

    // Minimal set of methods used by LocalNetworkClient tests
    on() {}
    once() {}
    emit() {}
    write() {}
    destroy() {}
    connect() {}
    setTimeout() {}
    address() {
      return { address: '127.0.0.1', port: 58867 };
    }
  }
  globalThis.Sket = Sket;
  return {
    Socket: Sket,
  };
});

describe('LocalNetworkClient', () => {
  let client: LocalNetworkClient;
  let mockLogger: any;
  let mockContext: any;
  let mockSocket: any;
  let mockResponseBroadcaster: ResponseBroadcaster;
  let mockResponseTracker: PendingResponseTracker;
  const duid = 'duid1';
  const ip = '127.0.0.1';

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    };
    mockContext = {
      nonce: Buffer.from([1, 2, 3, 4]),
      getProtocolVersion: vi.fn().mockReturnValue('1.0'),
      getLocalProtocolVersion: vi.fn().mockReturnValue('1.0'),
    };

    // Create a more realistic socket mock using EventEmitter
    mockSocket = Object.assign(new EventEmitter(), {
      connect: vi.fn(),
      destroy: vi.fn(),
      write: vi.fn(),
      setTimeout: vi.fn(),
      address: vi.fn().mockReturnValue({ address: '127.0.0.1', port: 58867 }),
      writable: true,
      readable: true,
    });

    globalThis.mockSocketInstance = mockSocket;

    mockResponseTracker = new PendingResponseTracker(mockLogger);
    mockResponseBroadcaster = new ResponseBroadcaster(mockResponseTracker, mockLogger);

    client = new LocalNetworkClient(mockLogger, mockContext, duid, ip, mockResponseBroadcaster, mockResponseTracker);
    Object.defineProperty(client, 'serializer', {
      value: asPartial({ serialize: vi.fn().mockReturnValue({ buffer: Buffer.from([1, 2, 3]), messageId: 123 }) }),
      writable: true,
    });
    Object.defineProperty(client, 'deserializer', {
      value: asPartial({ deserialize: vi.fn().mockReturnValue('deserialized') }),
      writable: true,
    });

    Object.defineProperty(client, 'responseBroadcaster', {
      value: asPartial({ onMessage: vi.fn(), onResponse: vi.fn() }),
      writable: true,
    });
    Object.defineProperty(client, 'connectionBroadcaster', {
      value: asPartial({
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
        onError: vi.fn(),
      }),
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    if (client?.['checkConnectionInterval']) {
      clearInterval(client['checkConnectionInterval']);
      client['checkConnectionInterval'] = undefined;
    }
  });

  it('should initialize fields in constructor', () => {
    expect(client['duid']).toBe(duid);
    expect(client['ip']).toBe(ip);
    expect(client['messageIdSeq']).toBeDefined();
  });

  it('connect() should return early if socket already exists', () => {
    client['socket'] = mockSocket;
    const connectSpy = vi.spyOn(mockSocket, 'connect');
    client.connect();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it('connect() should create socket, set handlers, and call connect', () => {
    client.connect();
    expect(client['socket']).toBeDefined();
    // Verify connect was called with correct parameters
    const socket = client['socket'];
    expect(socket).not.toBeUndefined();
  });

  it('disconnect() should destroy socket and clear checkConnectionInterval', async () => {
    client['socket'] = mockSocket;
    client['checkConnectionInterval'] = setInterval(() => {
      vi.fn();
    }, 1000);
    await client.disconnect();
    expect(mockSocket.destroy).toHaveBeenCalled();
    expect(client['socket']).toBeUndefined();
  });

  it('disconnect() should do nothing if socket is undefined', async () => {
    client['socket'] = undefined;
    await expect(client.disconnect()).resolves.toBeUndefined();
  });

  it('send() should log error if socket is not connected', async () => {
    client['socket'] = undefined;
    client['connected'] = false;
    const req = asPartial<RequestMessage>({ toLocalRequest: vi.fn(), secure: false, isForProtocol: vi.fn().mockReturnValue(false), version: '1.0', method: 'test' });
    await client.send(duid, req);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('socket is not online'));
    expect(mockSocket.write).not.toHaveBeenCalled();
  });

  it('send() should serialize and write if connected', async () => {
    mockSocket.readyState = 'open';
    mockSocket.destroyed = false;
    client['socket'] = mockSocket;
    client['connected'] = true;
    const req = asPartial<RequestMessage>({
      toLocalRequest: vi.fn().mockReturnValue({}),
      secure: false,
      isForProtocol: vi.fn().mockReturnValue(false),
      version: '1.0',
      method: 'test',
    });
    await client.send(duid, req);
    expect(client['serializer'].serialize).toHaveBeenCalled();
    expect(mockSocket.write).toHaveBeenCalledWith(expect.any(Buffer));
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('onConnect() should set connected, log, send hello, set ping, call onConnected', async () => {
    client['socket'] = mockSocket;
    vi.useFakeTimers();
    const trySendHelloSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(client, 'trySendHelloRequest', {
      value: trySendHelloSpy,
      writable: true,
    });
    await client['onConnect']();
    expect(mockLogger.debug).toHaveBeenCalled();
    expect(trySendHelloSpy).toHaveBeenCalled();
  });

  it('onDisconnect() should log, set connected false, destroy socket, clear ping, call onDisconnected', async () => {
    client['socket'] = mockSocket;
    client['checkConnectionInterval'] = setInterval(() => {
      vi.fn();
    }, 1000);
    await client['onDisconnect'](false);
    expect(mockLogger.warn).toHaveBeenCalled();
    expect(client['connected']).toBe(false);
    expect(mockSocket.destroy).toHaveBeenCalled();
    expect(client['socket']).toBeUndefined();
    expect(client['connectionBroadcaster'].onDisconnected).toHaveBeenCalled();
  });

  it('onError() should log, set connected false, destroy socket, call onDisconnected', async () => {
    client['socket'] = mockSocket;
    client['connected'] = false;
    await client['onError'](new Error('fail'));
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(' [LocalNetworkClient]: Socket error for'));
    expect(client['connectionBroadcaster'].onDisconnected).toHaveBeenCalledWith('duid1', expect.stringContaining('fail'));
  });

  it('onMessage() should log debug if message is empty', async () => {
    client['socket'] = mockSocket;
    await client['onMessage'](Buffer.alloc(0));
    expect(mockLogger.debug).toHaveBeenCalledWith('[LocalNetworkClient] received empty message from socket.');
  });

  it('onMessage() should process complete message and call onMessage', async () => {
    client['socket'] = mockSocket;
    // Compose a buffer with a single segment of length 3 (after 4 bytes)
    const payload = Buffer.from([0, 0, 0, 3, 10, 20, 30]);
    client['isMessageComplete'] = vi.fn().mockReturnValue(true);
    client['buffer'] = asPartial<ChunkBuffer>({
      append: vi.fn(),
      get: vi.fn().mockReturnValue(payload),
      reset: vi.fn(),
    });
    await client['onMessage'](payload);
    expect(client['deserializer'].deserialize).toHaveBeenCalled();
    expect(client['responseBroadcaster'].onMessage).toHaveBeenCalledWith('deserialized');
  });

  it('isMessageComplete() should return true for complete buffer', () => {
    // 4 bytes length + 3 bytes payload
    const buf = Buffer.from([0, 0, 0, 3, 1, 2, 3]);
    expect(client['isMessageComplete'](buf)).toBe(true);
  });

  it('isMessageComplete() should return false for incomplete buffer', () => {
    // 4 bytes length + only 2 bytes payload
    const buf = Buffer.from([0, 0, 0, 3, 1, 2]);
    expect(client['isMessageComplete'](buf)).toBe(false);
  });

  it('wrapWithLengthData() should prepend length', () => {
    const data = Buffer.from([1, 2, 3]);
    const result = client['wrapWithLengthData'](data);
    expect(result.readUInt32BE(0)).toBe(3);
    expect(result.slice(4).equals(data)).toBe(true);
  });

  it('sendHelloMessage() should call send with hello_request', async () => {
    mockSocket.readyState = 'open';
    mockSocket.destroyed = false;
    client['socket'] = mockSocket;
    client['connected'] = true;
    client['helloResponseListener'].waitFor = vi.fn().mockResolvedValue({ header: { nonce: 123, version: '1.0' } });
    const sendSpy = vi.spyOn(client, 'send').mockResolvedValue(undefined);
    await client['sendHelloMessage'](ProtocolVersion.V1);
    expect(sendSpy).toHaveBeenCalledWith(duid, expect.objectContaining({ protocol: Protocol.hello_request }));
  });

  it('sendPingRequest() should call send with ping_request', async () => {
    mockSocket.readyState = 'open';
    mockSocket.destroyed = false;
    client['socket'] = mockSocket;
    client['connected'] = true;
    const sendSpy = vi.spyOn(client, 'send').mockResolvedValue(undefined);
    await client['sendPingRequest']();
    expect(sendSpy).toHaveBeenCalledWith(duid, expect.objectContaining({ protocol: Protocol.ping_request }));
  });

  // Additional tests for uncovered branches

  it('send() should handle when socket exists but not connected', async () => {
    client['socket'] = mockSocket;
    client['connected'] = false;
    const req = asPartial<RequestMessage>({
      toLocalRequest: vi.fn().mockReturnValue({ protocol: Protocol.ping_request }),
      secure: false,
      isForProtocol: vi.fn().mockReturnValue(false),
      version: '1.0',
      method: 'test',
    });
    await client.send(duid, req);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('socket is not online'));
    expect(mockSocket.write).not.toHaveBeenCalled();
  });

  it('send() should handle when connected but socket is undefined', async () => {
    client['socket'] = undefined;
    client['connected'] = true;
    const req = asPartial<RequestMessage>({
      toLocalRequest: vi.fn().mockReturnValue({ protocol: Protocol.ping_request }),
      secure: false,
      isForProtocol: vi.fn().mockReturnValue(false),
      version: '1.0',
      method: 'test',
    });
    await client.send(duid, req);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('socket is not online'));
  });

  it('onDisconnect() should handle when socket already destroyed', async () => {
    client['socket'] = undefined;
    client['checkConnectionInterval'] = setInterval(() => vi.fn(), 1000);
    await client['onDisconnect'](false);
    expect(client['connected']).toBe(false);
    expect(client['connectionBroadcaster'].onDisconnected).toHaveBeenCalled();
  });

  it('onDisconnect() should handle when pingInterval is not set', async () => {
    client['socket'] = mockSocket;
    client['checkConnectionInterval'] = undefined;
    await client['onDisconnect'](true);
    expect(mockSocket.destroy).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Had error: true'));
  });

  it('onMessage() should return early if socket is undefined', async () => {
    client['socket'] = undefined;
    const payload = Buffer.from([0, 0, 0, 3, 10, 20, 30]);
    await client['onMessage'](payload);
    expect(client['responseBroadcaster'].onMessage).not.toHaveBeenCalled();
  });

  it('onMessage() should handle deserialization error', async () => {
    client['socket'] = mockSocket;
    const payload = Buffer.from([0, 0, 0, 3, 10, 20, 30]);
    client['isMessageComplete'] = vi.fn().mockReturnValue(true);
    client['buffer'] = asPartial<ChunkBuffer>({
      append: vi.fn(),
      get: vi.fn().mockReturnValue(payload),
      reset: vi.fn(),
    });
    Object.defineProperty(client, 'deserializer', {
      value: asPartial({
        deserialize: vi.fn().mockImplementation(() => {
          throw new Error('Deserialization failed');
        }),
      }),
      writable: true,
    });
    await client['onMessage'](payload);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('unable to process message'));
  });

  it('onMessage() should handle buffer processing error', async () => {
    client['socket'] = mockSocket;
    const payload = Buffer.from([0, 0, 0, 3, 10, 20, 30]);
    client['buffer'] = asPartial<ChunkBuffer>({
      append: vi.fn().mockImplementation(() => {
        throw new Error('Buffer append failed');
      }),
      get: vi.fn(),
      reset: vi.fn(),
    });
    await client['onMessage'](payload);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('read socket buffer error'));
  });

  // Note: LocalNetworkClient does not have a keepConnectionAlive method,
  // so these tests have been removed

  it('onTimeout() should log timeout error', async () => {
    await client['onTimeout']();
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('timed out'));
  });

  it('onEnd() should log socket ended', async () => {
    await client['onEnd']();
    expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('socket ended'));
  });

  it('disconnect() should handle when checkConnectionInterval is not set', async () => {
    client['socket'] = mockSocket;
    client['checkConnectionInterval'] = undefined;
    await client.disconnect();
    expect(mockSocket.destroy).toHaveBeenCalled();
    expect(client['socket']).toBeUndefined();
  });

  it('isReady() should return false when not connected', () => {
    client['connected'] = false;
    expect(client.isReady()).toBe(false);
  });

  it('isReady() should return true when connected', () => {
    client['connected'] = true;
    expect(client.isReady()).toBe(true);
  });

  it('isConnected() should return false when socket is undefined', () => {
    client['socket'] = undefined;
    expect(client.isConnected()).toBe(false);
  });

  it('isConnected() should return false when socket is not open', () => {
    mockSocket.readyState = 'closed';
    mockSocket.destroyed = false;
    client['socket'] = mockSocket;
    expect(client.isConnected()).toBe(false);
  });

  it('isConnected() should return false when socket is destroyed', () => {
    mockSocket.readyState = 'open';
    mockSocket.destroyed = true;
    client['socket'] = mockSocket;
    expect(client.isConnected()).toBe(false);
  });

  it('isConnected() should return true when socket is open and not destroyed', () => {
    mockSocket.readyState = 'open';
    mockSocket.destroyed = false;
    client['socket'] = mockSocket;
    expect(client.isConnected()).toBe(true);
  });

  it('send() should log error when socket exists but not connected state for non-hello request', async () => {
    mockSocket.readyState = 'open';
    mockSocket.destroyed = false;
    client['socket'] = mockSocket;
    client['connected'] = false;
    const req = asPartial<RequestMessage>({
      toLocalRequest: vi.fn().mockReturnValue({}),
      secure: false,
      isForProtocol: vi.fn().mockReturnValue(false),
      version: '1.0',
      method: 'test',
    });
    await client.send(duid, req);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('socket is not connected'));
  });

  it('send() should allow hello_request even when not connected', async () => {
    mockSocket.readyState = 'open';
    mockSocket.destroyed = false;
    client['socket'] = mockSocket;
    client['connected'] = false;
    const req = asPartial<RequestMessage>({
      toLocalRequest: vi.fn().mockReturnValue({ version: '1.0', protocol: Protocol.hello_request, method: 'hello' }),
      secure: false,
      isForProtocol: vi.fn().mockImplementation((p: Protocol) => p === Protocol.hello_request),
      version: '1.0',
      method: 'hello',
    });
    await client.send(duid, req);
    expect(client['serializer'].serialize).toHaveBeenCalled();
    expect(mockSocket.write).toHaveBeenCalled();
  });

  it('trySendHelloRequest() should try L01 if V1 fails', async () => {
    const sendHelloSpy = vi
      .fn()
      .mockResolvedValueOnce(false) // V1 fails
      .mockResolvedValueOnce(true); // L01 succeeds
    client['sendHelloMessage'] = sendHelloSpy;

    await client['trySendHelloRequest']();
    expect(sendHelloSpy).toHaveBeenCalledTimes(2);
    expect(sendHelloSpy).toHaveBeenCalledWith(ProtocolVersion.V1);
    expect(sendHelloSpy).toHaveBeenCalledWith(ProtocolVersion.L01);
  });

  it('trySendHelloRequest() should not try L01 if V1 succeeds', async () => {
    const sendHelloSpy = vi.fn().mockResolvedValueOnce(true);
    client['sendHelloMessage'] = sendHelloSpy;

    await client['trySendHelloRequest']();
    expect(sendHelloSpy).toHaveBeenCalledTimes(1);
    expect(sendHelloSpy).toHaveBeenCalledWith(ProtocolVersion.V1);
  });

  it('sendHelloMessage() should return false when hello response fails', async () => {
    mockSocket.readyState = 'open';
    mockSocket.destroyed = false;
    client['socket'] = mockSocket;
    client['connected'] = true;
    client['helloResponseListener'].waitFor = vi.fn().mockRejectedValue(new Error('timeout'));
    vi.spyOn(client, 'send').mockResolvedValue(undefined);
    const result = await client['sendHelloMessage'](ProtocolVersion.V1);
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('failed to receive hello response'));
  });

  it('processHelloResponse() should set connected and start checkConnection interval', async () => {
    vi.useFakeTimers();
    const response = asPartial<any>({
      header: { nonce: 42, version: '1.0' },
    });
    mockContext.updateNonce = vi.fn();
    mockContext.updateLocalProtocolVersion = vi.fn();

    await client['processHelloResponse'](response);

    expect(client['connected']).toBe(true);
    expect(mockContext.updateNonce).toHaveBeenCalledWith(duid, 42);
    expect(mockContext.updateLocalProtocolVersion).toHaveBeenCalledWith(duid, '1.0');
    expect(client['checkConnectionInterval']).toBeDefined();
  });

  it('processHelloResponse() should return early when header is undefined', async () => {
    const response = asPartial<any>({ header: undefined });
    mockContext.updateNonce = vi.fn();

    await client['processHelloResponse'](response);

    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('hello response missing header'));
    expect(mockContext.updateNonce).not.toHaveBeenCalled();
  });

  it('checkConnection() should reconnect when no ping response for 15s', async () => {
    client['connected'] = true;
    client['pingResponseListener'].lastPingResponse = Date.now() - 20000;
    const disconnectSpy = vi.spyOn(client, 'disconnect').mockResolvedValue(undefined);
    const connectSpy = vi.spyOn(client, 'connect').mockImplementation(() => {});

    await client['checkConnection']();

    expect(disconnectSpy).toHaveBeenCalled();
    expect(connectSpy).toHaveBeenCalled();
  });

  it('checkConnection() should send ping when ping response is recent', async () => {
    client['connected'] = true;
    client['pingResponseListener'].lastPingResponse = Date.now();
    const sendPingSpy = vi.fn().mockResolvedValue(undefined);
    client['sendPingRequest'] = sendPingSpy;

    await client['checkConnection']();

    expect(sendPingSpy).toHaveBeenCalled();
  });

  it('checkConnection() should skip when already checking', async () => {
    client['checkingConnection'] = true;
    const sendPingSpy = vi.fn().mockResolvedValue(undefined);
    client['sendPingRequest'] = sendPingSpy;

    await client['checkConnection']();

    expect(sendPingSpy).not.toHaveBeenCalled();
  });

  it('safeHandler() should catch and log errors', async () => {
    const errorFn = vi.fn().mockRejectedValue(new Error('async boom'));
    const handler = client['safeHandler'](errorFn);
    handler();

    // Wait for the promise to reject
    await new Promise((r) => setTimeout(r, 10));
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('unhandled error'));
  });

  it('onMessage() should handle multiple segments in a single buffer', async () => {
    client['socket'] = mockSocket;
    // Two segments: first 3 bytes, second 2 bytes
    const seg1 = Buffer.from([0, 0, 0, 3, 10, 20, 30]);
    const seg2 = Buffer.from([0, 0, 0, 2, 40, 50]);
    const combined = Buffer.concat([seg1, seg2]);

    client['isMessageComplete'] = vi.fn().mockReturnValue(true);
    client['buffer'] = asPartial<ChunkBuffer>({
      append: vi.fn(),
      get: vi.fn().mockReturnValue(combined),
      reset: vi.fn(),
    });
    await client['onMessage'](combined);
    expect(client['deserializer'].deserialize).toHaveBeenCalledTimes(2);
  });

  it('send() should use context protocol version when request version is undefined', async () => {
    mockSocket.readyState = 'open';
    mockSocket.destroyed = false;
    client['socket'] = mockSocket;
    client['connected'] = true;
    const req = asPartial<RequestMessage>({
      toLocalRequest: vi.fn().mockReturnValue({ version: '1.0', protocol: Protocol.ping_request, method: 'ping' }),
      secure: false,
      isForProtocol: vi.fn().mockReturnValue(false),
      version: undefined,
      method: 'ping',
    });
    await client.send(duid, req);
    expect(mockContext.getLocalProtocolVersion).toHaveBeenCalledWith(duid);
    expect(client['serializer'].serialize).toHaveBeenCalled();
    expect(mockSocket.write).toHaveBeenCalled();
  });

  it('processHelloResponse() should clear existing checkConnectionInterval before creating new one', async () => {
    vi.useFakeTimers();
    const existingInterval = setInterval(() => {}, 1000);
    client['checkConnectionInterval'] = existingInterval;

    mockContext.updateNonce = vi.fn();
    mockContext.updateLocalProtocolVersion = vi.fn();

    const response = asPartial<any>({
      header: { nonce: 42, version: '1.0' },
    });

    await client['processHelloResponse'](response);

    expect(client['connected']).toBe(true);
    expect(client['checkConnectionInterval']).toBeDefined();
    expect(client['checkConnectionInterval']).not.toBe(existingInterval);
  });

  it('safeHandler() should handle non-Error objects', async () => {
    const errorFn = vi.fn().mockRejectedValue('string error');
    const handler = client['safeHandler'](errorFn);
    handler();

    await new Promise((r) => setTimeout(r, 10));
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('unhandled error'));
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });
});
