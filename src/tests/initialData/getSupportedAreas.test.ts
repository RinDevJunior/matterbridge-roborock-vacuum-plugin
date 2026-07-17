import { CommonAreaNamespaceTag } from 'matterbridge/matter';
import { beforeEach, describe, expect, it, test, vi } from 'vitest';

import { MapEntry, MapInfo, RoomMap } from '../../core/application/models/index.js';
import { HomeEntity } from '../../core/domain/entities/Home.js';
import { RoomEntity } from '../../core/domain/entities/Room.js';
import { getSupportedAreas, roomTypeIdToAreaTag } from '../../initialData/getSupportedAreas.js';
import type { RoomDto } from '../../roborockCommunication/models/index.js';
import { makeLogger } from '../testUtils.js';
// import { debugStringify } from 'matterbridge/logger';

const mockLogger = makeLogger();

function createHomeEntity(
	vacuumRooms: RoomDto[],
	roomMap: RoomMap | undefined,
	enableMultipleMap = false,
	mapInfos: MapEntry[] = [],
): HomeEntity {
	const mapDataDtos = mapInfos.map((entry) => ({
		mapFlag: entry.id,
		add_time: Date.now(),
		length: entry.rooms.length,
		name: entry.name ?? '',
		bak_maps: [],
		rooms: entry.rooms,
	}));
	const mapInfo = new MapInfo({
		max_multi_map: mapInfos.length,
		max_bak_map: 0,
		multi_map_count: mapInfos.length,
		map_info: mapDataDtos,
	});
	return new HomeEntity(1, 'Test Home', roomMap ?? RoomMap.empty(), mapInfo, 0);
}

describe('getSupportedAreas (legacy)', () => {
	it('returns Unknown area when vacuumRooms missing or roomMap missing', () => {
		const homeEntity = createHomeEntity([], undefined, false);
		const res = getSupportedAreas(homeEntity, makeLogger());
		expect(res.supportedAreas.length).toBe(1);
		expect(res.supportedAreas[0]?.areaInfo?.locationInfo?.locationName).toContain('Unknown');
	});

	test('enableMultipleMap returns supportedMaps', () => {
		const vacuumRooms: RoomDto[] = [{ id: 1, name: 'R1' }];
		const roomMap = new RoomMap([{ id: 10, iot_name_id: '10', tag: 0, iot_map_id: 7, iot_name: 'RoomX' }]);
		const homeEntity = createHomeEntity(vacuumRooms, roomMap, true, [{ id: 7, name: 'Level 7', rooms: [] }]);
		const res = getSupportedAreas(homeEntity, makeLogger());
		expect(res.supportedMaps.length).toBeGreaterThanOrEqual(1);
		expect(res.roomIndexMap).toBeDefined();
	});
});

