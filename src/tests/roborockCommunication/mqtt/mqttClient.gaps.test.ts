import type { MqttClient as MqttLibClient } from 'mqtt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MessageContext, UserData } from '../../../roborockCommunication/models/index.js';
import { MQTTClient } from '../../../roborockCommunication/mqtt/mqttClient.js';
import type { ResponseBroadcaster } from '../../../roborockCommunication/routing/listeners/responseBroadcaster.js';
import { asType, createMockLogger } from '../../helpers/testUtils.js';

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
});
