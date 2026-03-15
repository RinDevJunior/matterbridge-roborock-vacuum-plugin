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

	it('should resolve with real V1 get_status response data', async () => {
		const duid = 'device-abc';
		const messageId = 21576;

		// Real data from debug log: header.protocol=4 (general_request), body key=102 (rpc_response)
		const header = new HeaderMessage('1.0', 3811, 50635879, 1773589616, Protocol.general_request);
		const body = new ResponseBody({
			[Protocol.rpc_response]: {
				id: messageId,
				result: [
					{
						msg_ver: 2,
						msg_seq: 1583,
						state: 8,
						battery: 100,
						clean_time: 3158,
						clean_area: 35017500,
						error_code: 0,
						map_present: 1,
						in_cleaning: 0,
						in_returning: 0,
						in_fresh_state: 1,
						lab_status: 3,
						water_box_status: 1,
						fan_power: 110,
						dnd_enabled: 0,
						map_status: 3,
						is_locating: 0,
						lock_status: 0,
						water_box_mode: 209,
						distance_off: 155,
						water_box_carriage_status: 1,
						mop_forbidden_enable: 1,
						camera_status: 1,
						is_exploring: 0,
						adbumper_status: [0, 0, 0],
						water_shortage_status: 0,
						dock_type: 14,
						dust_collection_status: 0,
						auto_dust_collection: 1,
						avoid_count: 249,
						mop_mode: 306,
						in_warmup: 0,
						back_type: -1,
						wash_phase: 0,
						wash_ready: 1,
						wash_status: 512,
						debug_mode: 0,
						collision_avoid_status: 1,
						switch_map_mode: 1,
						dock_error_status: 0,
						charge_status: 1,
						unsave_map_reason: 0,
						unsave_map_flag: 0,
						dry_status: 0,
						rdt: 0,
						clean_percent: 0,
						extra_time: 273,
						rss: 2,
						dss: 168,
						common_status: 2,
						repeat: 1,
						kct: 0,
						events: [],
						switch_status: 0,
						last_clean_t: 1773539558,
						replenish_mode: 0,
						subdivision_sets: 0,
						cleaning_info: {
							target_segment_id: -1,
							segment_id: -1,
							fan_power: 102,
							water_box_status: 202,
							mop_mode: 306,
						},
						exit_dock: 0,
						seq_type: 0,
					},
				],
			},
		});
		const response = new ResponseMessage(duid, header, body);

		const request = makeRequest(messageId);
		const promise = tracker.waitFor(request, duid);

		tracker.tryResolve(response);

		const result = await promise;
		const status = (result as unknown as unknown[])[0] as Record<string, unknown>;

		expect(status['state']).toBe(8);
		expect(status['battery']).toBe(100);
		expect(status['fan_power']).toBe(110);
		expect(status['water_box_mode']).toBe(209);
		expect(status['mop_mode']).toBe(306);
		expect(status['dock_type']).toBe(14);
		expect(status['charge_status']).toBe(1);
		expect(status['cleaning_info']).toEqual({
			target_segment_id: -1,
			segment_id: -1,
			fan_power: 102,
			water_box_status: 202,
			mop_mode: 306,
		});
	});
});
