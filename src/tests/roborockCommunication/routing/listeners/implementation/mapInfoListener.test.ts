import { CommonAreaNamespaceTag } from 'matterbridge/matter';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProtocolVersion } from '../../../../../roborockCommunication/enums/protocolVersion.js';
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

	describe('tryParseB01MapBinary', () => {
		it('should update areas when B01 map binary contains rooms', async () => {
			const logger = createMockLogger();
			const listenerWithDevice = new MapInfoListener(DUID, [], areaService, logger, 'roborock.vacuum.a27', 'ABC123');
			const parseRoomsSpy = vi
				.spyOn(
					(
						listenerWithDevice as unknown as {
							b01MapParser: { parseRoomsFromEncryptedBinary: ReturnType<typeof vi.fn> };
						}
					).b01MapParser,
					'parseRoomsFromEncryptedBinary',
				)
				.mockReturnValue({
					rooms: [{ roomId: 5, roomName: 'rr_bedroom', roomTypeId: 3, colorId: 0 }],
					mapId: undefined,
				});

			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('mock');
				return undefined;
			});
			await listenerWithDevice.onMessage(msg);

			expect(parseRoomsSpy).toHaveBeenCalled();
			expect(areaService.setSupportedAreas).toHaveBeenCalled();
		});

		it('should skip B01 binary parse when device is V1', async () => {
			const listenerV1 = new MapInfoListener(
				DUID,
				[],
				areaService,
				createMockLogger(),
				'some.model',
				'SER',
				undefined,
				ProtocolVersion.V1,
			);
			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('mock');
				return undefined;
			});
			await listenerV1.onMessage(msg);
			expect(areaService.setSupportedAreas).not.toHaveBeenCalled();
		});

		it('should warn and skip when model or serial is missing', async () => {
			const logger = createMockLogger();
			const listenerNoModel = new MapInfoListener(DUID, [], areaService, logger);
			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('mock');
				return undefined;
			});
			await listenerNoModel.onMessage(msg);
			expect(areaService.setSupportedAreas).not.toHaveBeenCalled();
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('missing model/serial'));
		});

		it('should skip and log when B01 map binary has no rooms', async () => {
			const logger = createMockLogger();
			const listenerWithDevice = new MapInfoListener(DUID, [], areaService, logger, 'roborock.vacuum.a27', 'ABC123');
			vi.spyOn(
				(listenerWithDevice as unknown as { b01MapParser: { parseRoomsFromEncryptedBinary: ReturnType<typeof vi.fn> } })
					.b01MapParser,
				'parseRoomsFromEncryptedBinary',
			).mockReturnValue({ rooms: [], mapId: undefined });

			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('mock');
				return undefined;
			});
			await listenerWithDevice.onMessage(msg);

			expect(areaService.setSupportedAreas).not.toHaveBeenCalled();
			expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('B01 map binary has no rooms'));
		});

		it('should warn and skip when B01 map binary parse throws', async () => {
			const logger = createMockLogger();
			const listenerWithDevice = new MapInfoListener(DUID, [], areaService, logger, 'roborock.vacuum.a27', 'ABC123');
			vi.spyOn(
				(listenerWithDevice as unknown as { b01MapParser: { parseRoomsFromEncryptedBinary: ReturnType<typeof vi.fn> } })
					.b01MapParser,
				'parseRoomsFromEncryptedBinary',
			).mockImplementation(() => {
				throw new Error('parse error');
			});

			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('mock');
				return undefined;
			});
			await listenerWithDevice.onMessage(msg);

			expect(areaService.setSupportedAreas).not.toHaveBeenCalled();
			expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('failed to parse B01 map binary'));
		});
	});

	describe('B01 binary parse — roomTypeId → areaType', () => {
		function makeB01ListenerWithSpy(
			roomData: { roomId: number; roomName: string; roomTypeId: number; colorId: number }[],
		) {
			const logger = createMockLogger();
			const listener = new MapInfoListener(DUID, [], areaService, logger, 'roborock.vacuum.a27', 'ABC123');
			vi.spyOn(
				(listener as unknown as { b01MapParser: { parseRoomsFromEncryptedBinary: ReturnType<typeof vi.fn> } })
					.b01MapParser,
				'parseRoomsFromEncryptedBinary',
			).mockReturnValue({ rooms: roomData, mapId: undefined });
			return listener;
		}

		function getAreasPassedToService(): ServiceArea.Area[] {
			const calls = vi.mocked(areaService.setSupportedAreas).mock.calls;
			const lastCall = calls[calls.length - 1];
			return lastCall ? (lastCall[1] as ServiceArea.Area[]) : [];
		}

		it('should set areaType to Kitchen.tag when roomTypeId is 6 (B01 kitchen)', async () => {
			// Arrange
			const listener = makeB01ListenerWithSpy([{ roomId: 1, roomName: 'rr_kitchen', roomTypeId: 6, colorId: 3 }]);
			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('mock');
				return undefined;
			});

			// Act
			await listener.onMessage(msg);

			// Assert — roomTypeId 6 = Kitchen in B01 scheme (not colorId-based)
			const areas = getAreasPassedToService();
			expect(areas.length).toBeGreaterThan(0);
			expect(areas[0]?.areaInfo.locationInfo.areaType).toBe(CommonAreaNamespaceTag.Kitchen.tag);
		});

		it('should set areaType to null when roomTypeId is 0 (unknown type)', async () => {
			// Arrange
			const listener = makeB01ListenerWithSpy([{ roomId: 2, roomName: '', roomTypeId: 0, colorId: 0 }]);
			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('mock');
				return undefined;
			});

			// Act
			await listener.onMessage(msg);

			// Assert
			const areas = getAreasPassedToService();
			expect(areas.length).toBeGreaterThan(0);
			expect(areas[0]?.areaInfo.locationInfo.areaType).toBeNull();
		});

		it('should set areaType to LivingRoom.tag when roomTypeId is 4', async () => {
			// Arrange
			const listener = makeB01ListenerWithSpy([{ roomId: 3, roomName: 'rr_living_room', roomTypeId: 4, colorId: 7 }]);
			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('mock');
				return undefined;
			});

			// Act
			await listener.onMessage(msg);

			// Assert — roomTypeId 4 = LivingRoom in B01 scheme (colorId 7 would give null in V10)
			const areas = getAreasPassedToService();
			expect(areas.length).toBeGreaterThan(0);
			expect(areas[0]?.areaInfo.locationInfo.areaType).toBe(CommonAreaNamespaceTag.LivingRoom.tag);
		});

		it('should use V10 tag switch for V1 path (tag 14 → Kitchen)', async () => {
			// Arrange — V1 path: no areaType override, tag comes from raw map data
			const rawData = [[1, '11100845', 14]];
			const msg = makeV1Message(DUID, rawData);

			// Act
			await listener.onMessage(msg);

			// Assert — V1 area uses tag switch: tag 14 = Kitchen
			const areas = getAreasPassedToService();
			expect(areas.length).toBeGreaterThan(0);
			expect(areas[0]?.areaInfo.locationInfo.areaType).toBe(CommonAreaNamespaceTag.Kitchen.tag);
		});
	});
});
