import { UserData, ClientRouter, RequestMessage } from '../../../roborockCommunication/index.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ClientRouter', () => {
  let mockLogger: any;
  let mockUserData: UserData;

  let mockMQTTClient: any;
  let mockLocalNetworkClient: any;

  beforeEach(() => {
    mockLogger = { debug: vi.fn(), notice: vi.fn() };
    mockUserData = {
      uid: '123',
      token: '123:123/lfrZhw==:123',
      tokentype: 'Bearer',
      rruid: '123',
      region: 'eu',
      countrycode: '33',
      country: 'FR',
      nickname: '123',
      rriot: {
        u: '123',
        s: '123',
        h: '123',
        k: '123',
        r: {
          r: 'EU',
          a: 'https://api-eu.roborock.com',
          m: 'ssl://mqtt-eu-2.roborock.com:8883',
          l: 'https://wood-eu.roborock.com',
        },
      },
    };

    mockMQTTClient = {
      isConnected: vi.fn().mockReturnValue(true),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockLocalNetworkClient = {
      isConnected: vi.fn().mockReturnValue(true),
      isReady: vi.fn().mockReturnValue(true),
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      get: vi.fn(),
    };
  });

  it('registerConnectionListener should call connectionListeners.register', () => {
    const router = new ClientRouter(mockLogger, mockUserData);
    const listener = {};
    const spy = vi.spyOn(router.connectionListeners, 'register');
    router.registerConnectionListener(listener as any);
    expect(spy).toHaveBeenCalledWith(listener);
  });

  it('registerMessageListener should call messageListeners.register', () => {
    const router = new ClientRouter(mockLogger, mockUserData);
    const listener = {};
    const spy = vi.spyOn(router.messageListeners, 'register');
    router.registerMessageListener(listener as any);
    expect(spy).toHaveBeenCalledWith(listener);
  });

  it('isConnected should return mqttClient.isConnected', () => {
    const router = new ClientRouter(mockLogger, mockUserData);
    mockMQTTClient = {
      isConnected: vi.fn().mockReturnValue(true),
    };
    router.mqttClient = mockMQTTClient;
    expect(router.isConnected()).toBe(true);
  });

  it('connect should call connect on mqttClient and all localClients', () => {
    const router = new ClientRouter(mockLogger, mockUserData);
    router.mqttClient = mockMQTTClient;

    router.registerClient('duid', '127.0.0.1');
    router.localClients.set('duid', mockLocalNetworkClient);

    router.connect();
    expect(mockMQTTClient.connect).toHaveBeenCalled();
    expect(mockLocalNetworkClient.connect).toHaveBeenCalled();
  });

  it('disconnect should call disconnect on mqttClient and all localClients', async () => {
    const router = new ClientRouter(mockLogger, mockUserData);
    router.registerClient('duid', '127.0.0.1');
    mockMQTTClient = {
      isConnected: vi.fn().mockReturnValue(false),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    router.mqttClient = mockMQTTClient;

    router.localClients.set('duid', mockLocalNetworkClient);

    await router.disconnect();
    expect(mockMQTTClient.disconnect).toHaveBeenCalled();
    expect(mockLocalNetworkClient.disconnect).toHaveBeenCalled();
  });

  it('send should use mqttClient for secure requests', async () => {
    mockMQTTClient = {
      isConnected: vi.fn().mockReturnValue(false),
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
    };

    const router = new ClientRouter(mockLogger, mockUserData);
    const request: RequestMessage = { secure: true } as any;

    router.mqttClient = mockMQTTClient;
    await router.send('duid', request);
    expect(mockMQTTClient.send).toHaveBeenCalledWith('duid', request);
  });

  it('send should use localClient for non-secure requests', async () => {
    const router = new ClientRouter(mockLogger, mockUserData);
    router.registerClient('duid', '127.0.0.1');
    const request: RequestMessage = { secure: false } as any;
    router.localClients.set('duid', mockLocalNetworkClient);
    await router.send('duid', request);
    expect(mockLocalNetworkClient.send).toHaveBeenCalledWith('duid', request);
  });

  it('get should use mqttClient for secure requests', async () => {
    const router = new ClientRouter(mockLogger, mockUserData);
    const request: RequestMessage = { secure: true } as any;

    mockMQTTClient = {
      isConnected: vi.fn().mockReturnValue(false),
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      get: vi.fn(),
    };
    router.mqttClient = mockMQTTClient;
    await router.get('duid', request);
    expect(mockMQTTClient.get).toHaveBeenCalledWith('duid', request);
  });

  it('get should use localClient for non-secure requests', async () => {
    const router = new ClientRouter(mockLogger, mockUserData);
    router.registerClient('duid', '127.0.0.1');
    const request: RequestMessage = { secure: false } as any;
    router.localClients.set('duid', mockLocalNetworkClient);
    await router.get('duid', request);
    expect(mockLocalNetworkClient.get).toHaveBeenCalledWith('duid', request);
  });

  it('getClient should return localClient if connected', () => {
    const router = new ClientRouter(mockLogger, mockUserData);
    router.registerClient('duid', '127.0.0.1');
    router.localClients.set('duid', mockLocalNetworkClient);
    expect(router.getClient('duid')).toBe(mockLocalNetworkClient);
  });

  it('getClient should return mqttClient if localClient not connected', () => {
    mockLocalNetworkClient.isConnected.mockReturnValue(false);
    const router = new ClientRouter(mockLogger, mockUserData);
    router.registerClient('duid', '127.0.0.1');
    router.mqttClient = mockMQTTClient;
    expect(router.getClient('duid')).toBe(mockMQTTClient);
  });
});
