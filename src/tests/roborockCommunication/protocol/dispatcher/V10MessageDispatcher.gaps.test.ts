import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { MapInfo } from '../../../../core/application/models/index.js';
import {
	HeaderMessage,
	RequestMessage,
	ResponseBody,
	ResponseMessage,
} from '../../../../roborockCommunication/models/index.js';
import { Protocol } from '../../../../roborockCommunication/models/protocol.js';
import { V10MessageDispatcher } from '../../../../roborockCommunication/protocol/dispatcher/V10MessageDispatcher.js';
import type { Client } from '../../../../roborockCommunication/routing/client.js';
import { asType, createMockLogger, makeMockClientRouter } from '../../../helpers/testUtils.js';

// Build a ResponseMessage carrying a DPS payload under the given protocol key
function makeMsg(dpsKey: Protocol, id: number, result: unknown): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	const body = new ResponseBody({ [dpsKey.toString()]: { id, result } });
	return new ResponseMessage('test-duid', header, body);
}

function makeEmptyMsg(): ResponseMessage {
	const header = new HeaderMessage('1.0', 1, 0, 101, 102);
	return new ResponseMessage('test-duid', header, undefined);
}

describe('V10MessageDispatcher (gap coverage)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let client: ReturnType<typeof makeMockClientRouter>;
	let dispatcher: V10MessageDispatcher;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		client = makeMockClientRouter();
		dispatcher = new V10MessageDispatcher(mockLogger, asType<Client>(client));
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('getHomeMap', () => {
		it('should return the parsed rpc result when query resolves with a matching response', async () => {
			// Arrange
			const mapResult = { image: 'data' };
			vi.mocked(client.query).mockResolvedValueOnce(mapResult);
			// Act
			const result = await dispatcher.getHomeMap('duid-1');
			// Assert
			expect(result).toEqual(mapResult);
		});

		it('should return an empty object when query resolves undefined', async () => {
			// Arrange
			vi.mocked(client.query).mockResolvedValueOnce(undefined);
			// Act
			const result = await dispatcher.getHomeMap('duid-1');
			// Assert
			expect(result).toEqual({});
		});
	});

	describe('getMapInfo', () => {
		it('should build MapInfo from the parsed response when query returns data', async () => {
			// Arrange
			vi.mocked(client.query).mockResolvedValueOnce({
				max_multi_map: 1,
				max_bak_map: 0,
				multi_map_count: 0,
				map_info: [],
			});
			// Act
			const result = await dispatcher.getMapInfo('duid-1');
			// Assert
			expect(result).toBeInstanceOf(MapInfo);
			expect(result.maps).toHaveLength(0);
		});

		it('should return MapInfo with zero maps when query resolves undefined', async () => {
			// Arrange
			vi.mocked(client.query).mockResolvedValueOnce(undefined);
			// Act
			const result = await dispatcher.getMapInfo('duid-1');
			// Assert
			expect(result).toBeInstanceOf(MapInfo);
			expect(result.maps).toHaveLength(0);
		});

		it('should parse a matching rpc response via the captured parser', async () => {
			// Arrange
			vi.mocked(client.query).mockResolvedValueOnce(undefined);
			await dispatcher.getMapInfo('duid-1');
			const parser = vi.mocked(client.query).mock.calls[0][2];
			const request = vi.mocked(client.query).mock.calls[0][1];
			const payload = { max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] };
			// Act
			const parsed = parser(makeMsg(Protocol.rpc_response, request.messageId, payload));
			// Assert
			expect(parsed).toEqual(payload);
		});
	});

	describe('getRoomMap parser', () => {
		async function captureRoomMapParser() {
			vi.mocked(client.query).mockResolvedValueOnce(undefined);
			await dispatcher.getRoomMap('duid-1', 0);
			return {
				parser: vi.mocked(client.query).mock.calls[0][2],
				request: vi.mocked(client.query).mock.calls[0][1],
			};
		}

		it('should return undefined when the message has no body', async () => {
			// Arrange
			const { parser } = await captureRoomMapParser();
			// Act
			const result = parser(makeEmptyMsg());
			// Assert
			expect(result).toBeUndefined();
		});

		it('should return the result from general_response when rpc_response is missing', async () => {
			// Arrange
			const { parser, request } = await captureRoomMapParser();
			const rows = [[1, 2]];
			// Act
			const result = parser(makeMsg(Protocol.general_response, request.messageId, rows));
			// Assert
			expect(result).toEqual(rows);
		});

		it('should return undefined when neither rpc_response nor general_response is present', async () => {
			// Arrange
			const { parser } = await captureRoomMapParser();
			const header = new HeaderMessage('1.0', 1, 0, 101, 102);
			const msg = new ResponseMessage('test-duid', header, new ResponseBody({ '99': { id: 1, result: [] } }));
			// Act
			const result = parser(msg);
			// Assert
			expect(result).toBeUndefined();
		});

		it('should return undefined when the dps id does not match the request id', async () => {
			// Arrange
			const { parser, request } = await captureRoomMapParser();
			// Act
			const result = parser(makeMsg(Protocol.rpc_response, request.messageId + 1000, [[1]]));
			// Assert
			expect(result).toBeUndefined();
		});
	});

	describe('switchMap', () => {
		it('should send load_multi_map with the map id as params', async () => {
			// Arrange
			vi.mocked(client.send).mockResolvedValueOnce(undefined);
			// Act
			await dispatcher.switchMap('duid-1', 3);
			// Assert
			const sent = vi.mocked(client.send).mock.calls[0][1];
			expect(vi.mocked(client.send).mock.calls[0][0]).toBe('duid-1');
			expect(sent).toBeInstanceOf(RequestMessage);
			expect(sent.method).toBe('load_multi_map');
			expect(sent.params).toEqual([3]);
		});
	});

	describe('getCleanModeData distance_off handling', () => {
		it('should default distance_off to 0 when water_box_custom_mode distance_off is null', async () => {
			// Arrange
			vi.mocked(client.query)
				.mockResolvedValueOnce(2) // get_mop_mode
				.mockResolvedValueOnce(3) // get_custom_mode
				.mockResolvedValueOnce({ water_box_mode: 4, distance_off: null }); // get_water_box_custom_mode
			// Act
			const setting = await dispatcher.getCleanModeData('duid-1');
			// Assert
			expect(setting).toBeInstanceOf(CleanModeSetting);
			expect(setting.distance_off).toBe(0);
			expect(setting.waterFlow).toBe(4);
		});
	});

	describe('getConsumableStatus', () => {
		async function captureConsumableParser() {
			vi.mocked(client.query).mockResolvedValueOnce(undefined);
			await dispatcher.getConsumableStatus('duid-1');
			return {
				parser: vi.mocked(client.query).mock.calls[0][2],
				request: vi.mocked(client.query).mock.calls[0][1],
			};
		}

		it('should return the parsed payload when the parser receives a matching rpc response', async () => {
			// Arrange
			const { parser, request } = await captureConsumableParser();
			const payload = { filter_work_time: 1234 };
			// Act
			const parsed = parser(makeMsg(Protocol.rpc_response, request.messageId, payload));
			// Assert
			expect(parsed).toEqual(payload);
		});

		it('should unwrap the first element when the parser receives an array result', async () => {
			// Arrange
			const { parser, request } = await captureConsumableParser();
			const payload = { filter_work_time: 1234 };
			// Act
			const parsed = parser(makeMsg(Protocol.general_response, request.messageId, [payload]));
			// Assert
			expect(parsed).toEqual(payload);
		});

		it('should return undefined from the parser when the message has no body', async () => {
			// Arrange
			const { parser } = await captureConsumableParser();
			// Act
			const parsed = parser(makeEmptyMsg());
			// Assert
			expect(parsed).toBeUndefined();
		});

		it('should return undefined from the parser when the dps id does not match', async () => {
			// Arrange
			const { parser, request } = await captureConsumableParser();
			// Act
			const parsed = parser(makeMsg(Protocol.rpc_response, request.messageId + 1000, { filter_work_time: 1 }));
			// Assert
			expect(parsed).toBeUndefined();
		});

		it('should return undefined when the query resolves undefined', async () => {
			// Arrange
			vi.mocked(client.query).mockResolvedValueOnce(undefined);
			// Act
			const result = await dispatcher.getConsumableStatus('duid-1');
			// Assert
			expect(result).toBeUndefined();
		});

		it('should return undefined when filter_work_time is not a number', async () => {
			// Arrange
			vi.mocked(client.query).mockResolvedValueOnce({ filter_work_time: '1234' });
			// Act
			const result = await dispatcher.getConsumableStatus('duid-1');
			// Assert
			expect(result).toBeUndefined();
		});

		it('should return filterWorkTimeSec when filter_work_time is zero', async () => {
			// Arrange
			vi.mocked(client.query).mockResolvedValueOnce({ filter_work_time: 0 });
			// Act
			const result = await dispatcher.getConsumableStatus('duid-1');
			// Assert
			expect(result).toEqual({ filterWorkTimeSec: 0 });
		});
	});

	describe('resetFilterConsumable', () => {
		it('should send reset_consumable with filter_work_time params to the device', async () => {
			// Arrange
			vi.mocked(client.send).mockResolvedValueOnce(undefined);
			// Act
			await dispatcher.resetFilterConsumable('duid-1');
			// Assert
			const sent = vi.mocked(client.send).mock.calls[0][1];
			expect(vi.mocked(client.send).mock.calls[0][0]).toBe('duid-1');
			expect(sent).toBeInstanceOf(RequestMessage);
			expect(sent.method).toBe('reset_consumable');
			expect(sent.params).toEqual(['filter_work_time']);
		});

		it('should resolve to undefined when the send succeeds', async () => {
			// Arrange
			vi.mocked(client.send).mockResolvedValueOnce(undefined);
			// Act
			const result = await dispatcher.resetFilterConsumable('duid-1');
			// Assert
			expect(result).toBeUndefined();
		});
	});
});
