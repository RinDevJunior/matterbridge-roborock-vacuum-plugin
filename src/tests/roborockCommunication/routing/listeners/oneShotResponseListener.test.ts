import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HeaderMessage, ResponseBody, ResponseMessage } from '../../../../roborockCommunication/models/index.js';
import { OneShotResponseListener } from '../../../../roborockCommunication/routing/listeners/oneShotResponseListener.js';

function makeResponse(duid = 'test-duid', value = 42): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	const body = new ResponseBody({ '102': { id: 123, result: [value] } });
	return new ResponseMessage(duid, header, body);
}

describe('OneShotResponseListener', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('should resolve when parseFn returns a value', async () => {
		const listener = new OneShotResponseListener<number>('test-duid', (msg) => {
			return msg.duid === 'test-duid' ? 99 : undefined;
		});

		const promise = listener.waitFor();
		await listener.onMessage(makeResponse('test-duid'));

		await expect(promise).resolves.toBe(99);
	});

	it('should ignore messages where parseFn returns undefined', async () => {
		const parseFn = vi.fn().mockReturnValue(undefined);
		const listener = new OneShotResponseListener<number>('test-duid', parseFn);

		const promise = listener.waitFor();
		await listener.onMessage(makeResponse('test-duid'));

		expect(parseFn).toHaveBeenCalled();

		vi.advanceTimersByTime(100);
		// Promise is still pending — reject via timeout to clean up
		vi.advanceTimersByTime(15000);
		await expect(promise).rejects.toThrow();
	});

	it('should reject on timeout', async () => {
		const listener = new OneShotResponseListener<number>('test-duid', () => undefined, 100);
		const promise = listener.waitFor();

		vi.advanceTimersByTime(101);

		await expect(promise).rejects.toThrow('Timeout after 100ms');
	});

	it('should ignore messages with a different duid', async () => {
		const parseFn = vi.fn().mockReturnValue(99);
		const listener = new OneShotResponseListener<number>('test-duid', parseFn);

		const promise = listener.waitFor();
		await listener.onMessage(makeResponse('other-duid'));

		expect(parseFn).not.toHaveBeenCalled();

		vi.advanceTimersByTime(15000);
		await expect(promise).rejects.toThrow();
	});

	it('should not throw when onMessage is called before waitFor (no timer set)', async () => {
		const parseFn = vi.fn().mockReturnValue(55);
		const listener = new OneShotResponseListener<number>('test-duid', parseFn);

		// onMessage before waitFor — timer is undefined, covers the if(this.timer) false branch
		await expect(listener.onMessage(makeResponse('test-duid'))).resolves.toBeUndefined();
		expect(parseFn).toHaveBeenCalledTimes(1);

		// Calling onMessage again has no effect (already settled)
		await listener.onMessage(makeResponse('test-duid'));
		expect(parseFn).toHaveBeenCalledTimes(1);
	});

	it('should be a no-op after settling', async () => {
		const parseFn = vi.fn().mockReturnValue(42);
		const listener = new OneShotResponseListener<number>('test-duid', parseFn);

		const promise = listener.waitFor();
		await listener.onMessage(makeResponse('test-duid'));
		await expect(promise).resolves.toBe(42);

		// Call onMessage again — parseFn should not be called again
		await listener.onMessage(makeResponse('test-duid'));
		expect(parseFn).toHaveBeenCalledTimes(1);
	});
});
