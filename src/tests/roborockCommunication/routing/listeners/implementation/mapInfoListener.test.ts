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
		const setSupportedAreas = vi.fn();
		const setSupportedAreaIndexMap = vi.fn();
		const setSupportedMaps = vi.fn();
		const mergeSupportedAreasForMap = vi.fn();
		areaService = asPartial<AreaManagementService>({
			setSupportedAreas,
			setSupportedAreaIndexMap,
			setSupportedMaps,
			mergeSupportedAreasForMap,
			applySupportedAreasResult: vi.fn((_duid, result, mergeMapId) => {
				setSupportedMaps(result.supportedMaps);
				if (mergeMapId !== undefined) {
					mergeSupportedAreasForMap(_duid, mergeMapId, result.supportedAreas, result.roomIndexMap);
					setSupportedAreaIndexMap(_duid, result.roomIndexMap);
					setSupportedAreas(_duid, result.supportedAreas);
				} else {
					setSupportedAreaIndexMap(_duid, result.roomIndexMap);
					setSupportedAreas(_duid, result.supportedAreas);
				}
			}),
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
		function getAreasPassedToService(): ServiceArea.Area[] {
			const calls = vi.mocked(areaService.setSupportedAreas).mock.calls;
			const lastCall = calls[calls.length - 1];
			return lastCall ? (lastCall[1] as ServiceArea.Area[]) : [];
		}

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

		it('should preserve map_info room names when map info is received before room map', async () => {
			const partialRooms = [{ id: 12231095, name: 'Hallway from cloud' }];
			listener = new MapInfoListener(DUID, partialRooms as never, areaService, createMockLogger());

			const multipleMapDto = {
				max_multi_map: 1,
				max_bak_map: 0,
				multi_map_count: 1,
				map_info: [
					{
						mapFlag: 0,
						add_time: 0,
						length: 5,
						name: 'Home',
						bak_maps: [],
						rooms: [
							{ id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Living' },
							{ id: 2, tag: 9, iot_name_id: '11100849', iot_name: 'Bathroom' },
							{ id: 3, tag: 6, iot_name_id: '11100842', iot_name: 'Kitchen' },
							{ id: 4, tag: 1, iot_name_id: '11100847', iot_name: 'Bedroom' },
							{ id: 5, tag: 10, iot_name_id: '12231095', iot_name: 'Hallway' },
						],
					},
				],
			};
			const mapInfoMsg = makeV1Message(DUID, multipleMapDto);
			const rawRoomMap = [
				[1, '11100845', 14],
				[2, '11100849', 9],
				[3, '11100842', 6],
				[4, '11100847', 1],
				[5, '12231095', 10],
			];
			const roomMapMsg = makeV1Message(DUID, rawRoomMap);

			await listener.onMessage(mapInfoMsg);
			await listener.onMessage(roomMapMsg);

			const areas = getAreasPassedToService();
			const expectedNames = ['Living', 'Bathroom', 'Kitchen', 'Bedroom', 'Hallway from cloud'];
			expect(areas).toHaveLength(5);
			for (let i = 0; i < 5; i++) {
				expect(areas[i]?.areaInfo?.locationInfo?.locationName).toBe(expectedNames[i]);
			}
		});

		it('should use resolved mapId from cached V1 map info', async () => {
			const multipleMapDto = {
				max_multi_map: 1,
				max_bak_map: 0,
				multi_map_count: 1,
				map_info: [
					{
						mapFlag: 1,
						add_time: 0,
						length: 1,
						name: 'Floor 2',
						bak_maps: [],
						rooms: [{ id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' }],
					},
				],
			};
			const mapInfoMsg = makeV1Message(DUID, multipleMapDto);
			const rawRoomMap = [[1, '11100845', 14]];
			const roomMapMsg = makeV1Message(DUID, rawRoomMap);

			await listener.onMessage(mapInfoMsg);
			await listener.onMessage(roomMapMsg);

			const areas = getAreasPassedToService();
			expect(areas).toHaveLength(1);
			expect(areas[0]?.mapId).toBe(1);
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

		it('should not produce invalid Areas/supportedMaps when B01 binary arrives before multimap push', async () => {
			// Arrange — B01 map binary arriving before any multimap/query_response push (reproduces real race)
			const logger = createMockLogger();
			const listenerWithDevice = new MapInfoListener(DUID, [], areaService, logger, 'roborock.vacuum.a27', 'ABC123');
			vi.spyOn(
				(listenerWithDevice as unknown as { b01MapParser: { parseRoomsFromEncryptedBinary: ReturnType<typeof vi.fn> } })
					.b01MapParser,
				'parseRoomsFromEncryptedBinary',
			).mockReturnValue({
				rooms: [
					{ roomId: 5, roomName: 'Kitchen', roomTypeId: 6, colorId: 3 },
					{ roomId: 6, roomName: 'Study', roomTypeId: 10, colorId: 7 },
				],
				mapId: undefined,
			});

			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('mock');
				return undefined;
			});

			// Act — send binary WITHOUT sending multimap/query_response first (pendingB01MapInfo stays undefined)
			await listenerWithDevice.onMessage(msg);

			// Assert — capture the real SupportedAreasResult passed to applySupportedAreasResult
			const applySupportedAreasResultCalls = vi.mocked(areaService.applySupportedAreasResult).mock.calls;
			expect(applySupportedAreasResultCalls.length).toBeGreaterThan(0);
			const lastCall = applySupportedAreasResultCalls[applySupportedAreasResultCalls.length - 1];

			const result = lastCall[1] as unknown as {
				supportedAreas: ServiceArea.Area[];
				supportedMaps: ServiceArea.Map[];
			};
			expect(result.supportedMaps.length).toBeGreaterThan(0);

			// Verify the invariant: all non-null area mapIds must appear in supportedMaps
			const supportedMapIds = new Set(result.supportedMaps.map((m) => m.mapId));
			const areasWithInvalidMapIds = result.supportedAreas.filter(
				(area) => area.mapId !== null && !supportedMapIds.has(area.mapId),
			);
			expect(areasWithInvalidMapIds).toHaveLength(0);
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
			expect(areas[0]?.areaInfo.locationInfo?.areaType).toBe(CommonAreaNamespaceTag.Kitchen.tag);
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
			expect(areas[0]?.areaInfo.locationInfo?.areaType).toBeNull();
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
			expect(areas[0]?.areaInfo.locationInfo?.areaType).toBe(CommonAreaNamespaceTag.LivingRoom.tag);
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
			expect(areas[0]?.areaInfo.locationInfo?.areaType).toBe(CommonAreaNamespaceTag.Kitchen.tag);
		});
	});

	describe('tryParseV1MapBinary', () => {
		it('should skip when device protocol is not V1 (protocol gate)', async () => {
			// Arrange
			const onV1RoomResolved = vi.fn();
			const sessionNonce = vi.fn().mockReturnValue(Buffer.from('nonce'));
			const listenerB01 = new MapInfoListener(
				DUID,
				[],
				areaService,
				createMockLogger(),
				'roborock.vacuum.b01',
				'SER',
				undefined,
				ProtocolVersion.B01, // Not V1
				true,
				true,
				sessionNonce,
				onV1RoomResolved,
			);

			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('binary');
				return undefined;
			});

			// Act
			await listenerB01.onMessage(msg);

			// Assert
			expect(onV1RoomResolved).not.toHaveBeenCalled();
			expect(sessionNonce).not.toHaveBeenCalled(); // Protocol gate prevents nonce call
		});

		it('should return early without error when sessionNonce is undefined (nonce not ready yet)', async () => {
			// Arrange
			const onV1RoomResolved = vi.fn();
			const sessionNonce = vi.fn().mockReturnValue(undefined); // Nonce not ready
			const listenerV1 = new MapInfoListener(
				DUID,
				[],
				areaService,
				createMockLogger(),
				undefined,
				undefined,
				undefined,
				ProtocolVersion.V1,
				true,
				true,
				sessionNonce,
				onV1RoomResolved,
			);

			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('data');
				return undefined;
			});

			// Act & Assert — should not throw and not call callback
			await expect(listenerV1.onMessage(msg)).resolves.toBeUndefined();
			expect(onV1RoomResolved).not.toHaveBeenCalled();
		});

		it('should return early when message body has no map_response', async () => {
			// Arrange
			const onV1RoomResolved = vi.fn();
			const sessionNonce = vi.fn().mockReturnValue(Buffer.from('nonce'));
			const listenerV1 = new MapInfoListener(
				DUID,
				[],
				areaService,
				createMockLogger(),
				undefined,
				undefined,
				undefined,
				ProtocolVersion.V1,
				true,
				true,
				sessionNonce,
				onV1RoomResolved,
			);

			const msg = makeB01Message(DUID, () => undefined); // No map_response key

			// Act
			await listenerV1.onMessage(msg);

			// Assert
			expect(onV1RoomResolved).not.toHaveBeenCalled();
			expect(sessionNonce).not.toHaveBeenCalled(); // Early return before nonce is needed
		});

		it('should not throw when onV1RoomResolved callback is not provided (backward compatibility)', async () => {
			// Arrange — existing test call sites that don't pass the new params
			const sessionNonce = vi.fn().mockReturnValue(Buffer.from('nonce'));
			const listenerV1 = new MapInfoListener(
				DUID,
				[],
				areaService,
				createMockLogger(),
				undefined,
				undefined,
				undefined,
				ProtocolVersion.V1,
				true,
				true,
				sessionNonce,
				// onV1RoomResolved not provided — callback is optional
			);

			const msg = makeB01Message(DUID, (key) => {
				if (key === Protocol.map_response) return Buffer.from('data');
				return undefined;
			});

			// Act & Assert — should not throw
			await expect(listenerV1.onMessage(msg)).resolves.toBeUndefined();
		});

		it('should return early when message body is missing', async () => {
			// Arrange
			const onV1RoomResolved = vi.fn();
			const sessionNonce = vi.fn().mockReturnValue(Buffer.from('nonce'));
			const listenerV1 = new MapInfoListener(
				DUID,
				[],
				areaService,
				createMockLogger(),
				undefined,
				undefined,
				undefined,
				ProtocolVersion.V1,
				true,
				true,
				sessionNonce,
				onV1RoomResolved,
			);

			// Message with no body
			const msg = asPartial<ResponseMessage>({
				duid: DUID,
				body: undefined,
				get: vi.fn(),
			});

			// Act
			await listenerV1.onMessage(msg);

			// Assert
			expect(onV1RoomResolved).not.toHaveBeenCalled();
		});
	});
});
