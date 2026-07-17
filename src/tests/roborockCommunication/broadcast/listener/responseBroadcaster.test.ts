import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HeaderMessage, ResponseMessage } from '../../../../roborockCommunication/models/index.js';
import { V1ResponseBroadcaster } from '../../../../roborockCommunication/routing/listeners/v1ResponseBroadcaster.js';
import { asPartial, makeLogger } from '../../../testUtils.js';

describe('ResponseBroadcaster', () => {
	let chained: V1ResponseBroadcaster;
	let listener1: {
		name: string;
		requiresBody: boolean;
		duid: string;
		onMessage: ReturnType<typeof vi.fn<(message: any) => Promise<void>>>;
	};
	let listener2: {
		name: string;
		requiresBody: boolean;
		duid: string;
		onMessage: ReturnType<typeof vi.fn<(message: any) => Promise<void>>>;
	};
	const message = asPartial<ResponseMessage>({
		duid: 'test-duid',
		header: asPartial<HeaderMessage>({}),
		get: () => undefined,
		isSimpleOkResponse: () => false,
	});

	const logger = makeLogger();

	beforeEach(() => {
		chained = new V1ResponseBroadcaster(logger);
		listener1 = {
			name: 'listener1',
			requiresBody: false,
			duid: 'test-duid',
			onMessage: vi.fn<(message: any) => Promise<void>>().mockResolvedValue(undefined),
		};
		listener2 = {
			name: 'listener2',
			requiresBody: false,
			duid: 'test-duid',
			onMessage: vi.fn<(message: any) => Promise<void>>().mockResolvedValue(undefined),
		};
	});

	it('should call onMessage on all registered listeners', async () => {
		chained.register(listener1);
		chained.register(listener2);

		await chained.onMessage(message);

		expect(listener1.onMessage).toHaveBeenCalledWith(message);
		expect(listener2.onMessage).toHaveBeenCalledWith(message);
	});

	it('should not fail if no listeners registered', async () => {
		await expect(chained.onMessage(message)).resolves.toBeUndefined();
	});

	it('should call listeners in order', async () => {
		const callOrder: string[] = [];
		listener1.onMessage.mockImplementation(async () => {
			callOrder.push('first');
		});
		listener2.onMessage.mockImplementation(async () => {
			callOrder.push('second');
		});

		chained.register(listener1);
		chained.register(listener2);

		await chained.onMessage(message);

		expect(callOrder).toEqual(['first', 'second']);
	});
});
