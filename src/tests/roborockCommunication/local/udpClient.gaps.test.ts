import { describe, expect, it } from 'vitest';

import { LocalNetworkUDPClient } from '../../../roborockCommunication/local/udpClient.js';
import { createMockLogger } from '../../helpers/testUtils.js';

describe('LocalNetworkUDPClient.onError', () => {
	it('should log the socket error and resolve without throwing when no server socket exists', async () => {
		// Arrange
		const logger = createMockLogger();
		const client = new LocalNetworkUDPClient(logger);
		// Act
		const result = await client['onError'](new Error('boom'));
		// Assert
		expect(result).toBeUndefined();
		expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('UDP socket error'));
	});
});
