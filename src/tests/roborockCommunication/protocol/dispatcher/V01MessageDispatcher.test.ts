import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { HeaderMessage, ResponseBody, ResponseMessage } from '../../../../roborockCommunication/models/index.js';
import { Protocol } from '../../../../roborockCommunication/models/protocol.js';
import { V10MessageDispatcher } from '../../../../roborockCommunication/protocol/dispatcher/V10MessageDispatcher.js';
import { asType } from '../../../testUtils.js';

// Build a ResponseMessage with a DPS payload at the given protocol key
function makeMsg(dpsKey: Protocol | number, id: number, result: unknown): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	const body = new ResponseBody({ [dpsKey.toString()]: { id, result } });
	return new ResponseMessage('test-duid', header, body);
}

function makeEmptyMsg(): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	return new ResponseMessage('test-duid', header, undefined);
}

function makeNoMatchMsg(messageId: number): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	// Body exists but has no matching DPS keys (4, 5, or 102)
	const body = new ResponseBody({ '99': { id: messageId, result: [42] } });
	return new ResponseMessage('test-duid', header, body);
}

// --- Mock Factories ---
function createMockLogger() {
	return {
		notice: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	};
}

function createMockClient() {
	return {
		send: vi.fn().mockResolvedValue(undefined),
		get: vi.fn().mockResolvedValue(undefined),
		query: vi.fn().mockResolvedValue(undefined),
		isConnected: vi.fn().mockReturnValue(true),
		isReady: vi.fn().mockReturnValue(true),
		connect: vi.fn(),
		disconnect: vi.fn(),
		registerConnectionListener: vi.fn(),
		registerMessageListener: vi.fn(),
	};
}

