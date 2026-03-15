import { AnsiLogger } from 'matterbridge/logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	HeaderMessage,
	RequestMessage,
	ResponseBody,
	ResponseMessage,
} from '../../../../roborockCommunication/models/index.js';
import { Protocol } from '../../../../roborockCommunication/models/protocol.js';
import { V1PendingResponseTracker } from '../../../../roborockCommunication/routing/services/v1PendingResponseTracker.js';
import { createMockLogger } from '../../../helpers/testUtils.js';

function makeV1Response(duid: string, messageId: number, result: unknown = ['ok']): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 1000, Protocol.rpc_response);
	const body = new ResponseBody({ [Protocol.rpc_response]: { id: messageId, result } });
	return new ResponseMessage(duid, header, body);
}

function makeRequest(messageId: number): RequestMessage {
	return new RequestMessage({ protocol: Protocol.rpc_request, messageId, nonce: 0 });
}

describe('V1PendingResponseTracker', () => {
	let logger: AnsiLogger;
	let tracker: V1PendingResponseTracker;

	beforeEach(() => {
		vi.useFakeTimers();
		logger = createMockLogger();
		tracker = new V1PendingResponseTracker(logger);
	});

	afterEach(() => {
		tracker.cancelAll();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it('should resolve when response messageId matches', async () => {
		const request = makeRequest(100);
		const promise = tracker.waitFor(request, 'device-1');

		tracker.tryResolve(makeV1Response('device-1', 100, [{ state: 8 }]));

		const result = await promise;
		expect(result).toEqual([{ state: 8 }]);
	});

	it('should reject on timeout when no response arrives', async () => {
		const request = makeRequest(100);
		const promise = tracker.waitFor(request, 'device-1');

		vi.advanceTimersByTime(15000);

		await expect(promise).rejects.toThrow();
	});

	it('should ignore response with non-matching messageId', async () => {
		const request = makeRequest(100);
		const promise = tracker.waitFor(request, 'device-1');

		tracker.tryResolve(makeV1Response('device-1', 999));

		vi.advanceTimersByTime(15000);

		await expect(promise).rejects.toThrow();
	});

	it('should not resolve device1 entry with device2 response when messageIds are the same', async () => {
		const messageId = 100;
		const request = makeRequest(messageId);

		const device1Promise = tracker.waitFor(request, 'device-1');

		// Response from device2 with same messageId — should NOT resolve device1's pending entry
		tracker.tryResolve(makeV1Response('device-2', messageId));

		// device1's entry should still be pending
		expect(tracker['pending'].has('device-1:100')).toBe(true);

		vi.advanceTimersByTime(15000);
		await expect(device1Promise).rejects.toThrow();
	});

	it('should independently resolve two devices with the same messageId', async () => {
		const messageId = 100;
		const request = makeRequest(messageId);

		const device1Promise = tracker.waitFor(request, 'device-1');
		const device2Promise = tracker.waitFor(request, 'device-2');

		tracker.tryResolve(makeV1Response('device-1', messageId, [{ state: 8 }]));
		tracker.tryResolve(makeV1Response('device-2', messageId, [{ state: 5 }]));

		const [result1, result2] = await Promise.all([device1Promise, device2Promise]);
		expect(result1).toEqual([{ state: 8 }]);
		expect(result2).toEqual([{ state: 5 }]);
	});

	it('should clear all pending entries on cancelAll', () => {
		tracker.waitFor(makeRequest(100), 'device-1');
		tracker.waitFor(makeRequest(100), 'device-2');

		expect(tracker['pending'].size).toBe(2);

		tracker.cancelAll();

		expect(tracker['pending'].size).toBe(0);
	});
});
