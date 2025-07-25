import { LocalNetworkClient } from '../../../../roborockCommunication/broadcast/client/LocalNetworkClient';
import { Protocol } from '../../../../roborockCommunication/broadcast/model/protocol';

// Pseudocode plan:
// 1. Mock dependencies: Socket, AnsiLogger, MessageContext, RequestMessage, Protocol, serializer/deserializer.
// 2. Test constructor initializes fields correctly.
// 3. Test connect(): should create a Socket, set up event handlers, and call socket.connect with correct params.
// 4. Test disconnect(): should destroy socket, clear ping interval, and set socket to undefined.
// 5. Test send():
//    - If socket is not connected, should log error and not write.
//    - If connected, should serialize and write the message.
// 6. Test onConnect(): sets connected, logs, sends hello, sets ping interval, calls connectionListeners.onConnected.
// 7. Test onDisconnect(): logs, sets connected false, destroys socket, clears ping interval, calls connectionListeners.onDisconnected.
// 8. Test onError(): logs, sets connected false, destroys socket, calls connectionListeners.onError.
// 9. Test onMessage():
//    - If no socket, logs error.
//    - If empty message, logs debug.
//    - If valid, appends, checks completeness, deserializes, calls messageListeners.onMessage.
// 10. Test isMessageComplete(): returns true/false for various buffer scenarios.
// 11. Test wrapWithLengthData(): prepends length to buffer.
// 12. Test sendHelloMessage() and sendPingRequest(): calls send with correct protocol.

const Sket = jest.fn();

jest.mock('node:net', () => {
  const actual = jest.requireActual('node:net');
  return {
    ...actual,
    Socket: Sket, // We'll set the implementation in beforeEach
  };
});

