import type { ErrorWithReasonCode, IConnackPacket, MqttClient as MqttLibClient } from 'mqtt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BACKOFF_MULTIPLIER, KEEPALIVE_INTERVAL_MS, MIN_BACKOFF_INTERVAL_MS } from '../../../constants/timeouts.js';
import type { MessageContext, UserData } from '../../../roborockCommunication/models/index.js';
import { MQTTClient } from '../../../roborockCommunication/mqtt/mqttClient.js';
import type { ConnectionBroadcaster } from '../../../roborockCommunication/routing/listeners/connectionBroadcaster.js';
import type { ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/responseBroadcaster.js';
import { asPartial, asType, createMockLogger } from '../../helpers/testUtils.js';

const mqttMock = vi.hoisted(() => ({ connect: vi.fn() }));

// The real broker is never contacted: mqtt.connect returns the stub client configured in beforeEach.
vi.mock('mqtt', () => ({ default: { connect: mqttMock.connect } }));

function createUserData(): UserData {
	return asType<UserData>({
		rriot: {
			r: { a: 'https://api.example', m: 'mqtt://broker.example', l: 'l' },
			u: 'uid',
			s: 'sec',
			h: 'h',
			k: 'key',
		},
	});
}

function createMqttLibStub() {
	return asType<MqttLibClient>({
		on: vi.fn(),
		end: vi.fn(),
		publish: vi.fn(),
		subscribe: vi.fn(),
		reconnect: vi.fn(),
	});
}

describe('MQTTClient (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let libStub: MqttLibClient;
	let client: MQTTClient;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		libStub = createMqttLibStub();
		mqttMock.connect.mockReturnValue(libStub);
		const responseBroadcaster = asType<ResponseBroadcaster>({
			register: vi.fn(),
			deregister: vi.fn(),
			onMessage: vi.fn(),
		});
		client = new MQTTClient(mockLogger, asType<MessageContext>({}), createUserData(), responseBroadcaster);
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	describe('disconnect', () => {
		it('should log the thrown value text when end() throws a non-Error', async () => {
			// Arrange
			client.connect();
			client['connected'] = true;
			vi.mocked(libStub.end).mockImplementation(() => {
				throw asType<Error>('boom');
			});

			// Act
			await client.disconnect();

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
		});

		it('should log the error message when end() throws an Error without a stack', async () => {
			// Arrange
			client.connect();
			client['connected'] = true;
			const error = new Error('no-stack-mqtt');
			error.stack = undefined;
			vi.mocked(libStub.end).mockImplementation(() => {
				throw error;
			});

			// Act
			await client.disconnect();

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('no-stack-mqtt'));
		});
	});

	describe('subscribe callback', () => {
		it('should log unknown as the subscription when the broker grants no subscription info', async () => {
			// Arrange & Act
			await client['onSubscribe'](null, undefined);

			// Assert
			expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Connection subscribed: unknown'));
		});
	});

	describe('message handling', () => {
		it('should log the thrown value text when the deserializer throws a non-Error', async () => {
			// Arrange
			vi.spyOn(client['deserializer'], 'deserialize').mockImplementation(() => {
				throw asType<Error>('boom');
			});

			// Act
			await client['onMessage']('rr/m/o/uid/mqtt-user/duid-1', Buffer.from([1, 2, 3]));

			// Assert
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('unable to process message'));
			expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
		});
	});

	describe('backoff and health regressions', () => {
		function stubConnectionBroadcaster(): ReturnType<typeof createStubBroadcaster> {
			const broadcaster = createStubBroadcaster();
			Object.defineProperty(client, 'connectionBroadcaster', { value: broadcaster, writable: true });
			return broadcaster;
		}

		function createStubBroadcaster() {
			return asPartial<ConnectionBroadcaster>({
				onConnected: vi.fn().mockResolvedValue(undefined),
				onDisconnected: vi.fn().mockResolvedValue(undefined),
				onOffline: vi.fn().mockResolvedValue(undefined),
				onClose: vi.fn().mockResolvedValue(undefined),
				onError: vi.fn().mockResolvedValue(undefined),
				onReconnect: vi.fn(),
			});
		}

		async function triggerAuthBackoff(): Promise<void> {
			for (let i = 0; i < 5; i++) {
				await client['onError'](asPartial<ErrorWithReasonCode>({ code: 5 }));
			}
		}

		it('should keep the 60-minute auth backoff when stray offline, close and error events arrive', async () => {
			// Arrange
			stubConnectionBroadcaster();
			await triggerAuthBackoff();
			const connectSpy = vi.spyOn(client, 'connect');

			// Act
			await client['onOffline']();
			await client['onClose']();
			await client['onError'](new Error('stray socket error'));
			await vi.advanceTimersByTimeAsync(MIN_BACKOFF_INTERVAL_MS + 1);

			// Assert
			expect(client['authErrorBackoffTimeout']).toBeDefined();
			expect(client['generalBackoffTimeout']).toBeUndefined();
			expect(client['consecutiveGeneralFailures']).toBe(0);
			expect(connectSpy).not.toHaveBeenCalled();

			// Act
			await vi.advanceTimersByTimeAsync(KEEPALIVE_INTERVAL_MS);

			// Assert
			expect(connectSpy).toHaveBeenCalledTimes(1);
		});

		it('should count error, close and offline in a row as one failure and grow the delay once', async () => {
			// Arrange
			stubConnectionBroadcaster();
			client['connected'] = true;
			client['mqttClient'] = libStub;

			// Act
			await client['onClose']();
			await client['onError'](new Error('socket reset'));
			await client['onOffline']();

			// Assert
			expect(client['consecutiveGeneralFailures']).toBe(1);
			expect(client['generalBackoffMs']).toBe(MIN_BACKOFF_INTERVAL_MS * BACKOFF_MULTIPLIER);
			expect(mockLogger.warn).toHaveBeenCalledTimes(1);
			expect(mockLogger.warn).toHaveBeenCalledWith(
				expect.stringContaining(`delay: ${MIN_BACKOFF_INTERVAL_MS}ms, failures: 1`),
			);

			// Act: fire the pending reconnect, then one more real failure
			await vi.advanceTimersByTimeAsync(MIN_BACKOFF_INTERVAL_MS + 1);
			await client['onError'](new Error('next failure'));

			// Assert
			expect(client['consecutiveGeneralFailures']).toBe(2);
			expect(mockLogger.warn).toHaveBeenLastCalledWith(
				expect.stringContaining(`delay: ${MIN_BACKOFF_INTERVAL_MS * BACKOFF_MULTIPLIER}ms, failures: 2`),
			);
		});

		it('should ignore onOffline while a health-monitor forced reconnect is in progress', async () => {
			// Arrange
			const broadcaster = stubConnectionBroadcaster();
			client['connected'] = true;
			client['mqttClient'] = libStub;
			client['forceReconnect']('health monitor: too many consecutive query timeouts');

			// Act
			await client['onOffline']();

			// Assert
			expect(client['isForceReconnecting']).toBe(true);
			expect(broadcaster.onOffline).not.toHaveBeenCalled();
			expect(client['consecutiveGeneralFailures']).toBe(0);
			expect(client['generalBackoffTimeout']).toBeUndefined();
			expect(client['connected']).toBe(true);
		});

		it('should reset the health monitor and backoff counters when connected', async () => {
			// Arrange
			stubConnectionBroadcaster();
			client['mqttClient'] = libStub;
			client['healthMonitor'].onTimeout();
			client['healthMonitor'].onTimeout();
			client['consecutiveGeneralFailures'] = 4;
			client['generalBackoffMs'] = 30000;
			client['consecutiveAuthErrors'] = 3;
			client['generalBackoffTimeout'] = setTimeout(() => {}, 1000);

			// Act
			await client['onConnect'](asType<IConnackPacket>({}));

			// Assert
			expect(client['healthMonitor'].getConsecutiveTimeouts()).toBe(0);
			expect(client['consecutiveGeneralFailures']).toBe(0);
			expect(client['generalBackoffMs']).toBe(MIN_BACKOFF_INTERVAL_MS);
			expect(client['consecutiveAuthErrors']).toBe(0);
			expect(client['generalBackoffTimeout']).toBeUndefined();
		});
	});
});
