import { describe, expect, it, vi } from 'vitest';

import { RequestMessage, UserData } from '../../../roborockCommunication/models/index.js';
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
		router['mqttClient'] = asPartial<MQTTClient>({
			isReady: vi.fn().mockReturnValue(false),
			send: vi.fn().mockRejectedValue('boom'),
		});
		const request = asPartial<RequestMessage>({ secure: true, messageId: 5 });

		// Act
		const result = await router.query('duid', request, () => undefined, 1000);

		// Assert
		expect(result).toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith('boom');
	});
});
