import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RequestMessage, UserData } from '../../../roborockCommunication/models/index.js';
import { ClientRouter } from '../../../roborockCommunication/routing/clientRouter.js';
import { AbstractConnectionListener } from '../../../roborockCommunication/routing/listeners/abstractConnectionListener.js';
import { AbstractMessageListener } from '../../../roborockCommunication/routing/listeners/abstractMessageListener.js';
import { asPartial, asType } from '../../testUtils.js';

describe('ClientRouter', () => {
	let mockLogger: any;
	let mockUserData: UserData;

	afterEach(() => {
		vi.useRealTimers();
	});

	let mockMQTTClient: any;
	let mockLocalNetworkClient: any;

	beforeEach(() => {
		mockLogger = { debug: vi.fn(), notice: vi.fn(), error: vi.fn(), warn: vi.fn() };
		mockUserData = {
			username: 'testuser',
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

	it('registerConnectionListener should call connectionListener.register', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		const listener = asType<AbstractConnectionListener>({});
		const spy = vi.spyOn(router['connectionBroadcaster'], 'register');
		router.registerConnectionListener(listener);
		expect(spy).toHaveBeenCalledWith(listener);
	});

	it('registerMessageListener should call responseBroadcaster.register', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		const listener = asType<AbstractMessageListener>({});
		const spy = vi.spyOn(router['broadcasterFactory'], 'register');
		router.registerMessageListener(listener);
		expect(spy).toHaveBeenCalledWith(listener);
	});

	it('isConnected should return mqttClient.isConnected', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		mockMQTTClient = {
			isConnected: vi.fn().mockReturnValue(true),
		};
		router['mqttClient'] = mockMQTTClient;
		expect(router.isConnected()).toBe(true);
	});

	it('connect should call connect on mqttClient and all localClients', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		router['mqttClient'] = mockMQTTClient;

		router.registerClient('duid', '127.0.0.1');
		router['localClients'].set('duid', mockLocalNetworkClient);

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
		router['mqttClient'] = mockMQTTClient;

		router['localClients'].set('duid', mockLocalNetworkClient);

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
		const request = asPartial<RequestMessage>({ secure: true });

		router['mqttClient'] = mockMQTTClient;
		await router.send('duid', request);
		expect(mockMQTTClient.send).toHaveBeenCalledWith('duid', request);
	});

	it('send should use localClient for non-secure requests', async () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		router.registerClient('duid', '127.0.0.1');
		const request = asPartial<RequestMessage>({ secure: false });
		router['localClients'].set('duid', mockLocalNetworkClient);
		await router.send('duid', request);
		expect(mockLocalNetworkClient.send).toHaveBeenCalledWith('duid', request);
	});

	it('getLocalClient should return localClient if connected', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		router.registerClient('duid', '127.0.0.1');
		router['localClients'].set('duid', mockLocalNetworkClient);
		expect(router['getLocalClient']('duid')).toBe(mockLocalNetworkClient);
	});

	it('getLocalClient should return mqttClient if localClient not connected', () => {
		mockLocalNetworkClient.isConnected.mockReturnValue(false);
		const router = new ClientRouter(mockLogger, mockUserData);
		router.registerClient('duid', '127.0.0.1');
		router['mqttClient'] = mockMQTTClient;
		expect(router['getLocalClient']('duid')).toBe(mockMQTTClient);
	});

	it('getLocalClient should return mqttClient when localClient isReady returns false', () => {
		mockLocalNetworkClient.isReady = vi.fn().mockReturnValue(false);
		const router = new ClientRouter(mockLogger, mockUserData);
		router['mqttClient'] = mockMQTTClient;
		router['localClients'].set('duid', mockLocalNetworkClient);
		expect(router['getLocalClient']('duid')).toBe(mockMQTTClient);
	});

	it('getLocalClient should return mqttClient when no localClient is registered for duid', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		router['mqttClient'] = mockMQTTClient;
		expect(router['getLocalClient']('unknown-duid')).toBe(mockMQTTClient);
	});

	it('registerDevice should delegate to context', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		const spy = vi.spyOn(router['context'], 'registerDevice');
		router.registerDevice('duid', 'localKey', '1.0', 12345);
		expect(spy).toHaveBeenCalledWith('duid', 'localKey', '1.0', 12345);
	});

	it('updateNonce should delegate to context', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		const spy = vi.spyOn(router['context'], 'updateNonce');
		router.updateNonce('duid', 99);
		expect(spy).toHaveBeenCalledWith('duid', 99);
	});

	it('isReady should return mqttClient.isReady', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		mockMQTTClient = { isReady: vi.fn().mockReturnValue(true) };
		router['mqttClient'] = mockMQTTClient;
		expect(router.isReady()).toBe(true);
		expect(mockMQTTClient.isReady).toHaveBeenCalled();
	});

	it('unregisterClient should remove client from localClients', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		router.registerClient('duid', '127.0.0.1');
		expect(router['localClients'].has('duid')).toBe(true);
		router.unregisterClient('duid');
		expect(router['localClients'].has('duid')).toBe(false);
	});

	it('query should return undefined and log on timeout', async () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		router['mqttClient'] = { ...mockMQTTClient, isReady: vi.fn().mockReturnValue(false), send: vi.fn() };

		const request = asPartial<RequestMessage>({ secure: true, messageId: 1 });
		const result = await router.query('duid', request, () => undefined, 1);

		expect(result).toBeUndefined();
		expect(mockLogger.error).toHaveBeenCalled();
	});

	it('query should resolve via responseBroadcaster', async () => {
		vi.useFakeTimers();
		const router = new ClientRouter(mockLogger, mockUserData);
		router['mqttClient'] = {
			...mockMQTTClient,
			isReady: vi.fn().mockReturnValue(false),
			send: vi.fn(),
		};

		const request = asPartial<RequestMessage>({ secure: true, messageId: 42 });
		const parseFn = vi.fn().mockReturnValue('parsed');

		const queryPromise = router.query('duid', request, parseFn, 5000);

		// Simulate a matching message arriving on the broadcaster
		const { OneShotResponseListener } =
			await import('../../../roborockCommunication/routing/listeners/oneShotResponseListener.js');
		const listeners = (router['broadcasterFactory'] as any)['v1Broadcaster']['listeners'] as InstanceType<
			typeof OneShotResponseListener<string>
		>[];
		const listener = listeners.find((l) => l.duid === 'duid');
		if (!listener) throw new Error('listener not registered');
		const { ResponseMessage, HeaderMessage, ResponseBody } =
			await import('../../../roborockCommunication/models/index.js');
		const msg = new ResponseMessage(
			'duid',
			new HeaderMessage('1.0', 1, 0, 101, 102),
			new ResponseBody({ '102': { id: 42, result: ['ok'] } }),
		);
		await listener.onMessage(msg);

		await expect(queryPromise).resolves.toBe('parsed');
	});

	it('getLocalClient should return mqttClient when LocalNetworkClient isReconnecting', () => {
		const router = new ClientRouter(mockLogger, mockUserData);
		router['mqttClient'] = mockMQTTClient;
		const localClient = router.registerClient('duid', '127.0.0.1');
		(localClient as unknown as { intentionalDisconnect: boolean }).intentionalDisconnect = true;
		expect(router['getLocalClient']('duid')).toBe(mockMQTTClient);
	});
});
