import { describe, expect, it } from 'vitest';

import { MapInfo } from '../../../../core/application/models/MapInfo.js';
import { MapRoomDto, MultipleMapDto } from '../../../../roborockCommunication/models/home/index.js';
import { HomeModelMapper } from '../../../../roborockCommunication/models/home/mappers.js';

function createMapInfoWithRooms(rooms: { id: number; tag: number; iot_name_id: string; iot_name: string }[]): MapInfo {
	const multimap = {
		max_multi_map: 1,
		max_bak_map: 0,
		multi_map_count: 1,
		map_info: [
			{
				mapFlag: 0,
				add_time: 1771060270,
				length: rooms.length,
				name: 'Home',
				bak_maps: [],
				rooms,
			},
		],
	} satisfies MultipleMapDto;

	return new MapInfo(multimap);
}

describe('HomeModelMapper', () => {
	describe('enrichMapRoomDtoFromMapInfo', () => {
		it('should enrich DTO with iot_name when exact id and iot_name_id match cached room', () => {
			const mapInfo = createMapInfoWithRooms([{ id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' }]);
			const dto: MapRoomDto = { id: 1, iot_name_id: '11100845', tag: 14 };

			const result = HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfo);

			expect(result).toEqual({ id: 1, iot_name_id: '11100845', tag: 14, iot_name: 'Kitchen' });
		});

		it('should return DTO unchanged when dto already has iot_name', () => {
			const mapInfo = createMapInfoWithRooms([{ id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' }]);
			const dto: MapRoomDto = { id: 1, iot_name_id: '11100845', tag: 14, iot_name: 'Existing' };

			const result = HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfo);

			expect(result).toBe(dto);
			expect(result.iot_name).toBe('Existing');
		});

		it('should return DTO unchanged when mapInfo cache has no matching room', () => {
			const mapInfo = MapInfo.empty();
			const dto: MapRoomDto = { id: 1, iot_name_id: '11100845', tag: 14 };

			const result = HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfo);

			expect(result).toEqual(dto);
			expect(result.iot_name).toBeUndefined();
		});

		it('should enrich via id-only fallback when iot_name_id differs but id matches cached room', () => {
			const mapInfo = createMapInfoWithRooms([{ id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' }]);
			const dto: MapRoomDto = { id: 1, iot_name_id: '99999999', tag: 14 };

			const result = HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfo);

			expect(result).toEqual({ id: 1, iot_name_id: '99999999', tag: 14, iot_name: 'Kitchen' });
		});
	});
});
