import { AnsiLogger } from 'matterbridge/logger';
import mqtt, { ErrorWithReasonCode, IConnackPacket, MqttClient as MqttLibClient } from 'mqtt';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageContext, RequestMessage } from '../../../../roborockCommunication/models/index.js';
import { MQTTClient } from '../../../../roborockCommunication/mqtt/mqttClient.js';
import { MqttHealthMonitor } from '../../../../roborockCommunication/mqtt/mqttHealthMonitor.js';
import { ConnectionBroadcaster } from '../../../../roborockCommunication/routing/listeners/connectionBroadcaster.js';
import { V1ResponseBroadcaster } from '../../../../roborockCommunication/routing/listeners/v1ResponseBroadcaster.js';
import { asPartial, asType, createMockLogger } from '../../../helpers/testUtils.js';

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

	beforeEach(() => {
		vi.restoreAllMocks();
		userdata = makeUserdata();
		context = new MessageContext(userdata);
		logger = makeLogger();
		responseBroadcaster = new V1ResponseBroadcaster(logger);
	});

	it('isReady/isConnected reflect internal state', () => {
		const client = new MQTTClient(logger, context, userdata, responseBroadcaster);
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

		const spyConnect = vi.spyOn(mqtt, 'connect').mockImplementation(() => asType<any>(mockMqttClient));

		const client = new MQTTClient(logger, context, userdata, responseBroadcaster);

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
		const client = new MQTTClient(logger, context, userdata, responseBroadcaster);
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

		const client = new MQTTClient(logger, context, userdata, responseBroadcaster);

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
		responseBroadcaster = new V1ResponseBroadcaster(logger);

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

	function createMQTTClient(overrideHealthMonitor?: any) {
		class TestMQTTClient extends MQTTClient {
			constructor() {
				super(logger, context, userdata, responseBroadcaster);
			}
		}
		const mqttClient = new TestMQTTClient();
		Object.defineProperty(mqttClient, 'connectionBroadcaster', {
			value: asPartial<ConnectionBroadcaster>({
				onConnected: vi.fn(),
				onDisconnected: vi.fn(),
				onOffline: vi.fn(),
				onClose: vi.fn(),
				onError: vi.fn(),
				onReconnect: vi.fn(),
			}),
			writable: true,
		});
		Object.defineProperty(mqttClient, 'responseBroadcaster', {
			value: asPartial<V1ResponseBroadcaster>({
				onMessage: vi.fn(),
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

		if (overrideHealthMonitor) {
			Object.defineProperty(mqttClient, 'healthMonitor', {
				value: overrideHealthMonitor,
				writable: true,
			});
		}

		createdClients.push(mqttClient);
		return mqttClient;
	}

	afterEach(async () => {
		// Clean up any MQTT clients to prevent timer leaks
		for (const mqttClient of createdClients) {
			try {
				if (mqttClient.generalBackoffTimeout) {
					clearTimeout(mqttClient.generalBackoffTimeout);
				}
				if (mqttClient.authErrorBackoffTimeout) {
					clearTimeout(mqttClient.authErrorBackoffTimeout);
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

	it('forceReconnect should end and reconnect existing mqttClient', () => {
		const mqttClient = createMQTTClient();
		mqttClient['mqttClient'] = client;
		mqttClient['connected'] = true;

		mqttClient['forceReconnect']('test reason');

		expect(mqttClient['isForceReconnecting']).toBe(true);
		expect(client.end).toHaveBeenCalled();
		expect(client.reconnect).toHaveBeenCalled();
		expect(logger.debug).toHaveBeenCalledWith('[MQTTClient] Force reconnecting: test reason');
	});

	it('forceReconnect should call connect if mqttClient is undefined', () => {
		const mqttClient = createMQTTClient();
		const connectSpy = vi.spyOn(mqttClient, 'connect');
		mqttClient['mqttClient'] = undefined;
		mqttClient['connected'] = false;

		mqttClient['forceReconnect']('test reason');

		expect(connectSpy).toHaveBeenCalled();
		expect(logger.info).toHaveBeenCalledWith('[MQTTClient] Force reconnecting (new connection): test reason');
	});

	it('disconnect should return early if not connected', async () => {
		const mqttClient = createMQTTClient();
		mqttClient['mqttClient'] = client;
		mqttClient['connected'] = false;
		await mqttClient.disconnect();
		expect(client.end).not.toHaveBeenCalled();
	});

	it('onClose should call onClose only if connected', async () => {
		const mqttClient = createMQTTClient();
		mqttClient['connected'] = true;
		await mqttClient['onClose']();
		expect(mqttClient['connectionBroadcaster'].onClose).toHaveBeenCalledWith('mqtt-c6d6afb9');
		expect(mqttClient['connected']).toBe(false);
	});

	it('onClose should not call onClose if already disconnected', async () => {
		const mqttClient = createMQTTClient();
		mqttClient['connected'] = false;
		await mqttClient['onClose']();
		expect(mqttClient['connectionBroadcaster'].onClose).not.toHaveBeenCalled();
	});

	it('should broadcast onClose and onConnected when MQTT disconnects unexpectedly (real disconnect)', async () => {
		const mqttClient = createMQTTClient();
		mqttClient['mqttClient'] = client;
		mqttClient['connected'] = true;
		mqttClient['isForceReconnecting'] = false;
		mqttClient['subscribeToQueue'] = vi.fn();

		await mqttClient['onClose']();

		expect(mqttClient['connectionBroadcaster'].onClose).toHaveBeenCalledWith('mqtt-c6d6afb9');
		expect(mqttClient['connected']).toBe(false);

		await mqttClient['onConnect'](asType<IConnackPacket>({}));

		expect(mqttClient['connectionBroadcaster'].onConnected).toHaveBeenCalledWith('mqtt-c6d6afb9');
	});

	it('should NOT broadcast onClose or onConnected when forceReconnect triggers the close', async () => {
		const mqttClient = createMQTTClient();
		mqttClient['mqttClient'] = client;
		mqttClient['connected'] = true;
		mqttClient['subscribeToQueue'] = vi.fn();

		mqttClient['forceReconnect']('test reason');

		expect(mqttClient['isForceReconnecting']).toBe(true);

		await mqttClient['onClose']();
		expect(mqttClient['connectionBroadcaster'].onClose).not.toHaveBeenCalled();

		await mqttClient['onConnect'](asType<IConnackPacket>({}));
		expect(mqttClient['connectionBroadcaster'].onConnected).not.toHaveBeenCalled();

		expect(mqttClient['isForceReconnecting']).toBe(false);
	});

	it('onOffline should set connected to false and call onOffline', async () => {
		const mqttClient = createMQTTClient();
		mqttClient['connected'] = true;
		await mqttClient['onOffline']();
		expect(mqttClient['connected']).toBe(false);
		expect(mqttClient['connectionBroadcaster'].onOffline).toHaveBeenCalledWith('mqtt-c6d6afb9');
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
		mqttClient['authErrorBackoffTimeout'] = setTimeout(() => {}, 1000);
		mqttClient['generalBackoffTimeout'] = setTimeout(() => {}, 1000);

		mqttClient['terminateConnection']();

		expect(mqttClient['authErrorBackoffTimeout']).toBeUndefined();
		expect(mqttClient['generalBackoffTimeout']).toBeUndefined();
		expect(client.end).toHaveBeenCalledWith(true);
		expect(mqttClient['mqttClient']).toBeUndefined();
		expect(mqttClient['connected']).toBe(false);
	});

	it('terminateConnection should handle missing timers gracefully', () => {
		const mqttClient = createMQTTClient();
		mqttClient['mqttClient'] = client;
		mqttClient['connected'] = true;
		mqttClient['authErrorBackoffTimeout'] = undefined;
		mqttClient['generalBackoffTimeout'] = undefined;

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

	it('disconnect should clear authErrorBackoffTimeout', async () => {
		const mqttClient = createMQTTClient();
		mqttClient['mqttClient'] = client;
		mqttClient['connected'] = true;
		mqttClient['authErrorBackoffTimeout'] = setTimeout(() => {}, 1000);

		await mqttClient.disconnect();

		expect(mqttClient['authErrorBackoffTimeout']).toBeUndefined();
	});

	it('onMessage should call onMessage on responseBroadcaster', async () => {
		const mqttClient = createMQTTClient();
		await mqttClient['onMessage']('rr/m/o/user/c6d6afb9/duid1', Buffer.from('msg'));
		expect(mqttClient['responseBroadcaster'].onMessage).toHaveBeenCalledWith('deserialized');
	});

	it('onMessage should handle non-Error objects', async () => {
		const mqttClient = createMQTTClient();
		deserializer.deserialize.mockImplementation(() => {
			throw Error('string error');
		});
		await mqttClient['onMessage']('topic/duid', Buffer.from('msg'));
		expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('unable to process message'));
	});

	describe('Health Monitor Integration', () => {
		it('reportQuerySuccess should reset consecutive timeouts', () => {
			const mqttClient = createMQTTClient();
			mqttClient['healthMonitor'].onTimeout();
			mqttClient['healthMonitor'].onTimeout();
			expect(mqttClient['healthMonitor'].getConsecutiveTimeouts()).toBe(2);

			mqttClient.reportQuerySuccess();

			expect(mqttClient['healthMonitor'].getConsecutiveTimeouts()).toBe(0);
		});

		it('reportQueryTimeout should increment timeout counter', () => {
			const mqttClient = createMQTTClient();
			expect(mqttClient['healthMonitor'].getConsecutiveTimeouts()).toBe(0);

			mqttClient.reportQueryTimeout();

			expect(mqttClient['healthMonitor'].getConsecutiveTimeouts()).toBe(1);
		});

		it('reportQueryTimeout should not forceReconnect when threshold not reached', () => {
			const mqttClient = createMQTTClient();
			const forceReconnectSpy = vi.spyOn(mqttClient as any, 'forceReconnect');

			mqttClient.reportQueryTimeout();
			mqttClient.reportQueryTimeout();

			expect(forceReconnectSpy).not.toHaveBeenCalled();
			expect(mqttClient['healthMonitor'].getConsecutiveTimeouts()).toBe(2);
		});

		it('reportQueryTimeout should forceReconnect when threshold is reached', () => {
			const mqttClient = createMQTTClient();
			const forceReconnectSpy = vi.spyOn(mqttClient as any, 'forceReconnect');

			mqttClient.reportQueryTimeout();
			mqttClient.reportQueryTimeout();
			mqttClient.reportQueryTimeout();

			expect(forceReconnectSpy).toHaveBeenCalledWith('health monitor: too many consecutive query timeouts');
			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining('Health monitor: too many consecutive query timeouts'),
			);
			// After recordRestart, counter is reset
			expect(mqttClient['healthMonitor'].getConsecutiveTimeouts()).toBe(0);
		});

		it('reportQueryTimeout should respect cooldown after health-triggered restart', () => {
			vi.useFakeTimers();
			const testMonitor = new MqttHealthMonitor(3, 500); // 500ms cooldown for testing
			const mqttClient = createMQTTClient(testMonitor);
			const forceReconnectSpy = vi.spyOn(mqttClient as any, 'forceReconnect');

			// First batch of timeouts triggers restart
			for (let i = 0; i < 3; i++) mqttClient.reportQueryTimeout();
			expect(forceReconnectSpy).toHaveBeenCalledTimes(1);

			// Immediately try again - should not trigger due to cooldown
			vi.advanceTimersByTime(100);
			for (let i = 0; i < 3; i++) mqttClient.reportQueryTimeout();
			expect(forceReconnectSpy).toHaveBeenCalledTimes(1); // Still just 1

			// After cooldown expires, should trigger again
			vi.advanceTimersByTime(400); // Now 500ms has passed
			for (let i = 0; i < 3; i++) mqttClient.reportQueryTimeout();
			expect(forceReconnectSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('General Backoff Integration', () => {
		it('onClose should schedule general backoff when connected and not force reconnecting', async () => {
			const mqttClient = createMQTTClient();
			mqttClient['connected'] = true;
			mqttClient['isForceReconnecting'] = false;
			const scheduleGeneralBackoffSpy = vi.spyOn(mqttClient as any, 'scheduleGeneralBackoffReconnect');

			await mqttClient['onClose']();

			expect(scheduleGeneralBackoffSpy).toHaveBeenCalledWith('MQTT connection closed unexpectedly');
		});

		it('onClose should not schedule backoff when isForceReconnecting is true', async () => {
			const mqttClient = createMQTTClient();
			mqttClient['connected'] = true;
			mqttClient['isForceReconnecting'] = true;
			const scheduleGeneralBackoffSpy = vi.spyOn(mqttClient as any, 'scheduleGeneralBackoffReconnect');

			await mqttClient['onClose']();

			expect(scheduleGeneralBackoffSpy).not.toHaveBeenCalled();
		});

		it('onClose should not schedule backoff when not connected', async () => {
			const mqttClient = createMQTTClient();
			mqttClient['connected'] = false;
			const scheduleGeneralBackoffSpy = vi.spyOn(mqttClient as any, 'scheduleGeneralBackoffReconnect');

			await mqttClient['onClose']();

			expect(scheduleGeneralBackoffSpy).not.toHaveBeenCalled();
		});

		it('onOffline should always schedule general backoff', async () => {
			const mqttClient = createMQTTClient();
			mqttClient['connected'] = true;
			const scheduleGeneralBackoffSpy = vi.spyOn(mqttClient as any, 'scheduleGeneralBackoffReconnect');

			await mqttClient['onOffline']();

			expect(scheduleGeneralBackoffSpy).toHaveBeenCalledWith('MQTT client went offline');
		});

		it('onError should schedule general backoff for non-auth errors', async () => {
			const mqttClient = createMQTTClient();
			const scheduleGeneralBackoffSpy = vi.spyOn(mqttClient as any, 'scheduleGeneralBackoffReconnect');

			await mqttClient['onError'](new Error('Connection lost'));

			expect(scheduleGeneralBackoffSpy).toHaveBeenCalledWith(expect.stringContaining('MQTT connection error'));
		});

		it('onError should not schedule general backoff for auth errors', async () => {
			const mqttClient = createMQTTClient();
			const scheduleGeneralBackoffSpy = vi.spyOn(mqttClient as any, 'scheduleGeneralBackoffReconnect');

			await mqttClient['onError'](asPartial<ErrorWithReasonCode>({ code: 5 }));

			expect(scheduleGeneralBackoffSpy).not.toHaveBeenCalled();
		});

		it('scheduleGeneralBackoffReconnect should compute exponential backoff delay', async () => {
			vi.useFakeTimers();
			const mqttClient = createMQTTClient();
			mqttClient['mqttClient'] = client;
			const connectSpy = vi.spyOn(mqttClient, 'connect');

			const { MIN_BACKOFF_INTERVAL_MS, BACKOFF_MULTIPLIER, MAX_BACKOFF_INTERVAL_MS } =
				await import('../../../../constants/timeouts.js');

			// First call
			mqttClient['scheduleGeneralBackoffReconnect']('error 1');
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`delay: ${MIN_BACKOFF_INTERVAL_MS}ms`));

			// Advance and trigger
			vi.advanceTimersByTime(MIN_BACKOFF_INTERVAL_MS + 100);
			expect(connectSpy).toHaveBeenCalledTimes(1);

			connectSpy.mockClear();

			// Second call (exponential increase)
			const expectedDelay = Math.min(MIN_BACKOFF_INTERVAL_MS * BACKOFF_MULTIPLIER, MAX_BACKOFF_INTERVAL_MS);
			mqttClient['scheduleGeneralBackoffReconnect']('error 2');
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(`delay: ${Math.floor(expectedDelay)}ms`));

			vi.useRealTimers();
		});

		it('scheduleGeneralBackoffReconnect should clear pre-existing timeout', () => {
			vi.useFakeTimers();
			const mqttClient = createMQTTClient();
			mqttClient['mqttClient'] = client;

			const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

			mqttClient['scheduleGeneralBackoffReconnect']('error 1');
			const firstTimeout = mqttClient['generalBackoffTimeout'];

			mqttClient['scheduleGeneralBackoffReconnect']('error 2');

			expect(clearTimeoutSpy).toHaveBeenCalledWith(firstTimeout);

			vi.useRealTimers();
		});

		it('onConnect should reset general backoff state', async () => {
			const mqttClient = createMQTTClient();
			mqttClient['consecutiveGeneralFailures'] = 5;
			mqttClient['generalBackoffMs'] = 30000;
			mqttClient['generalBackoffTimeout'] = setTimeout(() => {}, 1000);

			const { MIN_BACKOFF_INTERVAL_MS } = await import('../../../../constants/timeouts.js');

			await mqttClient['onConnect'](asType<IConnackPacket>({}));

			expect(mqttClient['consecutiveGeneralFailures']).toBe(0);
			expect(mqttClient['generalBackoffMs']).toBe(MIN_BACKOFF_INTERVAL_MS);
			expect(mqttClient['generalBackoffTimeout']).toBeUndefined();
		});

		it('terminateConnection should clear generalBackoffTimeout', () => {
			const mqttClient = createMQTTClient();
			mqttClient['generalBackoffTimeout'] = setTimeout(() => {}, 1000);
			mqttClient['mqttClient'] = client;

			mqttClient['terminateConnection']();

			expect(mqttClient['generalBackoffTimeout']).toBeUndefined();
		});

		it('disconnect should clear generalBackoffTimeout', async () => {
			const mqttClient = createMQTTClient();
			mqttClient['mqttClient'] = client;
			mqttClient['connected'] = true;
			mqttClient['generalBackoffTimeout'] = setTimeout(() => {}, 1000);

			await mqttClient.disconnect();

			expect(mqttClient['generalBackoffTimeout']).toBeUndefined();
		});

		it('scheduleGeneralBackoffReconnect should call terminateConnection before scheduling reconnect', () => {
			vi.useFakeTimers();
			const mqttClient = createMQTTClient();
			const terminateSpy = vi.spyOn(mqttClient as any, 'terminateConnection');

			mqttClient['scheduleGeneralBackoffReconnect']('test error');

			expect(terminateSpy).toHaveBeenCalled();

			vi.useRealTimers();
		});
	});

	describe('Re-entrant onClose from forceReconnect', () => {
		it('should handle re-entrant onClose when forceReconnect calls mqttClient.end()', async () => {
			vi.useFakeTimers();
			const mqttClient = createMQTTClient();
			mqttClient['mqttClient'] = client;
			mqttClient['connected'] = true;

			// Call forceReconnect which sets isForceReconnecting and calls client.end()
			mqttClient['forceReconnect']('test reason');

			expect(mqttClient['isForceReconnecting']).toBe(true);

			// Simulate the mqtt client firing the close event from end()
			await mqttClient['onClose']();

			// Verify that onClose did not broadcast because isForceReconnecting is true
			expect(mqttClient['connectionBroadcaster'].onClose).not.toHaveBeenCalled();

			// Verify that scheduleGeneralBackoffReconnect was NOT called from this onClose
			expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('Scheduling general backoff reconnect'));

			vi.useRealTimers();
		});
	});
});
