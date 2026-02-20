import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoomIndexMap, RoomMapping } from '../core/application/models/index.js';
import { randomInt } from 'node:crypto';
import { DEFAULT_AREA_ID_UNKNOWN, RANDOM_ROOM_MIN, RANDOM_ROOM_MAX } from '../constants/index.js';
import { HomeEntity } from '../core/domain/entities/Home.js';
import { AreaNamespaceTag } from 'matterbridge/matter';

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

/**
 * Convert vacuum rooms and room map to Matter ServiceArea areas.
 * Handles single and multiple map configurations.
 * @param homeInFo - Home entity containing room and map information
 * @param logger - Logger for debugging and error reporting
 * @returns Supported areas, maps, and room index mapping
 */
export function getSupportedAreas(homeInFo: HomeEntity, logger: AnsiLogger): SupportedAreasResult {
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

  const { supportedAreas, areaInfos, roomInfos } = processValidData(homeInFo);

  const supportedMaps = homeInFo.mapInfo.maps.map((map) => ({
    mapId: map.id,
    name: map.name ?? `Map ${map.id}`,
  }));

  logger.debug('getSupportedAreas - supportedAreas', debugStringify(supportedAreas));
  logger.debug('getSupportedAreas - supportedMaps', debugStringify(supportedMaps));
  const roomIndexMap = new RoomIndexMap(areaInfos, roomInfos);

  return {
    supportedAreas,
    supportedMaps,
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

function populateAreaNamespaceTag(room: RoomMapping): number | null {
  if (room.tag && room.tag > 0) {
    switch (room.tag) {
      case 1:
      case 2:
        return AreaNamespaceTag.Bedroom.tag;
      case 3:
        return AreaNamespaceTag.GuestBedroom.tag;
      case 6:
        return AreaNamespaceTag.LivingRoom.tag;
      case 7:
        return AreaNamespaceTag.Balcony.tag;
      case 9:
        return AreaNamespaceTag.Study.tag;
      case 14:
        return AreaNamespaceTag.Kitchen.tag;
      default:
        return null;
    }
  }
  return null;
}
