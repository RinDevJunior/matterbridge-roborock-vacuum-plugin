import { describe, expect, it } from 'vitest';

import { MapInfo } from '../../../../core/application/models/MapInfo.js';
import type { MapRoomDto, MultipleMapDto, RoomDto } from '../../../../roborockCommunication/models/home/index.js';
import { HomeModelMapper } from '../../../../roborockCommunication/models/home/mappers.js';

function buildMapInfo(rooms: MapRoomDto[]): MapInfo {
	return new MapInfo({
		max_multi_map: 1,
		max_bak_map: 0,
		multi_map_count: 1,
		map_info: [{ mapFlag: 0, add_time: 0, length: 0, name: 'Map', bak_maps: [], rooms }],
	});
}

describe('HomeModelMapper.toRoomMapping', () => {
	it('should default iot_map_id to 0 when the dto omits it', () => {
		// Arrange
		const dto: MapRoomDto = { id: 1, tag: 2, iot_name_id: '10', iot_name: 'Kitchen' };
		const rooms: RoomDto[] = [];
		// Act
		const result = HomeModelMapper.toRoomMapping(dto, rooms);
		// Assert
		expect(result.iot_map_id).toBe(0);
		expect(result.iot_name).toBe('Kitchen');
	});

	it('should use the matched room name when a room matches by id', () => {
		// Arrange
		const dto: MapRoomDto = { id: 1, tag: 0, iot_name_id: 'x', iot_name: 'Old' };
		const rooms: RoomDto[] = [{ id: 1, name: 'Lounge' }];
		// Act
		const result = HomeModelMapper.toRoomMapping(dto, rooms);
		// Assert
		expect(result.iot_name).toBe('Lounge');
	});

	it('should match a room by the string form of iot_name_id when id does not match', () => {
		// Arrange
		const dto: MapRoomDto = { id: 99, tag: 0, iot_name_id: '5' };
		const rooms: RoomDto[] = [{ id: 5, name: 'Study' }];
		// Act
		const result = HomeModelMapper.toRoomMapping(dto, rooms);
		// Assert
		expect(result.iot_name).toBe('Study');
	});

	it('should fall back to dto.iot_name when the matched room has no name', () => {
		// Arrange
		const dto: MapRoomDto = { id: 1, tag: 0, iot_name_id: 'x', iot_name: 'Hall' };
		const rooms: RoomDto[] = [{ id: 1, name: undefined }];
		// Act
		const result = HomeModelMapper.toRoomMapping(dto, rooms);
		// Assert
		expect(result.iot_name).toBe('Hall');
	});

	it('should fall back to Room <id> when no room name is available', () => {
		// Arrange
		const dto: MapRoomDto = { id: 4, tag: 0, iot_name_id: 'x' };
		// Act
		const result = HomeModelMapper.toRoomMapping(dto, []);
		// Assert
		expect(result.iot_name).toBe('Room 4');
	});
});

describe('HomeModelMapper.rawArrayToMapRoomDto', () => {
	it('should default tag to 0 when the raw tuple has only two elements', () => {
		// Arrange
		const raw: [number, string] = [3, 'abc'];
		// Act
		const result = HomeModelMapper.rawArrayToMapRoomDto(raw, 2);
		// Assert
		expect(result).toEqual({ id: 3, iot_name_id: 'abc', tag: 0, iot_map_id: 2 });
	});
});

describe('HomeModelMapper.enrichMapRoomDtoFromMapInfo', () => {
	it('should return the dto unchanged when iot_name is already set', () => {
		// Arrange
		const dto: MapRoomDto = { id: 1, tag: 0, iot_name_id: 'k', iot_name: 'Set' };
		const mapInfo = buildMapInfo([{ id: 1, tag: 0, iot_name_id: 'k', iot_name: 'Cached' }]);
		// Act
		const result = HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfo);
		// Assert
		expect(result).toBe(dto);
		expect(result.iot_name).toBe('Set');
	});

	it('should use the cached name matched by id when id and iot_name_id both differ', () => {
		// Arrange
		const dto: MapRoomDto = { id: 1, tag: 0, iot_name_id: 'nomatch' };
		const mapInfo = buildMapInfo([{ id: 1, tag: 0, iot_name_id: 'other', iot_name: 'ById' }]);
		// Act
		const result = HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfo);
		// Assert
		expect(result.iot_name).toBe('ById');
	});

	it('should use the cached name matched by iot_name_id only when id does not match', () => {
		// Arrange
		const dto: MapRoomDto = { id: 1, tag: 0, iot_name_id: 'k' };
		const mapInfo = buildMapInfo([{ id: 9, tag: 0, iot_name_id: 'k', iot_name: 'ByName' }]);
		// Act
		const result = HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfo);
		// Assert
		expect(result.iot_name).toBe('ByName');
	});

	it('should return the dto without a name when the matched cached room has no name', () => {
		// Arrange
		const dto: MapRoomDto = { id: 1, tag: 0, iot_name_id: 'k' };
		const mapInfo = buildMapInfo([{ id: 1, tag: 0, iot_name_id: 'k' }]);
		// Act
		const result = HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfo);
		// Assert
		expect(result.iot_name).toBeUndefined();
	});
});

describe('HomeModelMapper.toMapInfo', () => {
	it('should wrap a MultipleMapDto into a MapInfo with the mapped entries', () => {
		// Arrange
		const dto: MultipleMapDto = {
			max_multi_map: 4,
			max_bak_map: 0,
			multi_map_count: 1,
			map_info: [
				{
					mapFlag: 3,
					add_time: 0,
					length: 0,
					name: 'Ground',
					bak_maps: [],
					rooms: [{ id: 1, tag: 0, iot_name_id: 'a', iot_name: 'Hall' }],
				},
			],
		};
		// Act
		const result = HomeModelMapper.toMapInfo(dto);
		// Assert
		expect(result).toBeInstanceOf(MapInfo);
		expect(result.getById(3)).toBe('Ground');
		expect(result.allRooms).toHaveLength(1);
	});
});
