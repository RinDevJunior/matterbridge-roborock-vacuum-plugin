import { MQTTClient } from '../../../../roborockCommunication/broadcast/client/MQTTClient';
import mqtt from 'mqtt';

// Pseudocode plan:
// 1. Mock dependencies: mqtt, CryptoUtils, AbstractClient, serializer, deserializer, logger, connectionListeners, messageListeners.
// 2. Test constructor: verify username/password are generated as expected.
// 3. Test connect():
//    - Should call mqtt.connect with correct params.
//    - Should set up event listeners.
//    - Should not connect if already connected.
// 4. Test disconnect():
//    - Should call client.end if connected.
//    - Should not call if not connected.
//    - Should log error if exception thrown.
// 5. Test send():
//    - Should publish correct topic/message if connected.
//    - Should log error if not connected.
// 6. Test onConnect():
//    - Should set connected, call onConnected, subscribeToQueue.
// 7. Test subscribeToQueue():
//    - Should call client.subscribe with correct topic.
// 8. Test onSubscribe():
//    - Should log error and call onDisconnected if error.
//    - Should do nothing if no error.
// 9. Test onDisconnect():
//    - Should call onDisconnected.
// 10. Test onError():
//    - Should log error, set connected false, call onError.
// 11. Test onReconnect():
//    - Should call subscribeToQueue.
// 12. Test onMessage():
//    - Should call deserializer and messageListeners.onMessage if message.
//    - Should log notice if message is falsy.
//    - Should log error if deserializer throws.

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

  beforeEach(() => {
    logger = { error: jest.fn(), debug: jest.fn(), notice: jest.fn() };
    context = {};
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
    };
    messageListeners = { onMessage: jest.fn().mockResolvedValue(undefined) };

    // Mock mqtt client instance
    client = {
      on: jest.fn(),
      end: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
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
    return new TestMQTTClient();
  }

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate username and password in constructor', () => {
    const mqttClient = createMQTTClient();
    expect(mqttClient['mqttUsername']).toBe('c6d6afb9');
    expect(mqttClient['mqttPassword']).toBe('938f62d6603bde9c');
  });

  it('should not connect if already connected', () => {
    const mqttClient = createMQTTClient();
    mqttClient['client'] = client;
    mqttClient.connect();
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('should disconnect if connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['client'] = client;
    mqttClient['connected'] = true;
    await mqttClient.disconnect();
    expect(client.end).toHaveBeenCalled();
  });

  it('should not disconnect if not connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['client'] = undefined;
    mqttClient['connected'] = false;
    await mqttClient.disconnect();
    expect(client.end).not.toHaveBeenCalled();
  });

  it('should log error if disconnect throws', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['client'] = {
      end: jest.fn(() => {
        throw new Error('fail');
      }),
      on: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      connected: true,
      disconnecting: false,
      disconnected: false,
      reconnecting: false,
      options: {},
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      addListener: jest.fn(),
      emit: jest.fn(),
      eventNames: jest.fn(),
      getMaxListeners: jest.fn(),
      listenerCount: jest.fn(),
      listeners: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      rawListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      handleMessage: jest.fn(),
      subscribeAsync: jest.fn(),
      unsubscribe: jest.fn(),
      unsubscribeAsync: jest.fn(),
      publishAsync: jest.fn(),
      reconnect: jest.fn(),
      destroy: jest.fn(),
      removeOutgoingMessage: jest.fn(),
      connectedTime: 0,
      disconnect: jest.fn(),
      stream: {} as any,
      messageIdToTopic: {},
      outgoingStore: {} as any,
      incomingStore: {} as any,
      queueQoSZero: jest.fn(),
      _resubscribeTopics: {},
      _resubscribeTopicsList: [],
      _resubscribeTopicsMap: {},
      _resubscribeTopicsTimer: null,
      _resubscribeTopicsTimeout: 0,
      _resubscribeTopicsInProgress: false,
      _resubscribeTopicsCallback: jest.fn(),
      _resubscribeTopicsError: null,
      _resubscribeTopicsErrorCallback: jest.fn(),
      _resubscribeTopicsErrorTimer: null,
      _resubscribeTopicsErrorTimeout: 0,
      _resubscribeTopicsErrorInProgress: false,
      _resubscribeTopicsErrorCallback2: jest.fn(),
      _resubscribeTopicsError2: null,
      _resubscribeTopicsErrorTimer2: null,
      _resubscribeTopicsErrorTimeout2: 0,
      _resubscribeTopicsErrorInProgress2: false,
      _resubscribeTopicsErrorCallback3: jest.fn(),
      _resubscribeTopicsError3: null,
      _resubscribeTopicsErrorTimer3: null,
      _resubscribeTopicsErrorTimeout3: 0,
      _resubscribeTopicsErrorInProgress3: false,
      _resubscribeTopicsErrorCallback4: jest.fn(),
      _resubscribeTopicsError4: null,
      _resubscribeTopicsErrorTimer4: null,
      _resubscribeTopicsErrorTimeout4: 0,
      _resubscribeTopicsErrorInProgress4: false,
      _resubscribeTopicsErrorCallback5: jest.fn(),
      _resubscribeTopicsError5: null,
      _resubscribeTopicsErrorTimer5: null,
      _resubscribeTopicsErrorTimeout5: 0,
      _resubscribeTopicsErrorInProgress5: false,
      _resubscribeTopicsErrorCallback6: jest.fn(),
      _resubscribeTopicsError6: null,
      _resubscribeTopicsErrorTimer6: null,
      _resubscribeTopicsErrorTimeout6: 0,
      _resubscribeTopicsErrorInProgress6: false,
      _resubscribeTopicsErrorCallback7: jest.fn(),
      _resubscribeTopicsError7: null,
      _resubscribeTopicsErrorTimer7: null,
      _resubscribeTopicsErrorTimeout7: 0,
      _resubscribeTopicsErrorInProgress7: false,
      _resubscribeTopicsErrorCallback8: jest.fn(),
      _resubscribeTopicsError8: null,
      _resubscribeTopicsErrorTimer8: null,
      _resubscribeTopicsErrorTimeout8: 0,
      _resubscribeTopicsErrorInProgress8: false,
      _resubscribeTopicsErrorCallback9: jest.fn(),
      _resubscribeTopicsError9: null,
      _resubscribeTopicsErrorTimer9: null,
      _resubscribeTopicsErrorTimeout9: 0,
      _resubscribeTopicsErrorInProgress9: false,
      _resubscribeTopicsErrorCallback10: jest.fn(),
      _resubscribeTopicsError10: null,
      _resubscribeTopicsErrorTimer10: null,
      _resubscribeTopicsErrorTimeout10: 0,
      _resubscribeTopicsErrorInProgress10: false,
      // Add more properties as needed for your codebase or use a proper mock library
    } as any;
    mqttClient['connected'] = true;
    await mqttClient.disconnect();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('MQTT client failed to disconnect'));
  });

  it('should publish message if connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['client'] = client;
    mqttClient['connected'] = true;
    const request = { toMqttRequest: jest.fn(() => 'req') };
    await mqttClient.send('duid1', request as any);
    expect(serializer.serialize).toHaveBeenCalledWith('duid1', 'req');
    expect(client.publish).toHaveBeenCalledWith('rr/m/i/user/c6d6afb9/duid1', Buffer.from('msg'), { qos: 1 });
  });

  it('should log error if send called when not connected', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['client'] = undefined;
    mqttClient['connected'] = false;
    const request = { toMqttRequest: jest.fn() };
    await mqttClient.send('duid1', request as any);
    expect(logger.error).toHaveBeenCalled();
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('onConnect should set connected, call onConnected, and subscribeToQueue', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['client'] = client;
    mqttClient['subscribeToQueue'] = jest.fn();
    await mqttClient['onConnect']({} as any);
    expect(mqttClient['connected']).toBe(true);
    expect(connectionListeners.onConnected).toHaveBeenCalled();
    expect(mqttClient['subscribeToQueue']).toHaveBeenCalled();
  });

  it('subscribeToQueue should call client.subscribe with correct topic', () => {
    const mqttClient = createMQTTClient();
    mqttClient['client'] = client;
    mqttClient['subscribeToQueue']();
    expect(client.subscribe).toHaveBeenCalledWith('rr/m/o/user/c6d6afb9/#', expect.any(Function));
  });

  it('onSubscribe should log error and call onDisconnected if error', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onSubscribe'](new Error('fail'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('failed to subscribe'));
    expect(mqttClient['connected']).toBe(false);
    expect(connectionListeners.onDisconnected).toHaveBeenCalled();
  });

  it('onSubscribe should do nothing if no error', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onSubscribe'](null);
    expect(logger.error).not.toHaveBeenCalled();
    expect(connectionListeners.onDisconnected).not.toHaveBeenCalled();
  });

  it('onDisconnect should call onDisconnected', async () => {
    const mqttClient = createMQTTClient();
    await mqttClient['onDisconnect']();
    expect(connectionListeners.onDisconnected).toHaveBeenCalled();
  });

  it('onError should log error, set connected false, and call onError', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['connected'] = true;
    await mqttClient['onError'](new Error('fail'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('MQTT connection error'));
    expect(mqttClient['connected']).toBe(false);
    expect(connectionListeners.onError).toHaveBeenCalledWith(expect.stringContaining('fail'));
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
    expect(deserializer.deserialize).toHaveBeenCalledWith('duid1', Buffer.from('msg'));
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
});
