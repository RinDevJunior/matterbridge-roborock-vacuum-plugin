import { MapInfo, RoomMapping } from '../../../core/application/models/index.js';
import { MapRoomDto, MultipleMapDto, RoomDto } from './index.js';

export type RawRoomMappingEntry = [number, string] | [number, string, number | undefined];
export type RawRoomMappingData = RawRoomMappingEntry[];

export const HomeModelMapper = {
	toRoomMapping(dto: MapRoomDto, rooms: RoomDto[]): RoomMapping {
		const room = rooms.find((r) => r.id === dto.id || String(r.id) === dto.iot_name_id);
		return {
			id: dto.id,
			iot_name_id: dto.iot_name_id,
			tag: dto.tag,
			iot_map_id: dto.iot_map_id ?? 0,
			iot_name: room?.name ?? dto.iot_name ?? `Room ${dto.id}`,
		} satisfies RoomMapping;
	},

	rawArrayToMapRoomDto(raw: RawRoomMappingEntry, activeMap: number): MapRoomDto {
		return {
			id: raw[0],
			iot_name_id: raw[1],
			tag: raw[2] ?? 0,
			iot_map_id: activeMap,
		} satisfies MapRoomDto;
	},

	rawRoomDataToRoomMappings(
		rawData: RawRoomMappingData,
		mapId: number,
		mapInfo: MapInfo,
		rooms: RoomDto[],
	): RoomMapping[] {
		return rawData
			.map((entry) => this.rawArrayToMapRoomDto(entry, mapId))
			.map((dto) => this.enrichMapRoomDtoFromMapInfo(dto, mapInfo))
			.map((dto) => this.toRoomMapping(dto, rooms));
	},

	enrichMapRoomDtoFromMapInfo(dto: MapRoomDto, mapInfo: MapInfo): MapRoomDto {
		if (dto.iot_name) {
			return dto;
		}

		const { allRooms } = mapInfo;
		const cached =
			allRooms.find((room) => room.id === dto.id && room.iot_name_id === dto.iot_name_id) ??
			allRooms.find((room) => room.id === dto.id) ??
			allRooms.find((room) => room.iot_name_id === dto.iot_name_id);

		if (cached?.iot_name) {
			return { ...dto, iot_name: cached.iot_name };
		}

		return dto;
	},

	toMapInfo(dto: MultipleMapDto): MapInfo {
		return new MapInfo(dto);
	},
};