describe('getSupportedAreas', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns default area when rooms and roomMap are empty (case 1)', () => {
		const vacuumRooms = [
			{ id: 2775739, name: 'Garage' },
			{ id: 1474466, name: 'Outside' },
			{ id: 1459590, name: 'AAA room' },
			{ id: 1459587, name: "BBB's Room" },
			{ id: 1459580, name: "CCC's room" },
			{ id: 1458155, name: 'Dining room' },
			{ id: 1457889, name: 'Bathroom' },
			{ id: 1457888, name: 'Living room' },
			{ id: 991195, name: 'Downstairs Bathroom' },
			{ id: 991190, name: 'Garage Entryway' },
			{ id: 991187, name: 'TV Room' },
			{ id: 991185, name: 'Bedroom' },
			{ id: 612205, name: "DDD's Room" },
			{ id: 612204, name: 'Upstairs Bathroom' },
			{ id: 612202, name: 'Hallway' },
			{ id: 612200, name: 'EEE Room' },
			{ id: 609148, name: 'Dining Room' },
			{ id: 609146, name: 'Kitchen' },
			{ id: 609145, name: 'Living Room' },
		];
		const roomMap = new RoomMap([
			{ id: 16, iot_name_id: '609146', tag: 0, iot_map_id: 0, iot_name: 'Kitchen' },
			{ id: 17, iot_name_id: '1457889', tag: 0, iot_map_id: 0, iot_name: 'Bathroom' },
			{ id: 18, iot_name_id: '612202', tag: 0, iot_map_id: 0, iot_name: 'Hallway' },
			{ id: 19, iot_name_id: '1458155', tag: 0, iot_map_id: 0, iot_name: 'Dining room' },
			{ id: 20, iot_name_id: '1457888', tag: 0, iot_map_id: 0, iot_name: 'Living room' },
			{ id: 21, iot_name_id: '1459580', tag: 0, iot_map_id: 0, iot_name: "BBB's room" },
			{ id: 22, iot_name_id: '612205', tag: 0, iot_map_id: 0, iot_name: "CCC's Room" },
			{ id: 23, iot_name_id: '1474466', tag: 0, iot_map_id: 0, iot_name: 'Outside' },
		]);
		const homeEntity = createHomeEntity(vacuumRooms, roomMap, false);
		const { supportedAreas } = getSupportedAreas(homeEntity, mockLogger);

		expect(supportedAreas.length).toEqual(8);
	});

	it('returns default area when rooms and roomMap are empty (case 2)', () => {
		const vacuumRooms = [
			{ id: 11453731, name: 'Living room' },
			{ id: 11453727, name: 'Kitchen' },
			{ id: 11453415, name: 'Bathroom' },
			{ id: 11453409, name: "Emile's Room" },
			{ id: 11453404, name: "Nadia's Room" },
			{ id: 11453398, name: 'Hallway' },
			{ id: 11453391, name: 'Dining room' },
			{ id: 11453384, name: 'Outside' },
		];
		const roomMap = new RoomMap([
			{ id: 16, iot_name_id: '2775739', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 17, iot_name_id: '991195', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 18, iot_name_id: '991187', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 19, iot_name_id: '991185', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 20, iot_name_id: '991190', tag: 0, iot_map_id: 0, iot_name: '' },
		]);
		const homeEntity = createHomeEntity(vacuumRooms, roomMap, false);
		const { supportedAreas } = getSupportedAreas(homeEntity, mockLogger);

		expect(supportedAreas.length).toEqual(5);
	});

	it('returns default area when rooms and roomMap are empty (case 3)', () => {
		const vacuumRooms = [
			{ id: 11453731, name: 'Living room' },
			{ id: 11453727, name: 'Kitchen' },
			{ id: 11453415, name: 'Bathroom' },
			{ id: 11453409, name: "Emile's Room" },
			{ id: 11453404, name: "Nadia's Room" },
			{ id: 11453398, name: 'Hallway' },
			{ id: 11453391, name: 'Dining room' },
			{ id: 11453384, name: 'Outside' },
		];
		const roomMap = new RoomMap([
			{ id: 16, iot_name_id: '2775739', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 17, iot_name_id: '991195', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 18, iot_name_id: '991187', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 19, iot_name_id: '991185', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 20, iot_name_id: '991190', tag: 0, iot_map_id: 0, iot_name: '' },
		]);
		const homeEntity = createHomeEntity(vacuumRooms, roomMap, false);
		const { supportedAreas } = getSupportedAreas(homeEntity, mockLogger);

		expect(supportedAreas.length).toEqual(5);
	});

	it('returns default area when rooms and roomMap are empty (case 4)', () => {
		const vacuumRooms: RoomDto[] = [
			{ id: 11100845, name: 'Kitchen' },
			{ id: 11100849, name: 'Study' },
			{ id: 11100842, name: 'Living room' },
			{ id: 11100847, name: 'Bedroom' },
			{ id: 12461114, name: 'Guest bedroom' },
			{ id: 12461109, name: 'Master bedroom' },
			{ id: 12461111, name: 'Balcony' },
		];
		const roomMap = new RoomMap([
			{ id: 16, iot_name_id: '2775739', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 17, iot_name_id: '991195', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 18, iot_name_id: '991187', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 19, iot_name_id: '991185', tag: 0, iot_map_id: 0, iot_name: '' },
			{ id: 20, iot_name_id: '991190', tag: 0, iot_map_id: 0, iot_name: '' },
		]);
		const homeEntity = createHomeEntity(vacuumRooms, roomMap, false);
		const { supportedAreas } = getSupportedAreas(homeEntity, mockLogger);

		expect(supportedAreas.length).toEqual(5);
	});

	it('returns default area when rooms and roomMap are empty', () => {
		const vacuumRooms: RoomDto[] = [
			{ id: 11100845, name: 'Kitchen' },
			{ id: 11100849, name: 'Study' },
			{ id: 11100842, name: 'Living room' },
			{ id: 11100847, name: 'Bedroom' },
			{ id: 11100842, name: 'Living room' },
			{ id: 12461114, name: 'Guest bedroom' },
			{ id: 12461109, name: 'Master bedroom' },
			{ id: 12461111, name: 'Balcony' },
		];
		const roomMap = new RoomMap([
			{ id: 1, iot_name_id: '11100845', tag: 14, iot_map_id: 0, iot_name: 'Kitchen' },
			{ id: 2, iot_name_id: '11100849', tag: 9, iot_map_id: 0, iot_name: 'Study' },
			{ id: 3, iot_name_id: '11100842', tag: 6, iot_map_id: 0, iot_name: 'Living room' },
			{ id: 4, iot_name_id: '11100847', tag: 1, iot_map_id: 0, iot_name: 'Bedroom' },
			{ id: 1, iot_name_id: '11100842', tag: 6, iot_map_id: 1, iot_name: 'Living room' },
			{ id: 2, iot_name_id: '12461114', tag: 3, iot_map_id: 1, iot_name: 'Guest bedroom' },
			{ id: 3, iot_name_id: '12461109', tag: 2, iot_map_id: 1, iot_name: 'Master bedroom' },
			{ id: 4, iot_name_id: '12461111', tag: 7, iot_map_id: 1, iot_name: 'Balcony' },
		]);

		const homeEntity = createHomeEntity(vacuumRooms, roomMap, true, [
			{ id: 0, name: 'First Map', rooms: [] },
			{ id: 1, name: 'Second Map', rooms: [] },
		]);
		const { supportedAreas, supportedMaps } = getSupportedAreas(homeEntity, makeLogger());
		expect(supportedAreas.length).toEqual(8);
		expect(supportedMaps.length).toEqual(2);
	});

	it('real test 1', () => {
		const vacuumRooms: RoomDto[] = [
			new RoomEntity(11100845, 'Kitchen'),
			new RoomEntity(11100849, 'Study'),
			new RoomEntity(11100842, 'Living room'),
			new RoomEntity(11100847, 'Bedroom'),
			new RoomEntity(12461114, 'Guest bedroom'),
			new RoomEntity(12461109, 'Master bedroom'),
			new RoomEntity(12461111, 'Balcony'),
		];
		const roomMap = new RoomMap([
			{ id: 1, iot_name_id: '11100845', tag: 14, iot_map_id: 0, iot_name: 'Kitchen' },
			{ id: 2, iot_name_id: '11100849', tag: 9, iot_map_id: 0, iot_name: 'Study' },
			{ id: 3, iot_name_id: '11100842', tag: 6, iot_map_id: 0, iot_name: 'Living room' },
			{ id: 4, iot_name_id: '11100847', tag: 1, iot_map_id: 0, iot_name: 'Bedroom' },
			{ id: 1, iot_name_id: '11100842', tag: 6, iot_map_id: 1, iot_name: 'Living room' },
			{ id: 2, iot_name_id: '12461114', tag: 3, iot_map_id: 1, iot_name: 'Guest bedroom' },
			{ id: 3, iot_name_id: '12461109', tag: 2, iot_map_id: 1, iot_name: 'Master bedroom' },
			{ id: 4, iot_name_id: '12461111', tag: 7, iot_map_id: 1, iot_name: 'Balcony' },
		]);

		const homeEntity = createHomeEntity(vacuumRooms, roomMap, true, [
			{ id: 0, name: 'First Map', rooms: [] },
			{ id: 1, name: 'Second Map', rooms: [] },
		]);
		const { supportedAreas, supportedMaps } = getSupportedAreas(homeEntity, makeLogger());
		expect(supportedAreas.length).toEqual(8);
		expect(supportedMaps.length).toEqual(2);

		// console.log(`Supported areas: ${JSON.stringify(supportedAreas, null, 2)} `);
		// console.log(`Supported maps: ${JSON.stringify(supportedMaps, null, 2)} `);
	});

	it('real test 2', () => {
		const roomMap = new RoomMap([
			{
				id: 16,
				iot_name_id: '12231095',
				tag: 0,
				iot_map_id: 1,
				iot_name: 'Garage',
			},
			{
				id: 17,
				iot_name_id: '12231033',
				tag: 0,
				iot_map_id: 1,
				iot_name: 'Downstairs Bathroom',
			},
			{
				id: 18,
				iot_name_id: '12231071',
				tag: 0,
				iot_map_id: 1,
				iot_name: 'TV Room',
			},
			{
				id: 19,
				iot_name_id: '12231086',
				tag: 0,
				iot_map_id: 1,
				iot_name: 'Bedroom',
			},
			{
				id: 20,
				iot_name_id: '12231061',
				tag: 0,
				iot_map_id: 1,
				iot_name: 'Garage Entryway',
			},
		]);
		const mapInfo = new MapInfo({
			max_multi_map: 1,
			max_bak_map: 1,
			multi_map_count: 1,
			map_info: [
				{
					mapFlag: 1,
					add_time: 1771001870,
					length: 10,
					name: 'Downstairs',
					bak_maps: [{ mapFlag: 4, add_time: 1771000925 }],
				},
			],
		});
		const minLogger = makeLogger();
		const homeInfo = new HomeEntity(123, 'My home', roomMap, mapInfo, 0);
		const { supportedAreas, supportedMaps } = getSupportedAreas(homeInfo, minLogger);
		const firstSupportedMap = supportedMaps.length > 0 ? supportedMaps[0] : undefined;
		const finalResult = supportedAreas.filter((area) => area.mapId === firstSupportedMap?.mapId);

		expect(finalResult.length).greaterThan(0);
	});

	it('real test 3', () => {
		const roomMap = new RoomMap([
			{
				id: 1,
				tag: 14,
				iot_name_id: '11100845',
				iot_map_id: 0,
				iot_name: 'Kitchen',
			},
			{
				id: 2,
				tag: 9,
				iot_name_id: '11100849',
				iot_map_id: 0,
				iot_name: 'Study',
			},
			{
				id: 3,
				tag: 6,
				iot_name_id: '11100842',
				iot_map_id: 0,
				iot_name: 'Living room',
			},
			{
				id: 4,
				tag: 1,
				iot_name_id: '11100847',
				iot_map_id: 0,
				iot_name: 'Bedroom',
			},
			{
				id: 1,
				tag: 6,
				iot_name_id: '11100842',
				iot_map_id: 1,
				iot_name: 'Living room',
			},
			{
				id: 2,
				tag: 3,
				iot_name_id: '12461114',
				iot_map_id: 1,
				iot_name: 'Guest bedroom',
			},
			{
				id: 3,
				tag: 2,
				iot_name_id: '12461109',
				iot_map_id: 1,
				iot_name: 'Master bedroom',
			},
			{
				id: 4,
				tag: 7,
				iot_name_id: '12461111',
				iot_map_id: 1,
				iot_name: 'Balcony',
			},
		]);

		const mapInfo = new MapInfo({
			max_multi_map: 4,
			max_bak_map: 1,
			multi_map_count: 2,
			map_info: [
				{
					mapFlag: 0,
					add_time: 1753511673,
					length: 0,
					name: 'Map 1',
					bak_maps: [
						{
							mapFlag: 4,
							add_time: 1753578164,
						},
					],
				},
				{
					mapFlag: 1,
					add_time: 1753579596,
					length: 0,
					name: 'Map 2',
					bak_maps: [
						{
							mapFlag: 5,
							add_time: 1753578579,
						},
					],
				},
			],
		});

		const minLogger = makeLogger();
		const homeInfo = new HomeEntity(123, 'My home', roomMap, mapInfo, 0);
		const { supportedAreas, supportedMaps, roomIndexMap } = getSupportedAreas(homeInfo, minLogger);

		// console.log(`supportedAreas: ${debugStringify(supportedAreas)}`);
		// console.log(`supportedMaps: ${debugStringify(supportedMaps)}`);
		// console.log(`roomIndexMap: ${debugStringify(roomIndexMap)}`);
		expect(supportedAreas.length).toEqual(8);
		expect(supportedMaps.length).toEqual(2);
	});

	describe('Regression: Areas must have a null mapId when supportedMaps is empty', () => {
		it('should return non-empty supportedMaps when mapInfo.maps is empty but real rooms exist', () => {
			// Arrange — B01 map binary before multimap push: mapInfos = [], rooms with iot_map_id: 0
			const vacuumRooms: RoomDto[] = [
				{ id: 11100845, name: 'Kitchen' },
				{ id: 11100849, name: 'Study' },
			];
			const roomMap = new RoomMap([
				{ id: 1, iot_name_id: '11100845', tag: 14, iot_map_id: 0, iot_name: 'Kitchen' },
				{ id: 2, iot_name_id: '11100849', tag: 9, iot_map_id: 0, iot_name: 'Study' },
			]);
			const homeEntity = createHomeEntity(vacuumRooms, roomMap, true, []);

			// Act
			const res = getSupportedAreas(homeEntity, makeLogger());

			// Assert — no empty supportedMaps with non-null area mapIds
			expect(res.supportedAreas[0]?.mapId).toBeGreaterThanOrEqual(0);
			expect(res.supportedMaps.length).toBeGreaterThanOrEqual(1);
			expect(res.supportedMaps.some((m) => m.mapId === res.supportedAreas[0]?.mapId)).toBe(true);
		});

		it('should create distinct placeholder maps for multiple mapIds with empty mapInfo.maps', () => {
			// Arrange — two rooms with different iot_map_ids, no mapInfos
			const vacuumRooms: RoomDto[] = [
				{ id: 11100845, name: 'Kitchen' },
				{ id: 11100849, name: 'Study' },
			];
			const roomMap = new RoomMap([
				{ id: 1, iot_name_id: '11100845', tag: 14, iot_map_id: 0, iot_name: 'Kitchen' },
				{ id: 2, iot_name_id: '11100849', tag: 9, iot_map_id: 1, iot_name: 'Study' },
			]);
			const homeEntity = createHomeEntity(vacuumRooms, roomMap, true, []);

			// Act
			const res = getSupportedAreas(homeEntity, makeLogger());

			// Assert — exactly 2 distinct maps (0 and 1), no duplicates
			expect(res.supportedMaps).toHaveLength(2);
			const mapIds = res.supportedMaps.map((m) => m.mapId);
			expect(new Set(mapIds).size).toBe(2);
			expect(mapIds).toContain(0);
			expect(mapIds).toContain(1);
			// Verify all area mapIds appear in supportedMaps
			const supportedMapIds = new Set(mapIds);
			const areasWithMissingMapIds = res.supportedAreas.filter(
				(area) => area.mapId !== null && !supportedMapIds.has(area.mapId),
			);
			expect(areasWithMissingMapIds).toHaveLength(0);
		});

		it('should not regress on fallback branch when no rooms or roomMap', () => {
			// Arrange — empty vacuum rooms and empty roomMap
			const homeEntity = createHomeEntity([], undefined, true, []);

			// Act
			const res = getSupportedAreas(homeEntity, makeLogger());

			// Assert — fallback should still produce non-empty supportedMaps with matching area mapId
			expect(res.supportedAreas).toHaveLength(1);
			expect(res.supportedMaps).toHaveLength(1);
			expect(res.supportedAreas[0]?.mapId).toBe(res.supportedMaps[0]?.mapId);
		});
	});
});