// --- Test Suite ---
describe('V10MessageDispatcher', () => {
	let logger: ReturnType<typeof createMockLogger>;
	let client: ReturnType<typeof createMockClient>;
	let dispatcher: V10MessageDispatcher;
	const duid = 'test-duid';

	beforeEach(() => {
		logger = createMockLogger();
		client = createMockClient();
		dispatcher = new V10MessageDispatcher(asType(logger), client);
	});

	afterEach(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	describe('getNetworkInfo', () => {
		it('should call client.query', async () => {
			await dispatcher.getNetworkInfo(duid);
			expect(client.query).toHaveBeenCalled();
		});
	});

	describe('getSerialNumber', () => {
		it('should return serial_number from response when available', async () => {
			client.query.mockResolvedValueOnce([{ serial_number: 'SN-123' }]);
			const result = await dispatcher.getSerialNumber(duid);
			expect(result).toBe('SN-123');
		});

		it('should return duid when response is empty array', async () => {
			client.query.mockResolvedValueOnce([]);
			const result = await dispatcher.getSerialNumber(duid);
			expect(result).toBe(duid);
		});

		it('should return duid when response is undefined', async () => {
			client.query.mockResolvedValueOnce(undefined);
			const result = await dispatcher.getSerialNumber(duid);
			expect(result).toBe(duid);
		});
	});

	describe('getDeviceStatus', () => {
		it('should call client.send', async () => {
			await dispatcher.getDeviceStatus(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('getMapInfo', () => {
		it('should call client.send and return void', async () => {
			const result = await dispatcher.getMapInfo(duid);
			expect(client.send).toHaveBeenCalled();
			expect(result).toBeUndefined();
		});
	});

	describe('getRoomMap', () => {
		it('should call client.send and return void', async () => {
			const result = await dispatcher.getRoomMap(duid, 1);
			expect(client.send).toHaveBeenCalled();
			expect(result).toBeUndefined();
		});
	});

	describe('goHome', () => {
		it('should send a charge command', async () => {
			await dispatcher.goHome(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('startCleaning', () => {
		it('should send a start cleaning command', async () => {
			await dispatcher.startCleaning(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('startRoomCleaning', () => {
		it('should send a start room cleaning command', async () => {
			await dispatcher.startRoomCleaning(duid, [1, 2], 2);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('pauseCleaning', () => {
		it('should send a pause command', async () => {
			await dispatcher.pauseCleaning(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('resumeCleaning', () => {
		it('should send a resume command', async () => {
			await dispatcher.resumeCleaning(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('resumeRoomCleaning', () => {
		it('should send a resume_segment_clean command', async () => {
			await dispatcher.resumeRoomCleaning(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('stopCleaning', () => {
		it('should send a stop command', async () => {
			await dispatcher.stopCleaning(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('findMyRobot', () => {
		it('should call client.send with find_me', async () => {
			await dispatcher.findMyRobot(duid);
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('sendCustomMessage', () => {
		it('should send a custom message', async () => {
			const def = { method: 'foo' };
			await dispatcher.sendCustomMessage(duid, asType(def));
			expect(client.send).toHaveBeenCalled();
		});
	});

	describe('getCustomMessage', () => {
		it('should call client.query', async () => {
			const def = { method: 'foo' };
			await dispatcher.getCustomMessage(duid, asType(def));
			expect(client.query).toHaveBeenCalled();
		});
	});

	describe('getCleanModeData', () => {
		it('should call getCustomMessage and return CleanModeSetting', async () => {
			client.query.mockResolvedValueOnce([1]); // get_mop_mode → mopRoute = 1
			client.query.mockResolvedValueOnce([2]); // get_custom_mode → suctionPower = 2
			client.query.mockResolvedValueOnce({ water_box_mode: 3, distance_off: 4 }); // get_water_box_custom_mode
			const result = await dispatcher.getCleanModeData(duid);
			expect(client.query).toHaveBeenCalled();
			expect(result).toEqual({ suctionPower: 2, waterFlow: 3, distance_off: 4, mopRoute: 1 });
		});
		it('should handle array and non-array responses', async () => {
			client.query.mockResolvedValueOnce(5); // get_mop_mode → mopRoute = 5
			client.query.mockResolvedValueOnce(6); // get_custom_mode → suctionPower = 6
			client.query.mockResolvedValueOnce(7); // get_water_box_custom_mode → waterFlow = 7
			const result = await dispatcher.getCleanModeData(duid);
			expect(result).toEqual({ suctionPower: 6, waterFlow: 7, distance_off: 0, mopRoute: 5 });
		});
	});

	describe('changeCleanMode', () => {
		it('should not send initial set_mop_mode(custom=302) if mopRoute is smart (306)', async () => {
			const setting = new CleanModeSetting(0, 0, 0, 306, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			const guardCall = client.send.mock.calls.find(
				(c: unknown[]) =>
					(c[1] as { method: string }).method === 'set_mop_mode' &&
					JSON.stringify((c[1] as { params: unknown[] }).params) === JSON.stringify([302]),
			);
			expect(guardCall).toBeUndefined();
		});

		it('should not send initial set_mop_mode if mopRoute is 0', async () => {
			const setting = new CleanModeSetting(0, 0, 0, 0, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			expect(client.send).not.toHaveBeenCalled();
		});

		it('should send set_mop_mode(custom) first if mopRoute is not smart and not 0', async () => {
			const setting = new CleanModeSetting(0, 0, 0, 100, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			const firstCall = client.send.mock.calls[0];
			expect((firstCall[1] as { method: string; params: unknown[] }).method).toBe('set_mop_mode');
			expect((firstCall[1] as { params: unknown[] }).params).toEqual([302]);
		});

		it('should send set_custom_mode if suctionPower != 0', async () => {
			const setting = new CleanModeSetting(5, 0, 0, 0, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			expect(client.send).toHaveBeenCalledWith(duid, expect.objectContaining({ method: 'set_custom_mode' }));
		});

		it('should send set_water_box_custom_mode with distance_off', async () => {
			const setting = new CleanModeSetting(0, 207, 10, 0, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			expect(client.send).toHaveBeenCalledWith(
				duid,
				expect.objectContaining({
					method: 'set_water_box_custom_mode',
					params: { water_box_mode: 207, distance_off: 10 },
				}),
			);
		});

		it('should send set_water_box_custom_mode with array param', async () => {
			const setting = new CleanModeSetting(0, 5, 0, 0, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			expect(client.send).toHaveBeenCalledWith(
				duid,
				expect.objectContaining({ method: 'set_water_box_custom_mode', params: [5] }),
			);
		});

		it('should send set_mop_mode with mopRoute if mopRoute != 0', async () => {
			const setting = new CleanModeSetting(0, 0, 0, 8, CleanSequenceType.Persist);
			await dispatcher.changeCleanMode(duid, setting);
			const calls = client.send.mock.calls.map((c: unknown[]) => c[1] as { method: string; params: unknown[] });
			const finalMopMode = calls.find((c) => c.method === 'set_mop_mode' && (c.params as unknown[]).includes(8));
			expect(finalMopMode).toBeDefined();
		});
	});

	// --- parseFn branch coverage ---
	// These tests capture the parseFn passed to client.query and invoke it directly
	// to cover the branches inside parseV1Result and inline parse lambdas.

	describe('parseV1Result (via getNetworkInfo parseFn)', () => {
		let parseFn: (msg: ResponseMessage) => unknown;
		let messageId: number;

		beforeEach(async () => {
			await dispatcher.getNetworkInfo(duid);
			parseFn = client.query.mock.calls[0][2];
			messageId = client.query.mock.calls[0][1].messageId;
		});

		it('returns undefined when msg.body is undefined', () => {
			expect(parseFn(makeEmptyMsg())).toBeUndefined();
		});

		it('returns undefined when no matching DPS key exists', () => {
			expect(parseFn(makeNoMatchMsg(messageId))).toBeUndefined();
		});

		it('falls through to general_response when rpc_response is missing', () => {
			const msg = makeMsg(Protocol.general_response, messageId, 'from-general');
			expect(parseFn(msg)).toBe('from-general');
		});

		it('falls through to general_request when rpc_response and general_response are missing', () => {
			const msg = makeMsg(Protocol.general_request, messageId, 'from-request');
			expect(parseFn(msg)).toBe('from-request');
		});

		it('returns undefined when dps.id does not match messageId', () => {
			const msg = makeMsg(Protocol.rpc_response, messageId + 99, 42);
			expect(parseFn(msg)).toBeUndefined();
		});

		it('returns undefined when dps.result is null', () => {
			const msg = makeMsg(Protocol.rpc_response, messageId, null);
			expect(parseFn(msg)).toBeUndefined();
		});

		it('returns result[0] when dps.result is an array', () => {
			const msg = makeMsg(Protocol.rpc_response, messageId, ['first', 'second']);
			expect(parseFn(msg)).toBe('first');
		});

		it('returns result directly when dps.result is not an array', () => {
			const msg = makeMsg(Protocol.rpc_response, messageId, { key: 'value' });
			expect(parseFn(msg)).toEqual({ key: 'value' });
		});
	});

	describe('getSerialNumber inline parseFn', () => {
		let parseFn: (msg: ResponseMessage) => unknown;
		let messageId: number;

		beforeEach(async () => {
			await dispatcher.getSerialNumber(duid);
			parseFn = client.query.mock.calls[0][2];
			messageId = client.query.mock.calls[0][1].messageId;
		});

		it('returns undefined when msg.body is undefined', () => {
			expect(parseFn(makeEmptyMsg())).toBeUndefined();
		});

		it('returns undefined when no dps found', () => {
			expect(parseFn(makeNoMatchMsg(messageId))).toBeUndefined();
		});

		it('falls through to general_response when rpc_response is missing', () => {
			const payload = [{ serial_number: 'SN-999' }];
			const msg = makeMsg(Protocol.general_response, messageId, payload);
			expect(parseFn(msg)).toEqual(payload);
		});

		it('returns undefined when dps.id does not match', () => {
			const msg = makeMsg(Protocol.rpc_response, messageId + 1, [{ serial_number: 'SN' }]);
			expect(parseFn(msg)).toBeUndefined();
		});

		it('returns dps.result when id matches', () => {
			const payload = [{ serial_number: 'SN-42' }];
			const msg = makeMsg(Protocol.rpc_response, messageId, payload);
			expect(parseFn(msg)).toEqual(payload);
		});
	});
});
