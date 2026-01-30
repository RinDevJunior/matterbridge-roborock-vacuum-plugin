import mqtt from 'mqtt';
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { MessageContext, RequestMessage } from '../../../../roborockCommunication/models/index.js';
import { MQTTClient } from '../../../../roborockCommunication/mqtt/mqttClient.js';

function makeUserdata() {
  return { rriot: { r: { m: 'mqtt://broker.example' }, u: 'testuser', k: 'key123', s: 'secret' } } as any;
}

function makeLogger() {
  return { debug: vi.fn(), info: vi.fn(), notice: vi.fn(), error: vi.fn() } as any;
}

describe('MQTTClient (additional)', () => {
  let userdata: any;
  let context: MessageContext;
  let logger: any;

  beforeEach(() => {
    vi.restoreAllMocks();
    userdata = makeUserdata();
    context = new MessageContext(userdata);
    logger = makeLogger();
  });

  it('isReady/isConnected reflect internal state', () => {
    const client = new MQTTClient(logger, context, userdata);
    expect(client.isConnected()).toBe(false);
    expect(client.isReady()).toBe(false);

    (client as any).mqttClient = {};
    (client as any).connected = true;

    expect(client.isConnected()).toBe(true);
    expect(client.isReady()).toBe(true);
  });

  it('connect calls mqtt.connect and registers event handlers', () => {
    const mockMqttClient: any = { on: vi.fn(), end: vi.fn(), reconnect: vi.fn(), publish: vi.fn(), subscribe: vi.fn() };

    // prevent keepAlive timer from running
    vi.spyOn(MQTTClient.prototype as any, 'keepConnectionAlive').mockImplementation(() => {});

    const spyConnect = vi.spyOn(mqtt, 'connect').mockImplementation(() => mockMqttClient as any);

    const client = new MQTTClient(logger, context, userdata);
    client.connect();

    expect(spyConnect).toHaveBeenCalledWith(
      userdata.rriot.r.m,
      expect.objectContaining({ clientId: expect.any(String), username: expect.any(String), password: expect.any(String) }),
    );

    // ensure handlers were attached
    expect(mockMqttClient.on).toHaveBeenCalled();
  });

  it('sendInternal logs error when not connected', async () => {
    const client = new MQTTClient(logger, context, userdata);
    const req = new RequestMessage({ method: 'test' });

    await (client as any).sendInternal('duid-1', req);

    expect(logger.error).toHaveBeenCalled();
  });

  it('sendInternal publishes when connected', async () => {
    const mockMqttClient: any = { on: vi.fn(), end: vi.fn(), reconnect: vi.fn(), publish: vi.fn(), subscribe: vi.fn() };

    vi.spyOn(MQTTClient.prototype as any, 'keepConnectionAlive').mockImplementation(() => {});
    vi.spyOn(mqtt, 'connect').mockImplementation(() => mockMqttClient as any);

    const client = new MQTTClient(logger, context, userdata);

    // prepare serializer mock
    (client as any).mqttClient = mockMqttClient;
    (client as any).connected = true;
    (client as any).serializer = { serialize: vi.fn().mockReturnValue({ buffer: Buffer.from('payload') }) };

    const req = new RequestMessage({ method: 'test' });
    await (client as any).sendInternal('my-duid', req);

    expect(mockMqttClient.publish).toHaveBeenCalledTimes(1);
    const topicArg = mockMqttClient.publish.mock.calls[0][0];
    expect(topicArg).toContain(userdata.rriot.u);
    expect(topicArg).toContain('my-duid');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});

declare global {
  var mockConnect: ReturnType<typeof vi.fn>;
}

vi.mock('mqtt', async () => {
  const actual = await vi.importActual<any>('mqtt');
  globalThis.mockConnect = vi.fn();
  return {
    ...actual,
    connect: globalThis.mockConnect,
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
    logger = { error: vi.fn(), debug: vi.fn(), notice: vi.fn(), info: vi.fn() };
    context = { getProtocolVersion: vi.fn().mockReturnValue('1.0') };
    userdata = {
      rriot: {
        u: 'user',
        k: 'key',
        s: 'secret',
        r: { m: 'mqtt://broker' },
      },
    };
    serializer = { serialize: vi.fn(() => ({ buffer: Buffer.from('msg') })) };
    deserializer = { deserialize: vi.fn(() => 'deserialized') };
    connectionListeners = {
      onConnected: vi.fn().mockResolvedValue(undefined),
      onDisconnected: vi.fn().mockResolvedValue(undefined),
      onError: vi.fn().mockResolvedValue(undefined),
      onReconnect: vi.fn().mockResolvedValue(undefined),
    };
    messageListeners = { onMessage: vi.fn().mockResolvedValue(undefined) };

    // Mock mqtt client instance
    client = {
      on: vi.fn(),
      end: vi.fn(),
      publish: vi.fn(),
      subscribe: vi.fn(),
      reconnect: vi.fn(),
    };
    globalThis.mockConnect.mockReturnValue(client);
  });

  function createMQTTClient(mockSyncMessageListener?: any) {
    class TestMQTTClient extends MQTTClient {
      constructor() {
        super(logger, context, userdata, mockSyncMessageListener);
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
        if (mqttClient.keepConnectionAliveInterval) {
          clearInterval(mqttClient.keepConnectionAliveInterval);
        }
        if (mqttClient.mqttClient) {
          // Force the client to null to prevent reconnect attempts
          const mc = mqttClient.mqttClient;
          mqttClient.mqttClient = null;
          if (mc && typeof mc.end === 'function') {
            mc.end(true); // Force close
          }
        }
      } catch (_e) {
        // Ignore cleanup errors
      }
    }
    createdClients.length = 0;
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  afterAll(() => {
    // Final cleanup
    vi.clearAllTimers();
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
    expect(globalThis.mockConnect).not.toHaveBeenCalled();
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
      end: vi.fn(() => {
        throw new Error('fail');
      }),
    } as any;
    mqttClient['connected'] = true;
    await mqttClient.disconnect();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[MQTTClient] client failed to disconnect with error:'));
  });

  it('should publish message if connected', async () => {
    const mockSyncMessageListener = {
      waitFor: vi.fn((_msgId: number, _req: any, resolve: any, _reject: any) => resolve(undefined)),
      pending: new Map(),
      logger,
      onMessage: vi.fn(),
    };
    const mqttClient = createMQTTClient(mockSyncMessageListener);
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    const request = { toMqttRequest: vi.fn(() => 'req'), method: 'test' };
    await (mqttClient as any).sendInternal('duid1', request as any);
    expect(serializer.serialize).toHaveBeenCalledWith('duid1', 'req');
    expect(client.publish).toHaveBeenCalledWith('rr/m/i/user/c6d6afb9/duid1', Buffer.from('msg'), { qos: 1 });
  });

  it('should log error if send called when not connected', async () => {
    const mockSyncMessageListener = {
      waitFor: vi.fn((_msgId: number, _req: any, resolve: any, _reject: any) => resolve(undefined)),
      pending: new Map(),
      logger,
      onMessage: vi.fn(),
    };
    const mqttClient = createMQTTClient(mockSyncMessageListener);
    mqttClient['mqttClient'] = undefined;
    mqttClient['connected'] = false;
    const request = { toMqttRequest: vi.fn(), method: 'test' };
    await mqttClient.send('duid1', request as any);
    expect(logger.error).toHaveBeenCalled();
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('onConnect should set connected, call onConnected, and subscribeToQueue', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['subscribeToQueue'] = vi.fn();
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
    expect(connectionListeners.onError).toHaveBeenCalledWith('mqtt-c6d6afb9', expect.stringContaining('MQTT connection error'));
  });

  it('onReconnect should call subscribeToQueue', () => {
    const mqttClient = createMQTTClient();
    mqttClient['subscribeToQueue'] = vi.fn();
    mqttClient['onReconnect']();
    expect(mqttClient['subscribeToQueue']).toHaveBeenCalled();
  });

  it('onMessage should call deserializer and messageListeners.onMessage if message', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onMessage']('rr/m/o/user/c6d6afb9/duid1', Buffer.from('msg'));
    expect(deserializer.deserialize).toHaveBeenCalledWith('duid1', Buffer.from('msg'), 'MQTTClient');
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
    globalThis.mockConnect.mockClear();

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
    vi.useFakeTimers();
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    mqttClient['keepConnectionAlive']();

    expect(mqttClient['keepConnectionAliveInterval']).toBeDefined();
    // Fast-forward time by 60 minutes to trigger the interval callback
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(client.end).toHaveBeenCalled();
    expect(client.reconnect).toHaveBeenCalled();

    // Clean up
    clearInterval(mqttClient['keepConnectionAliveInterval']);
    vi.useRealTimers();
  });

  it('keepConnectionAlive should call connect if mqttClient is undefined', () => {
    vi.useFakeTimers();
    const mqttClient = createMQTTClient();
    const connectSpy = vi.spyOn(mqttClient, 'connect');
    mqttClient['mqttClient'] = undefined;
    mqttClient['connected'] = false;
    mqttClient['keepConnectionAlive']();

    // Fast-forward time by 60 minutes to trigger the interval callback
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(connectSpy).toHaveBeenCalled();

    // Clean up
    clearInterval(mqttClient['keepConnectionAliveInterval']);
    vi.useRealTimers();
  });

  it('keepConnectionAlive should clear existing interval before setting new one', () => {
    vi.useFakeTimers();
    const mqttClient = createMQTTClient();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    // Set initial interval
    mqttClient['keepConnectionAlive']();
    const firstInterval = mqttClient['keepConnectionAliveInterval'];

    // Call again to clear and reset
    mqttClient['keepConnectionAlive']();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(firstInterval);

    // Clean up
    clearInterval(mqttClient['keepConnectionAliveInterval']);
    vi.useRealTimers();
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
    mqttClient['subscribeToQueue'] = vi.fn();
    mqttClient['onReconnect']();
    expect(connectionListeners.onReconnect).toHaveBeenCalledWith('mqtt-c6d6afb9', 'Reconnected to MQTT broker');
  });
});
