import { MQTTClient } from '../../../../roborockCommunication/broadcast/client/MQTTClient';

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
    logger = { error: jest.fn(), debug: jest.fn(), notice: jest.fn(), info: jest.fn() };
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
      onReconnect: jest.fn().mockResolvedValue(undefined),
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
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('MQTT client failed to disconnect'));
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

  it('onError should log error, set connected false, and call onError', async () => {
    const mqttClient = createMQTTClient();
    mqttClient['connected'] = true;
    await mqttClient['onError'](new Error('fail'));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('MQTT connection error'));
    expect(mqttClient['connected']).toBe(false);
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