describe('roomTypeIdToAreaTag', () => {
	it('should return null for roomTypeId 0 (other/unknown)', () => {
		expect(roomTypeIdToAreaTag(0)).toBeNull();
	});

	it('should return PrimaryBedroom.tag for roomTypeId 1 (master bedroom)', () => {
		expect(roomTypeIdToAreaTag(1)).toBe(CommonAreaNamespaceTag.PrimaryBedroom.tag);
	});

	it('should return GuestBedroom.tag for roomTypeId 2', () => {
		expect(roomTypeIdToAreaTag(2)).toBe(CommonAreaNamespaceTag.GuestBedroom.tag);
	});

	it('should return Bedroom.tag for roomTypeId 3', () => {
		expect(roomTypeIdToAreaTag(3)).toBe(CommonAreaNamespaceTag.Bedroom.tag);
	});

	it('should return LivingRoom.tag for roomTypeId 4', () => {
		expect(roomTypeIdToAreaTag(4)).toBe(CommonAreaNamespaceTag.LivingRoom.tag);
	});

	it('should return Dining.tag for roomTypeId 5 (dining room)', () => {
		expect(roomTypeIdToAreaTag(5)).toBe(CommonAreaNamespaceTag.Dining.tag);
	});

	it('should return Kitchen.tag for roomTypeId 6', () => {
		expect(roomTypeIdToAreaTag(6)).toBe(CommonAreaNamespaceTag.Kitchen.tag);
	});

	it('should return Balcony.tag for roomTypeId 7', () => {
		expect(roomTypeIdToAreaTag(7)).toBe(CommonAreaNamespaceTag.Balcony.tag);
	});

	it('should return Bathroom.tag for roomTypeId 8', () => {
		expect(roomTypeIdToAreaTag(8)).toBe(CommonAreaNamespaceTag.Bathroom.tag);
	});

	it('should return Hallway.tag for roomTypeId 9 (entrance hall)', () => {
		expect(roomTypeIdToAreaTag(9)).toBe(CommonAreaNamespaceTag.Hallway.tag);
	});

	it('should return Study.tag for roomTypeId 10', () => {
		expect(roomTypeIdToAreaTag(10)).toBe(CommonAreaNamespaceTag.Study.tag);
	});

	it('should return Corridor.tag for roomTypeId 11', () => {
		expect(roomTypeIdToAreaTag(11)).toBe(CommonAreaNamespaceTag.Corridor.tag);
	});

	it('should return null for unknown roomTypeId 99', () => {
		expect(roomTypeIdToAreaTag(99)).toBeNull();
	});
});

