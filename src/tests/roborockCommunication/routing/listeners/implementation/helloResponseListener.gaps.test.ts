import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HELLO_RESPONSE_TIMEOUT_MS } from '../../../../../constants/timeouts.js';
import { ResponseMessage } from '../../../../../roborockCommunication/models/index.js';
import { HelloResponseListener } from '../../../../../roborockCommunication/routing/listeners/implementation/helloResponseListener.js';
import { asPartial, createMockLogger } from '../../../../helpers/testUtils.js';

describe('HelloResponseListener (gap coverage)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('should ignore a hello_response for a different duid and leave the wait pending', async () => {
		// Arrange
		const logger = createMockLogger();
		const listener = new HelloResponseListener('device-1', logger);
		const pending = listener.waitFor('1.0');
		const otherDeviceMessage = asPartial<ResponseMessage>({
			duid: 'device-2',
			isForProtocol: vi.fn().mockReturnValue(true),
		});
		const rejection = expect(pending).rejects.toThrow(/no hello response for device-1 with protocol version 1.0/);

		// Act
		await listener.onMessage(otherDeviceMessage);
		vi.advanceTimersByTime(HELLO_RESPONSE_TIMEOUT_MS);

		// Assert
		expect(otherDeviceMessage.isForProtocol).not.toHaveBeenCalled();
		expect(logger.debug).not.toHaveBeenCalled();
		await rejection;
	});
});
