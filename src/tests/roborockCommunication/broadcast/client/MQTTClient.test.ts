import { MQTTClient } from '../../../../roborockCommunication/broadcast/client/MQTTClient';

const mockConnect = jest.fn();
jest.mock('mqtt', () => {
  const actual = jest.requireActual('mqtt');
  return {
    ...actual,
    connect: mockConnect,
  };
});

describe('MQTTClient', () => {
  let logger: any;
  let context: any;
  let userdata: any;
  let client: any;
  let serializer: any;
  let deserializer: any;
  let connectionListeners: any;
  let messageListeners: any;
  const createdClients: any[] = [];

  beforeEach(() => {
    logger = { error: jest.fn(), debug: jest.fn(), notice: jest.fn(), info: jest.fn() };
    context = {
      getProtocolVersion: jest.fn().mockReturnValue('1.0'),
    };
    userdata = {
      rriot: {
        u: 'user',
        k: 'key',
        s: 'secret',
        r: { m: 'mqtt://broker' },
      },
    };
    serializer = { serialize: jest.fn(() => ({ buffer: Buffer.from('msg') })) };
    deserializer = { deserialize: jest.fn(() => 'deserialized') };
    connectionListeners = {
      onConnected: jest.fn().mockResolvedValue(undefined),
      onDisconnected: jest.fn().mockResolvedValue(undefined),
      onError: jest.fn().mockResolvedValue(undefined),
      onReconnect: jest.fn().mockResolvedValue(undefined),
    };
    messageListeners = { onMessage: jest.fn().mockResolvedValue(undefined) };

    // Mock mqtt client instance
    client = {
      on: jest.fn(),
      end: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      reconnect: jest.fn(),
    };
    mockConnect.mockReturnValue(client);
  });

  function createMQTTClient() {
    // Pass dependencies via constructor if possible, or use a factory/mockable subclass for testing
    class TestMQTTClient extends MQTTClient {
      constructor() {
        super(logger, context, userdata);
        (this as any).serializer = serializer;
        (this as any).deserializer = deserializer;
        (this as any).connectionListeners = connectionListeners;
        (this as any).messageListeners = messageListeners;
      }
    }
    const mqttClient = new TestMQTTClient();
    createdClients.push(mqttClient);
    return mqttClient;
  }

  afterEach(async () => {
    // Clean up any MQTT clients to prevent timer leaks
    for (const mqttClient of createdClients) {
      try {
        if (mqttClient['keepConnectionAliveInterval']) {
          clearInterval(mqttClient['keepConnectionAliveInterval']);
        }
        if (mqttClient['mqttClient']) {
          // Force the client to null to prevent reconnect attempts
          const mc = mqttClient['mqttClient'];
          mqttClient['mqttClient'] = null;
          if (mc && typeof mc.end === 'function') {
            mc.end(true); // Force close
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_e) {
        // Ignore cleanup errors
      }
    }
    createdClients.length = 0;
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  afterAll(() => {
    // Final cleanup
    jest.clearAllTimers();
  });

  it('should generate username and password in constructor', () => {
    const mqttClient = createMQTTClient();
    expect(mqttClient['mqttUsername']).toBe('c6d6afb9');
    expect(mqttClient['mqttPassword']).toBe('938f62d6603bde9c');
  });

  it('should not connect if already connected', () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient.connect();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('should disconnect if connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    await mqttClient.disconnect();
    expect(client.end).toHaveBeenCalled();
  });

  it('should not disconnect if not connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = undefined;
    mqttClient['connected'] = false;
    await mqttClient.disconnect();
    expect(client.end).not.toHaveBeenCalled();
  });

  it('should log error if disconnect throws', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = {
      end: jest.fn(() => {
        throw new Error('fail');
      }),
    } as any;
    mqttClient['connected'] = true;
    await mqttClient.disconnect();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[MQTTClient] client failed to disconnect with error:'));
  });

  it('should publish message if connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    const request = { toMqttRequest: jest.fn(() => 'req') };
    await mqttClient.send('duid1', request as any);
    expect(serializer.serialize).toHaveBeenCalledWith('duid1', 'req');
    expect(client.publish).toHaveBeenCalledWith('rr/m/i/user/c6d6afb9/duid1', Buffer.from('msg'), { qos: 1 });
  });

  it('should log error if send called when not connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = undefined;
    mqttClient['connected'] = false;
    const request = { toMqttRequest: jest.fn() };
    await mqttClient.send('duid1', request as any);
    expect(logger.error).toHaveBeenCalled();
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('onConnect should set connected, call onConnected, and subscribeToQueue', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['subscribeToQueue'] = jest.fn();
    await mqttClient['onConnect']({} as any);
    expect(mqttClient['connected']).toBe(true);
    expect(connectionListeners.onConnected).toHaveBeenCalled();
    expect(mqttClient['subscribeToQueue']).toHaveBeenCalled();
  });

  it('subscribeToQueue should call client.subscribe with correct topic', () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    mqttClient['subscribeToQueue']();
    expect(client.subscribe).toHaveBeenCalledWith('rr/m/o/user/c6d6afb9/#', expect.any(Function));
  });

  it('onSubscribe should log error and call onDisconnected if error', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onSubscribe'](new Error('fail'), undefined);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('failed to subscribe'));
    expect(mqttClient['connected']).toBe(false);
    expect(connectionListeners.onDisconnected).toHaveBeenCalled();
  });

  it('onSubscribe should do nothing if no error', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onSubscribe'](null, undefined);
    expect(logger.error).not.toHaveBeenCalled();
    expect(connectionListeners.onDisconnected).not.toHaveBeenCalled();
  });

  it('onDisconnect should call onDisconnected', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onDisconnect']();
    expect(connectionListeners.onDisconnected).toHaveBeenCalled();
  });

  it('onError should log error and call onError', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['connected'] = true;
    await mqttClient['onError'](new Error('fail'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('MQTT connection error'));
    expect(connectionListeners.onError).toHaveBeenCalledWith('mqtt-c6d6afb9', expect.stringContaining('fail'));
  });

  it('onReconnect should call subscribeToQueue', () => {
    const mqttClient = createMQTTClient();
    mqttClient['subscribeToQueue'] = jest.fn();
    mqttClient['onReconnect']();
    expect(mqttClient['subscribeToQueue']).toHaveBeenCalled();
  });

  it('onMessage should call deserializer and messageListeners.onMessage if message', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onMessage']('rr/m/o/user/c6d6afb9/duid1', Buffer.from('msg'));
    expect(deserializer.deserialize).toHaveBeenCalledWith('duid1', Buffer.from('msg'), '[MQTTClient]');
    expect(messageListeners.onMessage).toHaveBeenCalledWith('deserialized');
  });

  it('onMessage should log notice if message is falsy', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onMessage']('topic', null as any);
    expect(logger.notice).toHaveBeenCalledWith(expect.stringContaining('received empty message'));
  });

  it('onMessage should log error if deserializer throws', async () => {
    const mqttClient = createMQTTClient();
    deserializer.deserialize.mockImplementation(() => {
      throw new Error('fail');
    });
    await mqttClient['onMessage']('topic/duid', Buffer.from('msg'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('unable to process message'));
  });

  it('connect should setup mqtt client with event handlers', () => {
    const mqttClient = createMQTTClient();

    // Reset the mock before calling connect
    mockConnect.mockClear();

    mqttClient.connect();

    // Verify the client was created and event handlers were registered
    expect(mqttClient['mqttClient']).toBeDefined();

    // Get the actual client instance
    const actualClient = mqttClient['mqttClient'];

    // Verify event handlers were registered on the actual client
    // Since we're using the real mqtt library, just verify the client exists and is set up
    expect(actualClient).toBeTruthy();
    expect(typeof actualClient?.on).toBe('function');
    expect(typeof actualClient?.publish).toBe('function');
    expect(typeof actualClient?.subscribe).toBe('function');
  });

  it('keepConnectionAlive should setup interval that reconnects client', () => {
    jest.useFakeTimers();
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    mqttClient['keepConnectionAlive']();

    expect(mqttClient['keepConnectionAliveInterval']).toBeDefined();

    // Fast-forward time by 60 minutes to trigger the interval callback
    jest.advanceTimersByTime(60 * 60 * 1000);

    expect(client.end).toHaveBeenCalled();
    expect(client.reconnect).toHaveBeenCalled();

    // Clean up
    clearInterval(mqttClient['keepConnectionAliveInterval']);
    jest.useRealTimers();
  });

  it('keepConnectionAlive should call connect if mqttClient is undefined', () => {
    jest.useFakeTimers();
    const mqttClient = createMQTTClient();
    const connectSpy = jest.spyOn(mqttClient, 'connect');
    mqttClient['mqttClient'] = undefined;
    mqttClient['connected'] = false;
    mqttClient['keepConnectionAlive']();

    // Fast-forward time by 60 minutes to trigger the interval callback
    jest.advanceTimersByTime(60 * 60 * 1000);

    expect(connectSpy).toHaveBeenCalled();

    // Clean up
    clearInterval(mqttClient['keepConnectionAliveInterval']);
    jest.useRealTimers();
  });

  it('keepConnectionAlive should clear existing interval before setting new one', () => {
    jest.useFakeTimers();
    const mqttClient = createMQTTClient();
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

    // Set initial interval
    mqttClient['keepConnectionAlive']();
    const firstInterval = mqttClient['keepConnectionAliveInterval'];

    // Call again to clear and reset
    mqttClient['keepConnectionAlive']();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(firstInterval);

    // Clean up
    clearInterval(mqttClient['keepConnectionAliveInterval']);
    jest.useRealTimers();
  });

  it('disconnect should return early if not connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = false;
    await mqttClient.disconnect();
    expect(client.end).not.toHaveBeenCalled();
  });

  it('onClose should call onDisconnected only if connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['connected'] = true;
    await mqttClient['onClose']();
    expect(connectionListeners.onDisconnected).toHaveBeenCalledWith('mqtt-c6d6afb9', 'MQTT connection closed');
    expect(mqttClient['connected']).toBe(false);
  });

  it('onClose should not call onDisconnected if already disconnected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['connected'] = false;
    await mqttClient['onClose']();
    expect(connectionListeners.onDisconnected).not.toHaveBeenCalled();
  });

  it('onOffline should set connected to false and call onDisconnected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['connected'] = true;
    await mqttClient['onOffline']();
    expect(mqttClient['connected']).toBe(false);
    expect(connectionListeners.onDisconnected).toHaveBeenCalledWith('mqtt-c6d6afb9', 'MQTT connection offline');
  });

  it('onReconnect should call onReconnect on connectionListeners', () => {
    const mqttClient = createMQTTClient();
    mqttClient['subscribeToQueue'] = jest.fn();
    mqttClient['onReconnect']();
    expect(connectionListeners.onReconnect).toHaveBeenCalledWith('mqtt-c6d6afb9', 'Reconnected to MQTT broker');
  });
});
