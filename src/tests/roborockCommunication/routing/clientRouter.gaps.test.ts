import { afterEach, describe, expect, it, vi } from 'vitest';

import { RequestMessage, ResponseMessage, UserData } from '../../../roborockCommunication/models/index.js';
import type { MQTTClient } from '../../../roborockCommunication/mqtt/mqttClient.js';
import { ClientRouter } from '../../../roborockCommunication/routing/clientRouter.js';
import { asPartial, createMockLogger } from '../../helpers/testUtils.js';

const userData: UserData = {
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

function createMockMqttClient(overrides: Partial<MQTTClient> = {}): MQTTClient {
	return asPartial<MQTTClient>({
		isReady: vi.fn().mockReturnValue(false),
		send: vi.fn().mockResolvedValue(undefined),
		reportQuerySuccess: vi.fn(),
		reportQueryTimeout: vi.fn(),
		...overrides,
	});
}

describe('ClientRouter (gap coverage)', () => {
	it('should return the context serialize nonce buffer when getSerializeNonce is called', () => {
		// Arrange
		const router = new ClientRouter(createMockLogger(), userData);
		const expectedNonce = router['context'].serializeNonce;

		// Act
		const nonce = router.getSerializeNonce();

		// Assert
		expect(nonce).toBe(expectedNonce);
		expect(nonce).toHaveLength(16);
	});

	it('should log the raw string and resolve undefined when the secure send rejects with a non-Error during query', async () => {
		// Arrange
		const logger = createMockLogger();
		const router = new ClientRouter(logger, userData);
		const mqttClient = createMockMqttClient({ send: vi.fn().mockRejectedValue('boom') });
		router['mqttClient'] = mqttClient;
		const request = asPartial<RequestMessage>({ secure: true, messageId: 5 });

		// Act
		const result = await router.query('duid', request, () => undefined, 1000);

		// Assert
		expect(result).toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith('boom');
		expect(mqttClient.reportQueryTimeout).toHaveBeenCalledTimes(1);
		expect(mqttClient.reportQuerySuccess).not.toHaveBeenCalled();
	});

	it('should report query success to the health monitor when a secure query resolves', async () => {
		// Arrange
		const router = new ClientRouter(createMockLogger(), userData);
		const registerSpy = vi.spyOn(router['broadcasterFactory'], 'register');
		const mqttClient = createMockMqttClient({
			send: vi.fn().mockImplementation(async () => {
				// Deliver the response after query() has attached its waitFor() resolver.
				const listener = vi.mocked(registerSpy).mock.calls[0][0];
				setTimeout(() => void listener.onMessage(asPartial<ResponseMessage>({ duid: 'duid' })), 0);
			}),
		});
		router['mqttClient'] = mqttClient;
		const request = asPartial<RequestMessage>({ secure: true, messageId: 6 });

		// Act
		const result = await router.query('duid', request, () => 'parsed', 1000);

		// Assert
		expect(result).toBe('parsed');
		expect(mqttClient.reportQuerySuccess).toHaveBeenCalledTimes(1);
		expect(mqttClient.reportQueryTimeout).not.toHaveBeenCalled();
	});

	it('should not report query timeout to the health monitor when a non-secure query fails', async () => {
		// Arrange
		const logger = createMockLogger();
		const router = new ClientRouter(logger, userData);
		const mqttClient = createMockMqttClient({ send: vi.fn().mockRejectedValue(new Error('local down')) });
		router['mqttClient'] = mqttClient;
		const request = asPartial<RequestMessage>({ secure: false, messageId: 7 });

		// Act
		const result = await router.query('duid', request, () => undefined, 1000);

		// Assert
		expect(result).toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith('local down');
		expect(mqttClient.reportQueryTimeout).not.toHaveBeenCalled();
		expect(mqttClient.reportQuerySuccess).not.toHaveBeenCalled();
	});

	describe('health signal reporting', () => {
		afterEach(() => {
			vi.useRealTimers();
		});

		it('should not report query success or timeout when a non-secure query resolves', async () => {
			// Arrange
			const router = new ClientRouter(createMockLogger(), userData);
			const registerSpy = vi.spyOn(router['broadcasterFactory'], 'register');
			const mqttClient = createMockMqttClient({
				send: vi.fn().mockImplementation(async () => {
					// Deliver the response after query() has attached its waitFor() resolver.
					const listener = vi.mocked(registerSpy).mock.calls[0][0];
					setTimeout(() => void listener.onMessage(asPartial<ResponseMessage>({ duid: 'duid' })), 0);
				}),
			});
			router['mqttClient'] = mqttClient;
			const request = asPartial<RequestMessage>({ secure: false, messageId: 8 });

			// Act
			const result = await router.query('duid', request, () => 'parsed', 1000);

			// Assert
			expect(result).toBe('parsed');
			expect(mqttClient.reportQuerySuccess).not.toHaveBeenCalled();
			expect(mqttClient.reportQueryTimeout).not.toHaveBeenCalled();
		});

		it('should report query timeout to the health monitor when a secure query gets no response', async () => {
			// Arrange
			vi.useFakeTimers();
			const logger = createMockLogger();
			const router = new ClientRouter(logger, userData);
			const mqttClient = createMockMqttClient();
			router['mqttClient'] = mqttClient;
			const request = asPartial<RequestMessage>({ secure: true, messageId: 9 });

			// Act
			const pending = router.query('duid', request, () => 'parsed', 1000);
			await vi.advanceTimersByTimeAsync(1000);
			const result = await pending;

			// Assert
			expect(result).toBeUndefined();
			expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Timeout after 1000ms'));
			expect(mqttClient.reportQueryTimeout).toHaveBeenCalledTimes(1);
			expect(mqttClient.reportQuerySuccess).not.toHaveBeenCalled();
		});
	});
});
