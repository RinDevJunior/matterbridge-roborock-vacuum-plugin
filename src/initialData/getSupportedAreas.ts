import { randomInt } from 'node:crypto';

import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { CommonAreaNamespaceTag } from 'matterbridge/matter';
import { ServiceArea } from 'matterbridge/matter/clusters';

import { DEFAULT_AREA_ID_UNKNOWN, RANDOM_ROOM_MAX, RANDOM_ROOM_MIN } from '../constants/index.js';
import { MapInfo, RoomIndexMap, RoomMap, RoomMapping } from '../core/application/models/index.js';
import { HomeEntity } from '../core/domain/entities/Home.js';

export interface AreaInfo {
	mapId: number | null;
	roomId: number;
	roomName: string;
}

export interface SegmentInfo {
	areaId: number;
	mapId: number;
	roomName: string;
}

interface ProcessedData {
	supportedAreas: ServiceArea.Area[];
	areaInfos: Map<number, AreaInfo>;
	roomInfos: Map<string, SegmentInfo>;
}

/**
 * Create a fallback service area for error cases.
 * @param areaId - Unique identifier for the area
 * @param reason - Reason for the fallback area creation
 * @returns Fallback service area configuration
 */
function createFallbackArea(areaId: number, reason: string): ServiceArea.Area {
	return {
		areaId,
		mapId: 0,
		areaInfo: {
			locationInfo: {
				locationName: `Unknown - ${reason}`,
				floorNumber: 0,
				areaType: null,
			},
			landmarkInfo: null,
		},
	};
}

export interface SupportedAreasResult {
	supportedAreas: ServiceArea.Area[];
	supportedMaps: ServiceArea.Map[];
	roomIndexMap: RoomIndexMap;
}

export function toSupportedMaps(mapInfo: MapInfo, enableMultipleMap = true): ServiceArea.Map[] {
	const maps = enableMultipleMap ? mapInfo.maps : mapInfo.maps.slice(0, 1);
	return maps.map((map) => ({
		mapId: map.id,
		name: map.name ?? `Map ${map.id}`,
	}));
}

/**
 * Build placeholder supportedMaps entries for areas with non-null mapIds when no real maps are available.
 * Extracts distinct mapIds from areas and creates a synthetic map entry for each.
 * @param areas - Service areas to extract distinct mapIds from
 * @returns Array of placeholder map entries, one per distinct non-null mapId found
 */
function buildPlaceholderSupportedMaps(areas: ServiceArea.Area[]): ServiceArea.Map[] {
	const distinctMapIds = [...new Set(areas.map((a) => a.mapId).filter((id): id is number => id !== null))];
	return distinctMapIds.map((mapId) => ({ mapId, name: `Map ${mapId}` }));
}

/**
 * Convert vacuum rooms and room map to Matter ServiceArea areas.
 * Handles single and multiple map configurations.
 * @param homeInFo - Home entity containing room and map information
 * @param logger - Logger for debugging and error reporting
 * @param enableMultipleMap - When false, expose only the primary map and its rooms
 * @returns Supported areas, maps, and room index mapping
 */
export function getSupportedAreas(
	homeInFo: HomeEntity,
	logger: AnsiLogger,
	enableMultipleMap = true,
): SupportedAreasResult {
	logger.debug('getSupportedAreas-vacuum room', debugStringify(homeInFo.rawRooms));
	logger.debug('getSupportedAreas-roomMap', homeInFo.roomMap ? debugStringify(homeInFo.roomMap) : 'undefined');

	const noVacuumRooms = !homeInFo.rawRooms || homeInFo.rawRooms.length === 0;
	const noRoomMap = !homeInFo.roomMap?.rooms || homeInFo.roomMap.rooms.length === 0;

	if (noVacuumRooms || noRoomMap) {
		if (noVacuumRooms) {
			logger.error('No rooms found');
		}
		if (noRoomMap) {
			logger.error('No room map found');
		}

		return {
			supportedAreas: [createFallbackArea(DEFAULT_AREA_ID_UNKNOWN, 'No Room')],
			supportedMaps: [{ mapId: 0, name: 'Default Map' }],
			roomIndexMap: new RoomIndexMap(
				new Map([[DEFAULT_AREA_ID_UNKNOWN, { roomId: DEFAULT_AREA_ID_UNKNOWN, mapId: 0, roomName: 'No Room' }]]), // areaInfo
				new Map([[`${DEFAULT_AREA_ID_UNKNOWN}-0`, { areaId: DEFAULT_AREA_ID_UNKNOWN, mapId: 0, roomName: 'No Room' }]]), // roomInfos
			),
		};
	}

	const entityForProcessing = enableMultipleMap
		? homeInFo
		: new HomeEntity(
				homeInFo.id,
				homeInFo.name,
				new RoomMap(homeInFo.roomMap.getRooms(homeInFo.mapInfo.maps, false)),
				homeInFo.mapInfo,
				homeInFo.activeMapId,
			);

	const { supportedAreas, areaInfos, roomInfos } = processValidData(entityForProcessing);

	const supportedMaps = toSupportedMaps(homeInFo.mapInfo, enableMultipleMap);
	const effectiveSupportedMaps =
		supportedMaps.length > 0 ? supportedMaps : buildPlaceholderSupportedMaps(supportedAreas);

	logger.debug('getSupportedAreas - supportedAreas', debugStringify(supportedAreas));
	logger.debug('getSupportedAreas - supportedMaps', debugStringify(effectiveSupportedMaps));
	const roomIndexMap = new RoomIndexMap(areaInfos, roomInfos);

	return {
		supportedAreas,
		supportedMaps: effectiveSupportedMaps,
		roomIndexMap,
	};
}

