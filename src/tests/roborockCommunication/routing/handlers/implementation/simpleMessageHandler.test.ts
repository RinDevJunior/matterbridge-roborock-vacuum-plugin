import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SimpleMessageHandler } from '../../../../../roborockCommunication/routing/handlers/implementation/simpleMessageHandler.js';
import { NotifyMessageTypes } from '../../../../../types/notifyMessageTypes.js';
import { createMockLogger } from '../../../../helpers/testUtils.js';

describe('SimpleMessageHandler', () => {
	describe('onActiveMapChanged', () => {
		it('calls deviceNotify with ActiveMapChanged type and mapId', async () => {
			const mockDeviceNotify = vi.fn().mockResolvedValue(undefined);
			const handler = new SimpleMessageHandler('test-duid', createMockLogger(), mockDeviceNotify);

			await handler.onActiveMapChanged(42);

			expect(mockDeviceNotify).toHaveBeenCalledWith({
				type: NotifyMessageTypes.ActiveMapChanged,
				data: { duid: 'test-duid', mapId: 42 },
			});
		});

		it('does nothing when deviceNotify is undefined', async () => {
			const handler = new SimpleMessageHandler('test-duid', createMockLogger(), undefined);
			await expect(handler.onActiveMapChanged(1)).resolves.toBeUndefined();
		});
	});
});