describe('LocalNetworkClient', () => {
  let client: LocalNetworkClient;
  let mockLogger: any;
  let mockContext: any;
  let mockSocket: any;
  const duid = 'duid1';
  const ip = '127.0.0.1';

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      notice: jest.fn(),
    };
    mockContext = {};
    mockSocket = {
      on: jest.fn(),
      connect: jest.fn(),
      destroy: jest.fn(),
      write: jest.fn(),
      address: jest.fn().mockReturnValue({ address: '127.0.0.1', port: 58867 }),
    };
    // Set the Socket mock implementation
    Sket.mockImplementation(() => mockSocket);

    client = new LocalNetworkClient(mockLogger, mockContext, duid, ip);
    // Patch serializer/deserializer for send/onMessage
    (client as any).serializer = { serialize: jest.fn().mockReturnValue({ buffer: Buffer.from([1, 2, 3]), messageId: 123 }) };
    (client as any).deserializer = { deserialize: jest.fn().mockReturnValue('deserialized') };
    (client as any).messageListeners = { onMessage: jest.fn() };
    (client as any).connectionListeners = {
      onConnected: jest.fn(),
      onDisconnected: jest.fn(),
      onError: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('should initialize fields in constructor', () => {
    expect(client.duid).toBe(duid);
    expect(client.ip).toBe(ip);
    expect((client as any).messageIdSeq).toBeDefined();
  });

  it('connect() should create socket, set handlers, and call connect', () => {
    client.connect();
    expect(client['socket']).not.toBeUndefined();
  });

  it('disconnect() should destroy socket and clear pingInterval', async () => {
    client['socket'] = mockSocket;
    client['pingInterval'] = setInterval(() => {
      jest.fn();
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
    await client.send(duid, { toLocalRequest: jest.fn(), secure: false } as any);
    expect(mockLogger.error).toHaveBeenCalled();
    expect(mockSocket.write).not.toHaveBeenCalled();
  });

  it('send() should serialize and write if connected', async () => {
    client['socket'] = mockSocket;
    client['connected'] = true;
    const req = { toLocalRequest: jest.fn().mockReturnValue({}), secure: false };
    await client.send(duid, req as any);
    expect(client['serializer'].serialize).toHaveBeenCalled();
    expect(mockSocket.write).toHaveBeenCalledWith(expect.any(Buffer));
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('onConnect() should set connected, log, send hello, set ping, call onConnected', async () => {
    client['socket'] = mockSocket;
    jest.useFakeTimers();
    const sendHelloSpy = jest.spyOn(client as any, 'sendHelloMessage').mockResolvedValue(undefined);
    await (client as any).onConnect();
    expect(client['connected']).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalled();
    expect(sendHelloSpy).toHaveBeenCalled();
    expect(client['pingInterval']).toBeDefined();
    expect(client['connectionListeners'].onConnected).toHaveBeenCalled();
  });

  it('onDisconnect() should log, set connected false, destroy socket, clear ping, call onDisconnected', async () => {
    client['socket'] = mockSocket;
    client['pingInterval'] = setInterval(() => {
      jest.fn();
    }, 1000);
    await (client as any).onDisconnect();
    expect(mockLogger.error).toHaveBeenCalled();
    expect(client['connected']).toBe(false);
    expect(mockSocket.destroy).toHaveBeenCalled();
    expect(client['socket']).toBeUndefined();
    expect(client['connectionListeners'].onDisconnected).toHaveBeenCalled();
  });

  it('onError() should log, set connected false, destroy socket, call onError', async () => {
    client['socket'] = mockSocket;
    await (client as any).onError(new Error('fail'));
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Socket connection error'));
    expect(client['connected']).toBe(false);
    expect(mockSocket.destroy).toHaveBeenCalled();
    expect(client['socket']).toBeUndefined();
    expect(client['connectionListeners'].onError).toHaveBeenCalledWith('duid1', expect.stringContaining('fail'));
  });

  it('onMessage() should log debug if message is empty', async () => {
    client['socket'] = mockSocket;
    await (client as any).onMessage(Buffer.alloc(0));
    expect(mockLogger.debug).toHaveBeenCalledWith('LocalNetworkClient received empty message from socket.');
  });

  it('onMessage() should process complete message and call onMessage', async () => {
    client['socket'] = mockSocket;
    // Compose a buffer with a single segment of length 3 (after 4 bytes)
    const payload = Buffer.from([0, 0, 0, 3, 10, 20, 30]);
    (client as any).isMessageComplete = jest.fn().mockReturnValue(true);
    (client as any).buffer = {
      append: jest.fn(),
      get: jest.fn().mockReturnValue(payload),
      reset: jest.fn(),
    };
    await (client as any).onMessage(payload);
    expect(client['deserializer'].deserialize).toHaveBeenCalled();
    expect(client['messageListeners'].onMessage).toHaveBeenCalledWith('deserialized');
  });

  it('isMessageComplete() should return true for complete buffer', () => {
    // 4 bytes length + 3 bytes payload
    const buf = Buffer.from([0, 0, 0, 3, 1, 2, 3]);
    expect((client as any).isMessageComplete(buf)).toBe(true);
  });

  it('isMessageComplete() should return false for incomplete buffer', () => {
    // 4 bytes length + only 2 bytes payload
    const buf = Buffer.from([0, 0, 0, 3, 1, 2]);
    expect((client as any).isMessageComplete(buf)).toBe(false);
  });

  it('wrapWithLengthData() should prepend length', () => {
    const data = Buffer.from([1, 2, 3]);
    const result = (client as any).wrapWithLengthData(data);
    expect(result.readUInt32BE(0)).toBe(3);
    expect(result.slice(4).equals(data)).toBe(true);
  });

  it('sendHelloMessage() should call send with hello_request', async () => {
    const sendSpy = jest.spyOn(client, 'send').mockResolvedValue(undefined);
    await (client as any).sendHelloMessage();
    expect(sendSpy).toHaveBeenCalledWith(duid, expect.objectContaining({ protocol: Protocol.hello_request }));
  });

  it('sendPingRequest() should call send with ping_request', async () => {
    const sendSpy = jest.spyOn(client, 'send').mockResolvedValue(undefined);
    await (client as any).sendPingRequest();
    expect(sendSpy).toHaveBeenCalledWith(duid, expect.objectContaining({ protocol: Protocol.ping_request }));
  });
});