describe('roomTypeIdToAreaTag — B01 extended IDs 2001–2011', () => {
	it('should return Bedroom.tag for roomTypeId 2001 (bedroom)', () => {
		expect(roomTypeIdToAreaTag(2001)).toBe(CommonAreaNamespaceTag.Bedroom.tag);
	});

	it('should return Dining.tag for roomTypeId 2002 (dinnerroom)', () => {
		expect(roomTypeIdToAreaTag(2002)).toBe(CommonAreaNamespaceTag.Dining.tag);
	});

	it('should return Bathroom.tag for roomTypeId 2003 (restroom)', () => {
		expect(roomTypeIdToAreaTag(2003)).toBe(CommonAreaNamespaceTag.Bathroom.tag);
	});

	it('should return Corridor.tag for roomTypeId 2004 (corridor)', () => {
		expect(roomTypeIdToAreaTag(2004)).toBe(CommonAreaNamespaceTag.Corridor.tag);
	});

	it('should return Kitchen.tag for roomTypeId 2005 (kitchen)', () => {
		expect(roomTypeIdToAreaTag(2005)).toBe(CommonAreaNamespaceTag.Kitchen.tag);
	});

	it('should return LivingRoom.tag for roomTypeId 2006 (livingroom)', () => {
		expect(roomTypeIdToAreaTag(2006)).toBe(CommonAreaNamespaceTag.LivingRoom.tag);
	});

	it('should return Balcony.tag for roomTypeId 2007 (balcony)', () => {
		expect(roomTypeIdToAreaTag(2007)).toBe(CommonAreaNamespaceTag.Balcony.tag);
	});

	it('should return Study.tag for roomTypeId 2008 (study)', () => {
		expect(roomTypeIdToAreaTag(2008)).toBe(CommonAreaNamespaceTag.Study.tag);
	});

	it('should return Hallway.tag for roomTypeId 2009 (entryway)', () => {
		expect(roomTypeIdToAreaTag(2009)).toBe(CommonAreaNamespaceTag.Hallway.tag);
	});

	it('should return PrimaryBedroom.tag for roomTypeId 2010 (masterbedrroom)', () => {
		expect(roomTypeIdToAreaTag(2010)).toBe(CommonAreaNamespaceTag.PrimaryBedroom.tag);
	});

	it('should return GuestBedroom.tag for roomTypeId 2011 (guestbedrroom)', () => {
		expect(roomTypeIdToAreaTag(2011)).toBe(CommonAreaNamespaceTag.GuestBedroom.tag);
	});

	it('should return null for roomTypeId 2012 (boundary — above range)', () => {
		expect(roomTypeIdToAreaTag(2012)).toBeNull();
	});

	it('should return null for roomTypeId 2000 (below B01 extended range)', () => {
		expect(roomTypeIdToAreaTag(2000)).toBeNull();
	});
});

