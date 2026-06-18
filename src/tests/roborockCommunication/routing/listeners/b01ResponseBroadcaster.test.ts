import { AnsiLogger } from 'matterbridge/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeaderMessage, ResponseBody, ResponseMessage } from '../../../../roborockCommunication/models/index.js';
import { AbstractMessageListener } from '../../../../roborockCommunication/routing/listeners/abstractMessageListener.js';
import { B01ResponseBroadcaster } from '../../../../roborockCommunication/routing/listeners/b01ResponseBroadcaster.js';
import { createMockLogger } from '../../../helpers/testUtils.js';

function makeResponse(duid = 'test-duid'): ResponseMessage {
	const header = new HeaderMessage('B01', 1, 0, 101, 102);
	const body = new ResponseBody({ '101': { '108': 4 } });
	return new ResponseMessage(duid, header, body);
}

describe('B01ResponseBroadcaster', () => {
	let logger: AnsiLogger;
	let broadcaster: B01ResponseBroadcaster;

	beforeEach(() => {
		logger = createMockLogger();
		broadcaster = new B01ResponseBroadcaster(logger);
	});

	afterEach(() => {
		broadcaster.unregister();
		vi.clearAllMocks();
	});

	it('should dispatch message to all registered listeners', async () => {
		const listener1: AbstractMessageListener = {
			name: 'Listener1',
			duid: 'test-duid',
			onMessage: vi.fn().mockResolvedValue(undefined),
		};
		const listener2: AbstractMessageListener = {
			name: 'Listener2',
			duid: 'test-duid',
			onMessage: vi.fn().mockResolvedValue(undefined),
		};

		broadcaster.register(listener1);
		broadcaster.register(listener2);

		const response = makeResponse();
		await broadcaster.onMessage(response);

		expect(listener1.onMessage).toHaveBeenCalledWith(response);
		expect(listener2.onMessage).toHaveBeenCalledWith(response);
	});

	it('should catch errors from listeners and continue dispatching', () => {
		const failingListener: AbstractMessageListener = {
			name: 'FailListener',
			duid: 'test-duid',
			onMessage: vi.fn(() => {
				throw new Error('listener error');
			}),
		};
		const goodListener: AbstractMessageListener = { name: 'GoodListener', duid: 'test-duid', onMessage: vi.fn() };

		broadcaster.register(failingListener);
		broadcaster.register(goodListener);

		const response = makeResponse();
		broadcaster.onMessage(response);

		expect(goodListener.onMessage).toHaveBeenCalledWith(response);
		expect(logger.error).toHaveBeenCalled();
	});

	it('should handle non-Error thrown values', () => {
		const failingListener: AbstractMessageListener = {
			name: 'FailListener',
			duid: 'test-duid',
			onMessage: vi.fn(() => {
				// eslint-disable-next-line @typescript-eslint/only-throw-error
				throw 'raw string error';
			}),
		};

		broadcaster.register(failingListener);
		broadcaster.onMessage(makeResponse());

		expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('raw string error'));
	});

	it('should clear listeners on unregister', () => {
		const listener: AbstractMessageListener = { name: 'L', duid: 'test-duid', onMessage: vi.fn() };

		broadcaster.register(listener);
		broadcaster.unregister();

		const response = makeResponse();
		broadcaster.onMessage(response);

		expect(listener.onMessage).not.toHaveBeenCalled();
	});

	it('should remove a single listener on deregister', async () => {
		const listener1: AbstractMessageListener = {
			name: 'L1',
			duid: 'test-duid',
			onMessage: vi.fn().mockResolvedValue(undefined),
		};
		const listener2: AbstractMessageListener = {
			name: 'L2',
			duid: 'test-duid',
			onMessage: vi.fn().mockResolvedValue(undefined),
		};

		broadcaster.register(listener1);
		broadcaster.register(listener2);
		broadcaster.deregister(listener1);

		await broadcaster.onMessage(makeResponse());

		expect(listener1.onMessage).not.toHaveBeenCalled();
		expect(listener2.onMessage).toHaveBeenCalled();
	});
});
