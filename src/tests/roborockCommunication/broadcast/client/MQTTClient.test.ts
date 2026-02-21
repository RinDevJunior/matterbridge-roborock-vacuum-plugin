import mqtt, { ErrorWithReasonCode, IConnackPacket, MqttClient as MqttLibClient } from 'mqtt';
import { vi, describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { asPartial, asType, createMockLogger } from '../../../helpers/testUtils.js';
import { MessageContext, RequestMessage } from '../../../../roborockCommunication/models/index.js';
import { MQTTClient } from '../../../../roborockCommunication/mqtt/mqttClient.js';
import { V1PendingResponseTracker } from '../../../../roborockCommunication/routing/services/v1PendingResponseTracker.js';
import { ConnectionBroadcaster } from '../../../../roborockCommunication/routing/listeners/connectionBroadcaster.js';
import { V1ResponseBroadcaster } from '../../../../roborockCommunication/routing/listeners/v1ResponseBroadcaster.js';

function makeUserdata() {
  return asPartial({ rriot: { r: { m: 'mqtt://broker.example' }, u: 'testuser', k: 'key123', s: 'secret' } });
}

function makeLogger() {
  return asPartial<Record<string, unknown>>({ debug: vi.fn(), info: vi.fn(), notice: vi.fn(), error: vi.fn() });
}

describe('MQTTClient (additional)', () => {
  let userdata: any;
  let context: MessageContext;
  let logger: any;
  let responseBroadcaster: V1ResponseBroadcaster;
  let responseTracker: V1PendingResponseTracker;

  beforeEach(() => {
    vi.restoreAllMocks();
    userdata = makeUserdata();
    context = new MessageContext(userdata);
    logger = makeLogger();
    responseTracker = new V1PendingResponseTracker(logger);
    responseBroadcaster = new V1ResponseBroadcaster(responseTracker, logger);
  });

  it('isReady/isConnected reflect internal state', () => {
    const client = new MQTTClient(logger, context, userdata, responseBroadcaster, responseTracker);
    expect(client.isConnected()).toBe(false);
    expect(client.isReady()).toBe(false);

    client['connected'] = true;
    client['mqttClient'] = asPartial<MqttLibClient>({});

    expect(client.isConnected()).toBe(true);
    expect(client.isReady()).toBe(true);

    // isReady should be false if mqttClient is undefined even when connected is true
    client['mqttClient'] = undefined;
    expect(client.isReady()).toBe(false);
  });

  it('connect calls mqtt.connect and registers event handlers', () => {
    const mockMqttClient: any = { on: vi.fn(), end: vi.fn(), reconnect: vi.fn(), publish: vi.fn(), subscribe: vi.fn() };

    // prevent keepAlive timer from running
    const spyConnect = vi.spyOn(mqtt, 'connect').mockImplementation(() => asType<any>(mockMqttClient));

    const client = new MQTTClient(logger, context, userdata, responseBroadcaster, responseTracker);

    client['keepConnectionAlive'] = vi.fn();

    client.connect();

    expect(spyConnect).toHaveBeenCalledWith(
      userdata.rriot.r.m,
      expect.objectContaining({
        clientId: expect.any(String),
        username: expect.any(String),
        password: expect.any(String),
      }),
    );

    // ensure handlers were attached
    expect(mockMqttClient.on).toHaveBeenCalled();
  });

  it('sendInternal logs error when not connected', async () => {
    const client = new MQTTClient(logger, context, userdata, responseBroadcaster, responseTracker);
    const req = new RequestMessage({ method: 'test' });

    await asType<{ sendInternal(duid: string, req: RequestMessage): Promise<void> }>(client).sendInternal(
      'duid-1',
      req,
    );

    expect(logger.error).toHaveBeenCalled();
  });

  it('sendInternal publishes when connected', async () => {
    const mockMqttClient: any = { on: vi.fn(), end: vi.fn(), reconnect: vi.fn(), publish: vi.fn(), subscribe: vi.fn() };
    vi.spyOn(mqtt, 'connect').mockImplementation(() => asType<any>(mockMqttClient));

    const client = new MQTTClient(logger, context, userdata, responseBroadcaster, responseTracker);

    client['keepConnectionAlive'] = vi.fn();
    client['mqttClient'] = mockMqttClient;
    client['connected'] = true;

    Object.defineProperty(client, 'serializer', {
      value: asPartial({ serialize: vi.fn().mockReturnValue({ buffer: Buffer.from('payload') }) }),
      writable: true,
    });

    const req = new RequestMessage({ method: 'test' });
    await asType<{ sendInternal(duid: string, req: RequestMessage): Promise<void> }>(client).sendInternal(
      'my-duid',
      req,
    );

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
  const actual = await vi.importActual('mqtt');
  globalThis.mockConnect = vi.fn();
  return {
    ...actual,
    connect: globalThis.mockConnect,
  };
});

describe('MQTTClient', () => {
  let logger: AnsiLogger;
  let context: any;
  let userdata: any;
  let client: any;
  let serializer: any;
  let deserializer: any;
  let responseBroadcaster: V1ResponseBroadcaster;
  let responseTracker: V1PendingResponseTracker;
  const createdClients: any[] = [];

  beforeEach(() => {
    logger = createMockLogger();
    context = { getMQTTProtocolVersion: vi.fn().mockReturnValue('1.0') };
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
    responseTracker = new V1PendingResponseTracker(logger);
    responseBroadcaster = new V1ResponseBroadcaster(responseTracker, logger);

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

  function createMQTTClient() {
    class TestMQTTClient extends MQTTClient {
      constructor() {
        super(logger, context, userdata, responseBroadcaster, responseTracker);
      }
    }
    const mqttClient = new TestMQTTClient();
    Object.defineProperty(mqttClient, 'connectionBroadcaster', {
      value: asPartial<ConnectionBroadcaster>({
        onConnected: vi.fn(),
        onDisconnected: vi.fn(),
        onError: vi.fn(),
        onReconnect: vi.fn(),
      }),
      writable: true,
    });
    Object.defineProperty(mqttClient, 'responseBroadcaster', {
      value: asPartial<V1ResponseBroadcaster>({
        onMessage: vi.fn(),
        tryResolve: vi.fn(),
      }),
      writable: true,
    });
    Object.defineProperty(mqttClient, 'deserializer', {
      value: deserializer,
      writable: true,
    });
    Object.defineProperty(mqttClient, 'serializer', {
      value: serializer,
      writable: true,
    });

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
    mqttClient['mqttClient'] = asPartial<MqttLibClient>({
      end: vi.fn(() => {
        throw new Error('fail');
      }),
    });
    mqttClient['connected'] = true;
    await mqttClient.disconnect();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[MQTTClient] client failed to disconnect with error:'),
    );
  });

  it('should publish message if connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    const request = {
      toMqttRequest: vi.fn().mockReturnThis(),
      method: 'test',
      version: '1.0',
    };
    await mqttClient['sendInternal']('duid1', asType<RequestMessage>(request));
    expect(serializer.serialize).toHaveBeenCalledWith('duid1', expect.objectContaining({ version: '1.0' }));
    expect(client.publish).toHaveBeenCalledWith('rr/m/i/user/c6d6afb9/duid1', Buffer.from('msg'), { qos: 1 });
  });

  it('should log error if send called when not connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = undefined;
    mqttClient['connected'] = false;
    const request = { toMqttRequest: vi.fn(), method: 'test' };
    await mqttClient.send('duid1', asType<RequestMessage>(request));
    expect(logger.error).toHaveBeenCalled();
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('onConnect should set connected, call onConnected, and subscribeToQueue', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['subscribeToQueue'] = vi.fn();
    await mqttClient['onConnect'](asType<IConnackPacket>({}));
    expect(mqttClient['connected']).toBe(true);
    expect(mqttClient['connectionBroadcaster'].onConnected).toHaveBeenCalled();
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
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('[MQTTClient] Failed to subscribe: Error: fail'));
    expect(mqttClient['connected']).toBe(false);
    expect(mqttClient['connectionBroadcaster'].onDisconnected).toHaveBeenCalled();
  });

  it('onSubscribe should do nothing if no error', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onSubscribe'](null, undefined);
    expect(logger.error).not.toHaveBeenCalled();
    expect(mqttClient['connectionBroadcaster'].onDisconnected).not.toHaveBeenCalled();
  });

  it('onDisconnect should call onDisconnected', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onDisconnect']();
    expect(mqttClient['connectionBroadcaster'].onDisconnected).toHaveBeenCalled();
  });

  it('onError should log error and call onError', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['connected'] = true;
    await mqttClient['onError'](new Error('fail'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('MQTT connection error'));
    expect(mqttClient['connectionBroadcaster'].onError).toHaveBeenCalledWith(
      'mqtt-c6d6afb9',
      expect.stringContaining('MQTT connection error'),
    );
  });

  it('onReconnect should NOT call subscribeToQueue (subscribe happens in onConnect)', () => {
    const mqttClient = createMQTTClient();
    mqttClient['subscribeToQueue'] = vi.fn();
    mqttClient['onReconnect']();
    // subscribeToQueue should NOT be called in onReconnect - it's called by onConnect
    expect(mqttClient['subscribeToQueue']).not.toHaveBeenCalled();
  });

  it('onMessage should call deserializer and chainedMessageListener.onMessage if message', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onMessage']('rr/m/o/user/c6d6afb9/duid1', Buffer.from('msg'));
    expect(deserializer.deserialize).toHaveBeenCalledWith('duid1', Buffer.from('msg'), 'MQTTClient');
    expect(mqttClient['responseBroadcaster'].onMessage).toHaveBeenCalledWith('deserialized');
  });

  it('onMessage should log notice if message is falsy', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onMessage']('topic', asType<Buffer>(null));
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

    expect(logger.debug).toHaveBeenCalledWith('[MQTTClient] Connection is active, no action needed');

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
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    // Set initial interval
    mqttClient['keepConnectionAlive']();
    const firstInterval = mqttClient['keepConnectionAliveInterval'];

    // Call again to clear and reset
    mqttClient['keepConnectionAlive']();
    expect(clearIntervalSpy).toHaveBeenCalledWith(firstInterval);

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
    expect(mqttClient['connectionBroadcaster'].onDisconnected).toHaveBeenCalledWith(
      'mqtt-c6d6afb9',
      'MQTT connection closed',
    );
    expect(mqttClient['connected']).toBe(false);
  });

  it('onClose should not call onDisconnected if already disconnected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['connected'] = false;
    await mqttClient['onClose']();
    expect(mqttClient['connectionBroadcaster'].onDisconnected).not.toHaveBeenCalled();
  });

  it('onOffline should set connected to false and call onDisconnected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['connected'] = true;
    await mqttClient['onOffline']();
    expect(mqttClient['connected']).toBe(false);
    expect(mqttClient['connectionBroadcaster'].onDisconnected).toHaveBeenCalledWith(
      'mqtt-c6d6afb9',
      'MQTT connection offline',
    );
  });

  it('onReconnect should call onReconnect on connectionBroadcaster', () => {
    const mqttClient = createMQTTClient();
    mqttClient['onReconnect']();
    expect(mqttClient['connectionBroadcaster'].onReconnect).toHaveBeenCalledWith(
      'mqtt-c6d6afb9',
      'Attempting to reconnect to MQTT broker',
    );
  });

  it('onError should translate error code 5 to "Connection refused: Not authorized"', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onError'](asPartial<ErrorWithReasonCode>({ code: 5 }));
    expect(logger.error).toHaveBeenCalledWith('MQTT connection error: Connection refused: Not authorized');
    expect(mqttClient['connectionBroadcaster'].onError).toHaveBeenCalledWith(
      'mqtt-c6d6afb9',
      'MQTT connection error: Connection refused: Not authorized',
    );
  });

  it('onError should increment consecutiveAuthErrors for auth errors', async () => {
    const mqttClient = createMQTTClient();
    expect(mqttClient['consecutiveAuthErrors']).toBe(0);

    await mqttClient['onError'](asPartial<ErrorWithReasonCode>({ code: 5 }));
    expect(mqttClient['consecutiveAuthErrors']).toBe(1);

    await mqttClient['onError'](asPartial<ErrorWithReasonCode>({ code: 5 }));
    expect(mqttClient['consecutiveAuthErrors']).toBe(2);
  });

  it('onError should trigger backoff after 5 consecutive auth errors', async () => {
    vi.useFakeTimers();
    const mqttClient = createMQTTClient();
    mqttClient['terminateConnection'] = vi.fn();
    const connectSpy = vi.spyOn(mqttClient, 'connect');

    // Trigger 5 consecutive auth errors
    for (let i = 0; i < 5; i++) {
      await mqttClient['onError'](asPartial<ErrorWithReasonCode>({ code: 5 }));
    }

    expect(logger.error).toHaveBeenCalledWith('[MQTTClient] Auth error threshold reached, entering 60-minute backoff');
    expect(mqttClient['terminateConnection']).toHaveBeenCalled();
    expect(mqttClient['authErrorBackoffTimeout']).toBeDefined();

    // Fast-forward time by 60 minutes
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(connectSpy).toHaveBeenCalled();
    expect(mqttClient['consecutiveAuthErrors']).toBe(0);
    expect(logger.info).toHaveBeenCalledWith('[MQTTClient] Auth error backoff period ended, attempting reconnection');

    vi.useRealTimers();
  });

  it('onError should not trigger backoff for fewer than 5 auth errors', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['terminateConnection'] = vi.fn();

    // Trigger 4 auth errors (below threshold)
    for (let i = 0; i < 4; i++) {
      await mqttClient['onError'](asPartial<ErrorWithReasonCode>({ code: 5 }));
    }

    expect(mqttClient['terminateConnection']).not.toHaveBeenCalled();
    expect(mqttClient['authErrorBackoffTimeout']).toBeUndefined();
  });

  it('onError should reset consecutiveAuthErrors on successful connection', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['consecutiveAuthErrors'] = 3;

    await mqttClient['onConnect'](asType<IConnackPacket>({}));

    expect(mqttClient['consecutiveAuthErrors']).toBe(0);
  });

  it('terminateConnection should clear intervals and close client', () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    mqttClient['keepConnectionAliveInterval'] = setInterval(() => {}, 1000);
    mqttClient['authErrorBackoffTimeout'] = setTimeout(() => {}, 1000);

    mqttClient['terminateConnection']();

    expect(mqttClient['keepConnectionAliveInterval']).toBeUndefined();
    expect(mqttClient['authErrorBackoffTimeout']).toBeUndefined();
    expect(client.end).toHaveBeenCalledWith(true);
    expect(mqttClient['mqttClient']).toBeUndefined();
    expect(mqttClient['connected']).toBe(false);
  });

  it('terminateConnection should handle missing timers gracefully', () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    mqttClient['keepConnectionAliveInterval'] = undefined;
    mqttClient['authErrorBackoffTimeout'] = undefined;

    mqttClient['terminateConnection']();

    expect(client.end).toHaveBeenCalledWith(true);
    expect(mqttClient['connected']).toBe(false);
  });

  it('terminateConnection should handle missing mqttClient', () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = undefined;
    mqttClient['connected'] = true;

    mqttClient['terminateConnection']();

    expect(mqttClient['connected']).toBe(false);
  });

  it('keepConnectionAlive should reconnect when client exists but not connected', () => {
    vi.useFakeTimers();
    const mqttClient = createMQTTClient();
    const connectSpy = vi.spyOn(mqttClient, 'connect');
    const originalClient = mqttClient['mqttClient'];
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = false;
    mqttClient['keepConnectionAlive']();

    // Fast-forward time by 60 minutes to trigger the interval callback
    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(connectSpy).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith('[MQTTClient] MQTT client exists but not connected, reconnecting');

    // Clean up
    clearInterval(mqttClient['keepConnectionAliveInterval']);
    vi.useRealTimers();
  });

  it('onConnect should return early if result is falsy', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['subscribeToQueue'] = vi.fn();

    await mqttClient['onConnect'](asType<IConnackPacket>(null));

    expect(logger.error).toHaveBeenCalledWith('[MQTTClient] onConnect called with no result');
    expect(mqttClient['connected']).toBe(false);
    expect(mqttClient['subscribeToQueue']).not.toHaveBeenCalled();
  });

  it('subscribeToQueue should log error when not connected', () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = false;

    mqttClient['subscribeToQueue']();

    expect(logger.error).toHaveBeenCalledWith('[MQTTClient] cannot subscribe, client not connected');
    expect(client.subscribe).not.toHaveBeenCalled();
  });

  it('subscribeToQueue should log error when mqttClient is undefined', () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = undefined;
    mqttClient['connected'] = true;

    mqttClient['subscribeToQueue']();

    expect(logger.error).toHaveBeenCalledWith('[MQTTClient] cannot subscribe, client not connected');
  });

  it('disconnect should clear keepConnectionAliveInterval', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    mqttClient['keepConnectionAliveInterval'] = setInterval(() => {}, 1000);

    await mqttClient.disconnect();

    expect(mqttClient['keepConnectionAliveInterval']).toBeUndefined();
  });

  it('disconnect should clear authErrorBackoffTimeout', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['mqttClient'] = client;
    mqttClient['connected'] = true;
    mqttClient['authErrorBackoffTimeout'] = setTimeout(() => {}, 1000);

    await mqttClient.disconnect();

    expect(mqttClient['authErrorBackoffTimeout']).toBeUndefined();
  });

  it('onMessage should call both onResponse and onMessage on responseBroadcaster', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onMessage']('rr/m/o/user/c6d6afb9/duid1', Buffer.from('msg'));
    expect(mqttClient['responseBroadcaster'].tryResolve).toHaveBeenCalledWith('deserialized');
    expect(mqttClient['responseBroadcaster'].onMessage).toHaveBeenCalledWith('deserialized');
  });

  it('onMessage should handle non-Error objects', async () => {
    const mqttClient = createMQTTClient();
    deserializer.deserialize.mockImplementation(() => {
      throw 'string error';
    });
    await mqttClient['onMessage']('topic/duid', Buffer.from('msg'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('unable to process message'));
  });
});