describe('populateAreaNamespaceTag — B01 pre-computed areaType', () => {
	it('should use pre-computed areaType when tag is 0 and areaType is Kitchen.tag', () => {
		// Arrange
		const roomMap = new RoomMap([
			{
				id: 1,
				iot_name_id: '1',
				tag: 0,
				iot_map_id: 0,
				iot_name: 'Kitchen',
				areaType: CommonAreaNamespaceTag.Kitchen.tag,
			},
		]);
		const homeEntity = createHomeEntity([], roomMap);

		// Act
		const { supportedAreas } = getSupportedAreas(homeEntity, makeLogger());

		// Assert — pre-computed areaType wins over tag=0 (which would give null)
		expect(supportedAreas[0]?.areaInfo?.locationInfo?.areaType).toBe(CommonAreaNamespaceTag.Kitchen.tag);
	});

	it('should use pre-computed areaType even when it overrides V10 tag=6 (LivingRoom)', () => {
		// Arrange: tag 6 would give LivingRoom in V10 switch, but areaType says Bedroom
		const roomMap = new RoomMap([
			{
				id: 1,
				iot_name_id: '1',
				tag: 6,
				iot_map_id: 0,
				iot_name: 'Room',
				areaType: CommonAreaNamespaceTag.Bedroom.tag,
			},
		]);
		const homeEntity = createHomeEntity([], roomMap);

		// Act
		const { supportedAreas } = getSupportedAreas(homeEntity, makeLogger());

		// Assert — pre-computed Bedroom wins over tag=6 (LivingRoom)
		expect(supportedAreas[0]?.areaInfo.locationInfo?.areaType).toBe(CommonAreaNamespaceTag.Bedroom.tag);
	});

	it('should return null when pre-computed areaType is explicitly null', () => {
		// Arrange
		const roomMap = new RoomMap([{ id: 1, iot_name_id: '1', tag: 0, iot_map_id: 0, iot_name: 'Room', areaType: null }]);
		const homeEntity = createHomeEntity([], roomMap);

		// Act
		const { supportedAreas } = getSupportedAreas(homeEntity, makeLogger());

		// Assert
		expect(supportedAreas[0]?.areaInfo.locationInfo?.areaType).toBeNull();
	});

	it('should fall through to V10 switch when areaType is undefined (tag 14 → Kitchen)', () => {
		// Arrange: no areaType set → V10 path; tag 14 = Kitchen in V10
		const roomMap = new RoomMap([{ id: 1, iot_name_id: '1', tag: 14, iot_map_id: 0, iot_name: 'Kitchen' }]);
		const homeEntity = createHomeEntity([], roomMap);

		// Act
		const { supportedAreas } = getSupportedAreas(homeEntity, makeLogger());

		// Assert — V10 path intact
		expect(supportedAreas[0]?.areaInfo.locationInfo?.areaType).toBe(CommonAreaNamespaceTag.Kitchen.tag);
	});

	it('should use B01 extended ID 2005 pre-computed areaType (Kitchen) via getSupportedAreas', () => {
		// Arrange: B01 device reports roomTypeId 2005 → areaType pre-computed as Kitchen.tag
		const roomMap = new RoomMap([
			{
				id: 1,
				iot_name_id: '1',
				tag: 0,
				iot_map_id: 0,
				iot_name: 'Kitchen',
				areaType: roomTypeIdToAreaTag(2005),
			},
		]);
		const homeEntity = createHomeEntity([], roomMap);

		// Act
		const { supportedAreas } = getSupportedAreas(homeEntity, makeLogger());

		// Assert — pre-computed Kitchen.tag from B01 extended ID 2005 wins over tag=0 (null)
		expect(supportedAreas[0]?.areaInfo.locationInfo?.areaType).toBe(CommonAreaNamespaceTag.Kitchen.tag);
	});
});