function processValidData(homeInFo: HomeEntity): ProcessedData {
	const areaInfos = new Map<number, AreaInfo>();
	const roomInfos = new Map<string, SegmentInfo>();
	const supportedAreas: ServiceArea.Area[] = homeInFo.rawRooms.map((room, index) => {
		const locationName =
			room.iot_name ??
			homeInFo.rawRooms.find((r) => String(r.id) === room.iot_name_id || r.id === room.id)?.iot_name ??
			`Unknown Room ${randomInt(RANDOM_ROOM_MIN, RANDOM_ROOM_MAX)}`;

		const mapId = room.iot_map_id;

		areaInfos.set(index, { roomId: room.id, mapId: mapId, roomName: locationName });
		roomInfos.set(`${room.id}-${room.iot_map_id}`, { areaId: index, mapId: room.iot_map_id, roomName: locationName });

		return {
			areaId: index,
			mapId: mapId,
			areaInfo: {
				locationInfo: {
					locationName: locationName,
					floorNumber: mapId,
					areaType: populateAreaNamespaceTag(room),
				},
				landmarkInfo: null,
			},
		} satisfies ServiceArea.Area;
	});

	return {
		supportedAreas,
		areaInfos,
		roomInfos,
	};
}

/**
 * Maps a B01 roomTypeId (0–11, per ioBroker ROOM_TYPE_ID_TO_TOKEN) to a CommonAreaNamespaceTag numeric value.
 * Returns null for unknown / fallback (roomTypeId 0).
 */
export function roomTypeIdToAreaTag(roomTypeId: number): number | null {
	switch (roomTypeId) {
		case 0:
			return null;
		case 1:
			return CommonAreaNamespaceTag.PrimaryBedroom.tag;
		case 2:
			return CommonAreaNamespaceTag.GuestBedroom.tag;
		case 3:
			return CommonAreaNamespaceTag.Bedroom.tag;
		case 4:
			return CommonAreaNamespaceTag.LivingRoom.tag;
		case 5:
			return CommonAreaNamespaceTag.Dining.tag;
		case 6:
			return CommonAreaNamespaceTag.Kitchen.tag;
		case 7:
			return CommonAreaNamespaceTag.Balcony.tag;
		case 8:
			return CommonAreaNamespaceTag.Bathroom.tag;
		case 9:
			return CommonAreaNamespaceTag.Hallway.tag;
		case 10:
			return CommonAreaNamespaceTag.Study.tag;
		case 11:
			return CommonAreaNamespaceTag.Corridor.tag;
		// B01 extended room type IDs (2001–2011) — ioBroker ROOM_TYPE_MAP b01/constants.ts
		case 2001:
			return CommonAreaNamespaceTag.Bedroom.tag; // "bedroom"
		case 2002:
			return CommonAreaNamespaceTag.Dining.tag; // "dinnerroom"
		case 2003:
			return CommonAreaNamespaceTag.Bathroom.tag; // "restroom"
		case 2004:
			return CommonAreaNamespaceTag.Corridor.tag; // "corridor"
		case 2005:
			return CommonAreaNamespaceTag.Kitchen.tag; // "kitchen"
		case 2006:
			return CommonAreaNamespaceTag.LivingRoom.tag; // "livingroom"
		case 2007:
			return CommonAreaNamespaceTag.Balcony.tag; // "balcony"
		case 2008:
			return CommonAreaNamespaceTag.Study.tag; // "study"
		case 2009:
			return CommonAreaNamespaceTag.Hallway.tag; // "entryway"
		case 2010:
			return CommonAreaNamespaceTag.PrimaryBedroom.tag; // "masterbedrroom"
		case 2011:
			return CommonAreaNamespaceTag.GuestBedroom.tag; // "guestbedrroom"
		default:
			return null;
	}
}

function populateAreaNamespaceTag(room: RoomMapping): number | null {
	if (room.areaType !== undefined) {
		return room.areaType;
	}

	if (room.tag && room.tag > 0) {
		switch (room.tag) {
			case 1:
				return CommonAreaNamespaceTag.Bedroom.tag;
			case 2:
				return CommonAreaNamespaceTag.PrimaryBedroom.tag;
			case 3:
				return CommonAreaNamespaceTag.GuestBedroom.tag;
			case 6:
				return CommonAreaNamespaceTag.LivingRoom.tag;
			case 7:
				return CommonAreaNamespaceTag.Balcony.tag;
			case 9:
				return CommonAreaNamespaceTag.Study.tag;
			case 14:
				return CommonAreaNamespaceTag.Kitchen.tag;
			default:
				return null;
		}
	}
	return null;
}
