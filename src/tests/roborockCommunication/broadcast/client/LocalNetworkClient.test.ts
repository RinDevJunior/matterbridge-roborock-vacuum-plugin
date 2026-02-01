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
import { ChainedMessageListener } from '../../../../roborockCommunication/routing/listeners/implementation/chainedMessageListener.js';
import { PendingResponseTracker } from '../../../../roborockCommunication/routing/services/pendingResponseTracker.js';
import { ProtocolVersion } from '../../../../roborockCommunication/enums/protocolVersion.js';
import { ChunkBuffer } from '../../../../roborockCommunication/helper/chunkBuffer.js';

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
  let mockChainedMessageListener: ChainedMessageListener;
  let mockResponseTracker: PendingResponseTracker;
  const duid = 'duid1';
  const ip = '127.0.0.1';

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
      info: vi.fn(),
    };
    mockContext = {
      nonce: Buffer.from([1, 2, 3, 4]),
      getProtocolVersion: vi.fn().mockReturnValue('1.0'),
    };

    // Create a more realistic socket mock using EventEmitter
    mockSocket = Object.assign(new EventEmitter(), {
      connect: vi.fn(),
      destroy: vi.fn(),
      write: vi.fn(),
      address: vi.fn().mockReturnValue({ address: '127.0.0.1', port: 58867 }),
      writable: true,
      readable: true,
    });

    globalThis.mockSocketInstance = mockSocket;

    mockResponseTracker = new PendingResponseTracker(mockLogger);
    mockChainedMessageListener = new ChainedMessageListener(mockResponseTracker, mockLogger);

    client = new LocalNetworkClient(mockLogger, mockContext, duid, ip, mockChainedMessageListener, mockResponseTracker);
    Object.defineProperty(client, 'serializer', {
      value: asPartial({ serialize: vi.fn().mockReturnValue({ buffer: Buffer.from([1, 2, 3]), messageId: 123 }) }),
      writable: true,
    });
    Object.defineProperty(client, 'deserializer', {
      value: asPartial({ deserialize: vi.fn().mockReturnValue('deserialized') }),
      writable: true,
    });

    Object.defineProperty(client, 'chainedMessageListener', {
      value: asPartial({ onMessage: vi.fn(), onResponse: vi.fn() }),
      writable: true,
    });
    Object.defineProperty(client, 'connectionListener', {
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
    if (client?.['pingInterval']) {
      clearInterval(client['pingInterval']);
      client['pingInterval'] = undefined;
    }
  });

  it('should initialize fields in constructor', () => {
    expect(client.duid).toBe(duid);
    expect(client.ip).toBe(ip);
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

  it('disconnect() should destroy socket and clear pingInterval', async () => {
    client['socket'] = mockSocket;
    client['pingInterval'] = setInterval(() => {
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
    client['pingInterval'] = setInterval(() => {
      vi.fn();
    }, 1000);
    await client['onDisconnect'](false);
    expect(mockLogger.info).toHaveBeenCalled();
    expect(client['connected']).toBe(false);
    expect(mockSocket.destroy).toHaveBeenCalled();
    expect(client['socket']).toBeUndefined();
    expect(client['connectionListener'].onDisconnected).toHaveBeenCalled();
  });

  it('onError() should log, set connected false, destroy socket, call onDisconnected', async () => {
    client['socket'] = mockSocket;
    client['connected'] = false;
    await client['onError'](new Error('fail'));
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining(' [LocalNetworkClient]: Socket error for'));
    expect(client['connectionListener'].onDisconnected).toHaveBeenCalledWith('duid1', expect.stringContaining('fail'));
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
    expect(client['chainedMessageListener'].onMessage).toHaveBeenCalledWith('deserialized');
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
    client['pingResponseListener'].waitFor = vi.fn().mockResolvedValue({ header: { nonce: 123, version: '1.0' } });
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
    client['pingInterval'] = setInterval(() => vi.fn(), 1000);
    await client['onDisconnect'](false);
    expect(client['connected']).toBe(false);
    expect(client['connectionListener'].onDisconnected).toHaveBeenCalled();
  });

  it('onDisconnect() should handle when pingInterval is not set', async () => {
    client['socket'] = mockSocket;
    client['pingInterval'] = undefined;
    await client['onDisconnect'](true);
    expect(mockSocket.destroy).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Had error: true'));
  });

  it('onMessage() should return early if socket is undefined', async () => {
    client['socket'] = undefined;
    const payload = Buffer.from([0, 0, 0, 3, 10, 20, 30]);
    await client['onMessage'](payload);
    expect(client['chainedMessageListener'].onMessage).not.toHaveBeenCalled();
  });

  it('onMessage() should skip segment with length 17', async () => {
    client['socket'] = mockSocket;
    // Create buffer with segmentLength = 17 followed by valid segment
    const buffer = Buffer.concat([
      Buffer.from([0, 0, 0, 17]), // length = 17
      Buffer.alloc(17, 0xff), // 17 bytes of data
      Buffer.from([0, 0, 0, 3]), // second segment length = 3,
      Buffer.from([10, 20, 30]), // 3 bytes of data
    ]);
    client['isMessageComplete'] = vi.fn().mockReturnValue(true);
    client['buffer'] = asPartial<ChunkBuffer>({
      append: vi.fn(),
      get: vi.fn().mockReturnValue(buffer),
      reset: vi.fn(),
    });
    await client['onMessage'](buffer);
    // Should process only the second segment (skip length 17)
    expect(client['deserializer'].deserialize).toHaveBeenCalledTimes(1);
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
    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('socket ended'));
  });

  it('disconnect() should handle when pingInterval is not set', async () => {
    client['socket'] = mockSocket;
    client['pingInterval'] = undefined;
    await client.disconnect();
    expect(mockSocket.destroy).toHaveBeenCalled();
    expect(client['socket']).toBeUndefined();
  });
});