describe('populateAreaNamespaceTag — V10 tag switch', () => {
	function getSingleAreaType(tag: number): number | null | undefined {
		const roomMap = new RoomMap([{ id: 1, iot_name_id: '1', tag, iot_map_id: 0, iot_name: 'Room' }]);
		const homeEntity = createHomeEntity([], roomMap);
		const { supportedAreas } = getSupportedAreas(homeEntity, makeLogger());
		return supportedAreas[0]?.areaInfo.locationInfo?.areaType;
	}

	it('should return Bedroom.tag for tag 1', () => {
		expect(getSingleAreaType(1)).toBe(CommonAreaNamespaceTag.Bedroom.tag);
	});

	it('should return PrimaryBedroom.tag for tag 2', () => {
		expect(getSingleAreaType(2)).toBe(CommonAreaNamespaceTag.PrimaryBedroom.tag);
	});

	it('should return GuestBedroom.tag for tag 3', () => {
		expect(getSingleAreaType(3)).toBe(CommonAreaNamespaceTag.GuestBedroom.tag);
	});

	it('should return LivingRoom.tag for tag 6', () => {
		expect(getSingleAreaType(6)).toBe(CommonAreaNamespaceTag.LivingRoom.tag);
	});

	it('should return Balcony.tag for tag 7', () => {
		expect(getSingleAreaType(7)).toBe(CommonAreaNamespaceTag.Balcony.tag);
	});

	it('should return Study.tag for tag 9', () => {
		expect(getSingleAreaType(9)).toBe(CommonAreaNamespaceTag.Study.tag);
	});

	it('should return Kitchen.tag for tag 14', () => {
		expect(getSingleAreaType(14)).toBe(CommonAreaNamespaceTag.Kitchen.tag);
	});

	it('should return null for tag 0 (fallback)', () => {
		expect(getSingleAreaType(0)).toBeNull();
	});

	it('should return null for unknown tag 99', () => {
		expect(getSingleAreaType(99)).toBeNull();
	});
});
