import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Q7RequestCode, Q7RequestMethod } from '../../../../../roborockCommunication/enums/Q7RequestCode.js';
import { Q10RequestCode } from '../../../../../roborockCommunication/enums/Q10RequestCode.js';
import { Protocol, ResponseMessage } from '../../../../../roborockCommunication/models/index.js';
import { MapInfoListener } from '../../../../../roborockCommunication/routing/listeners/implementation/mapInfoListener.js';
import { AreaManagementService } from '../../../../../services/areaManagementService.js';
import { asPartial, createMockLogger } from '../../../../helpers/testUtils.js';

const DUID = 'test-duid';

function makeMessage(
	duid: string,
	getImpl: (proto: Protocol) => unknown,
	bodyGetImpl?: (key: number) => unknown,
): ResponseMessage {
	const bodyGet = bodyGetImpl ?? (() => undefined);
	return asPartial<ResponseMessage>({
		duid,
		body: asPartial({ data: {}, get: vi.fn().mockImplementation(bodyGet) }),
		get: vi.fn().mockImplementation(getImpl),
	});
}

function makeV1Message(duid: string, result: unknown): ResponseMessage {
	return makeMessage(duid, (proto) => {
		if (proto === Protocol.rpc_response) return { id: 1, result };
		return undefined;
	});
}

function makeB01Message(duid: string, bodyGetImpl: (key: number) => unknown): ResponseMessage {
	return makeMessage(duid, () => undefined, bodyGetImpl);
}

describe('MapInfoListener', () => {
	let areaService: AreaManagementService;
	let listener: MapInfoListener;
	const rooms = [asPartial({ id: 11100845, name: 'Kitchen' }), asPartial({ id: 11100849, name: 'Study' })];

	beforeEach(() => {
		areaService = asPartial<AreaManagementService>({
			setSupportedAreas: vi.fn(),
			setSupportedAreaIndexMap: vi.fn(),
			setSupportedMaps: vi.fn(),
		});
		listener = new MapInfoListener(DUID, rooms as never, areaService, createMockLogger());
	});

	describe('duid filtering', () => {
		it('should ignore messages from wrong duid', async () => {
			const msg = makeV1Message('other-duid', [[1, '11100845', 14]]);
			await listener.onMessage(msg);
			expect(areaService.setSupportedAreas).not.toHaveBeenCalled();
		});
	});

	describe('tryParseV1RoomMap', () => {
		it('should update areas when rpc_response contains RawRoomMappingData', async () => {
			const rawData = [
				[1, '11100845', 14],
				[2, '11100849', 9],
			];
			const msg = makeV1Message(DUID, rawData);

			await listener.onMessage(msg);

			expect(areaService.setSupportedAreas).toHaveBeenCalled();
			expect(areaService.setSupportedAreaIndexMap).toHaveBeenCalled();
		});

		it('should skip when result is empty array', async () => {
			const msg = makeV1Message(DUID, []);
			await listener.onMessage(msg);
			expect(areaService.setSupportedAreas).not.toHaveBeenCalled();
		});

		it('should skip when result is an object (not room map)', async () => {
			const msg = makeV1Message(DUID, { state: 5, battery: 80 });
			await listener.onMessage(msg);
			expect(areaService.setSupportedAreas).not.toHaveBeenCalled();
		});

		it('should fall through to general_response when rpc_response is missing', async () => {
			const rawData = [[1, '11100845', 14]];
			const msg = makeMessage(DUID, (proto) => {
				if (proto === Protocol.general_response) return { id: 1, result: rawData };
				return undefined;
			});

			await listener.onMessage(msg);

			expect(areaService.setSupportedAreas).toHaveBeenCalled();
		});
	});

	describe('tryParseV1MapInfo', () => {
		it('should update areas when MapInfo has rooms', async () => {
			const multipleMapDto = {
				max_multi_map: 1,
				max_bak_map: 0,
				multi_map_count: 1,
				map_info: [
					{
						mapFlag: 0,
						add_time: 0,
						length: 1,
						name: 'Home',
						bak_maps: [],
						rooms: [{ id: 1, tag: 14, iot_name_id: '11100845' }],
					},
				],
			};
			const msg = makeV1Message(DUID, multipleMapDto);

			await listener.onMessage(msg);

			expect(areaService.setSupportedAreas).toHaveBeenCalled();
			expect(areaService.setSupportedAreaIndexMap).toHaveBeenCalled();
		});

		it('should NOT update areas when MapInfo has no rooms', async () => {
			const multipleMapDto = {
				max_multi_map: 1,
				max_bak_map: 0,
				multi_map_count: 1,
				map_info: [{ mapFlag: 0, add_time: 0, length: 0, name: 'Home', bak_maps: [] }],
			};
			const msg = makeV1Message(DUID, multipleMapDto);

			await listener.onMessage(msg);

			expect(areaService.setSupportedAreas).not.toHaveBeenCalled();
		});

		it('should parse MapInfo when wrapped in array', async () => {
			const multipleMapDto = {
				max_multi_map: 1,
				max_bak_map: 0,
				multi_map_count: 1,
				map_info: [
					{
						mapFlag: 0,
						add_time: 0,
						length: 1,
						name: 'Home',
						bak_maps: [],
						rooms: [{ id: 1, tag: 14, iot_name_id: '11100845' }],
					},
				],
			};
			const msg = makeMessage(DUID, (proto) => {
				if (proto === Protocol.rpc_response) return { id: 1, result: [multipleMapDto] };
				return undefined;
			});

			await listener.onMessage(msg);

			expect(areaService.setSupportedAreas).toHaveBeenCalled();
		});
	});

	describe('tryParseB01MapInfo', () => {
		it('should call setSupportedMaps and log when B01 multimap data is present', async () => {
			const logger = createMockLogger();
			const listenerWithLogger = new MapInfoListener(DUID, [], areaService, logger);
			const msg = makeB01Message(DUID, (key) => {
				if (key === Q10RequestCode.multimap) return { data: [{ id: 0, name: 'Home' }] };
				return undefined;
			});

			await listenerWithLogger.onMessage(msg);

			expect(areaService.setSupportedMaps).toHaveBeenCalled();
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('B01 multimap push'));
		});

		it('should skip when B01 multimap data is not an array', async () => {
			const msg = makeB01Message(DUID, (key) => {
				if (key === Q10RequestCode.multimap) return { op: 'list' };
				return undefined;
			});

			await listener.onMessage(msg);

			expect(areaService.setSupportedMaps).not.toHaveBeenCalled();
		});
	});

	describe('tryParseB01RoomMap', () => {
		it('should call setSupportedMaps and log for Q7 query_response with get_map_list method', async () => {
			const logger = createMockLogger();
			const listenerWithLogger = new MapInfoListener(DUID, [], areaService, logger);
			const msg = makeB01Message(DUID, (key) => {
				if (key === Q7RequestCode.query_response)
					return { method: Q7RequestMethod.get_map_list, data: { map_list: [{ id: 1, name: 'Home' }] } };
				return undefined;
			});

			await listenerWithLogger.onMessage(msg);

			expect(areaService.setSupportedMaps).toHaveBeenCalled();
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('B01-Q7 map list push'));
		});

		it('should not call setSupportedMaps for Q7 query_response with different method', async () => {
			const msg = makeB01Message(DUID, (key) => {
				if (key === Q7RequestCode.query_response) return { method: 'service.get_status', result: {} };
				return undefined;
			});

			await listener.onMessage(msg);

			expect(areaService.setSupportedMaps).not.toHaveBeenCalled();
		});
	});
});
