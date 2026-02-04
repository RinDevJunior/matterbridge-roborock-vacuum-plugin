import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoomIndexMap, MapEntry } from '../core/application/models/index.js';
import { randomInt } from 'node:crypto';
import { DEFAULT_AREA_ID_UNKNOWN, DEFAULT_AREA_ID_ERROR, MULTIPLE_MAP_AREA_ID_OFFSET, RANDOM_ROOM_MIN, RANDOM_ROOM_MAX } from '../constants/index.js';
import { HomeEntity } from '../core/domain/entities/Home.js';

/**
 * Create a fallback service area for error cases.
 * @param areaId - Unique identifier for the area
 * @param reason - Reason for the fallback area creation
 * @returns Fallback service area configuration
 */
function createFallbackArea(areaId: number, reason: string): ServiceArea.Area {
  return {
    areaId,
    mapId: null,
    areaInfo: {
      locationInfo: {
        locationName: `Unknown - ${reason}`,
        floorNumber: null,
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
  logger.debug('getSupportedAreas-vacuum room', debugStringify(homeInFo.allRooms));
  logger.debug('getSupportedAreas-roomMap', homeInFo.roomMap ? debugStringify(homeInFo.roomMap) : 'undefined');

  const noVacuumRooms = !homeInFo.allRooms || homeInFo.allRooms.length === 0;
  const noRoomMap = !homeInFo.roomMap?.rooms || homeInFo.roomMap.rooms.length === 0;

  if (noVacuumRooms || noRoomMap) {
    if (noVacuumRooms) {
      logger.error('No rooms found');
    }
    if (noRoomMap) {
      logger.error('No room map found');
    }

    return {
      supportedAreas: [createFallbackArea(DEFAULT_AREA_ID_UNKNOWN, 'No Rooms')],
      supportedMaps: [],
      roomIndexMap: new RoomIndexMap(new Map([[DEFAULT_AREA_ID_UNKNOWN, { roomId: DEFAULT_AREA_ID_UNKNOWN, mapId: null }]])),
    };
  }
  const { supportedAreas, indexMap } = processValidData(homeInFo);
  const duplicated = findDuplicatedAreaIds(supportedAreas, logger);

  if (duplicated) {
    return {
      supportedAreas: [createFallbackArea(DEFAULT_AREA_ID_ERROR, 'Duplicated Areas Found')],
      supportedMaps: [],
      roomIndexMap: new RoomIndexMap(new Map([[DEFAULT_AREA_ID_ERROR, { roomId: DEFAULT_AREA_ID_ERROR, mapId: null }]])),
    };
  }

  const supportedMaps = getSupportedMaps(homeInFo.isMultiMapEnabled, supportedAreas, homeInFo.mapInfo.maps);

  logger.debug('getSupportedAreas - supportedAreas', debugStringify(supportedAreas));
  logger.debug('getSupportedAreas - supportedMaps', debugStringify(supportedMaps));
  const roomIndexMap = new RoomIndexMap(indexMap);
  return {
    supportedAreas,
    supportedMaps,
    roomIndexMap,
  };
}

interface SupportedArea {
  areaId: number;
  mapId: number;
}

function findDuplicatedAreaIds(areas: ServiceArea.Area[], logger: AnsiLogger): boolean {
  const seen = new Set<string>();
  const duplicates: SupportedArea[] = [];

  for (const area of areas) {
    const key = `${area.areaId}=${area.mapId}`;
    if (seen.has(key)) {
      duplicates.push({ areaId: area.areaId, mapId: area.mapId ?? 0 });
    } else {
      seen.add(key);
    }
  }

  if (duplicates.length > 0) {
    const duplicated = areas.filter(({ areaId, mapId }) => duplicates.some((y) => y.areaId === areaId && y.mapId === (mapId ?? 0)));
    logger.error(`Duplicated areaId(s) found: ${debugStringify(duplicated)}`);
  }

  return duplicates.length > 0;
}

export interface MapInfo {
  roomId: number;
  mapId: number | null;
}

interface ProcessedData {
  supportedAreas: ServiceArea.Area[];
  indexMap: Map<number, MapInfo>;
}

function processValidData(homeInFo: HomeEntity): ProcessedData {
  const indexMap = new Map<number, MapInfo>();
  const supportedAreas: ServiceArea.Area[] =
    homeInFo.roomMap.rooms.length > 0
      ? homeInFo.roomMap.rooms.map((room, index) => {
          const locationName =
            room.iot_name ??
            homeInFo.allRooms.find((r) => String(r.id) === room.iot_name_id || r.id === room.id)?.name ??
            `Unknown Room ${randomInt(RANDOM_ROOM_MIN, RANDOM_ROOM_MAX)}`;

          const areaId = homeInFo.isMultiMapEnabled ? index + MULTIPLE_MAP_AREA_ID_OFFSET : room.id;
          const mapId = homeInFo.isMultiMapEnabled ? (room.iot_map_id ?? null) : null;

          indexMap.set(areaId, { roomId: room.id, mapId: room.iot_map_id ?? null });
          return {
            areaId: areaId,
            mapId: mapId,
            areaInfo: {
              locationInfo: {
                locationName: locationName,
                floorNumber: room.iot_map_id ?? null,
                areaType: null,
              },
              landmarkInfo: null,
            },
          };
        })
      : [];
  return {
    supportedAreas,
    indexMap,
  };
}

function getSupportedMaps(enableMultipleMap: boolean, _supportedAreas: ServiceArea.Area[], mapInfos: MapEntry[]): ServiceArea.Map[] {
  if (enableMultipleMap) {
    return mapInfos.map((map) => ({
      mapId: map.id,
      name: map.name ?? `Map ${map.id}`,
    }));
  }

  return [];
}
