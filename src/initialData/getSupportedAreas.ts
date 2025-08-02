import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoomMap } from '../model/RoomMap.js';
import { Room } from '../roborockCommunication/Zmodel/room.js';
import { randomInt } from 'node:crypto';
import { RoomIndexMap } from '../model/roomIndexMap.js';

export function getSupportedAreas(
  vacuumRooms: Room[],
  roomMap: RoomMap | undefined,
  enableMultipleMap = false,
  log?: AnsiLogger,
): { supportedAreas: ServiceArea.Area[]; supportedMaps: ServiceArea.Map[]; roomIndexMap: RoomIndexMap } {
  log?.debug('getSupportedAreas-vacuum room', debugStringify(vacuumRooms));
  log?.debug('getSupportedAreas-roomMap', roomMap ? debugStringify(roomMap) : 'undefined');

  const noVacuumRooms = !vacuumRooms || vacuumRooms.length === 0;
  const noRoomMap = !roomMap?.rooms || roomMap.rooms.length === 0;

  if (noVacuumRooms || noRoomMap) {
    if (noVacuumRooms) {
      log?.error('No rooms found');
    }
    if (noRoomMap) {
      log?.error('No room map found');
    }

    return {
      supportedAreas: [
        {
          areaId: 1,
          mapId: null,
          areaInfo: {
            locationInfo: {
              locationName: 'Unknown',
              floorNumber: null,
              areaType: null,
            },
            landmarkInfo: null,
          },
        },
      ],
      supportedMaps: [],
      roomIndexMap: new RoomIndexMap(new Map([[1, { roomId: 1, mapId: null }]])),
    };
  }
  const { supportedAreas, indexMap } = processValidData(enableMultipleMap, vacuumRooms, roomMap);
  const duplicated = findDuplicatedAreaIds(supportedAreas, log);

  if (duplicated) {
    return {
      supportedAreas: [
        {
          areaId: 2,
          mapId: null,
          areaInfo: {
            locationInfo: {
              locationName: 'Unknown - Duplicated Areas Found',
              floorNumber: null,
              areaType: null,
            },
            landmarkInfo: null,
          },
        },
      ],
      supportedMaps: [],
      roomIndexMap: new RoomIndexMap(new Map([[2, { roomId: 2, mapId: null }]])),
    };
  }

  const supportedMaps = getSupportedMaps(enableMultipleMap, supportedAreas, roomMap);

  log?.debug('getSupportedAreas - supportedAreas', debugStringify(supportedAreas));
  log?.debug('getSupportedAreas - supportedMaps', debugStringify(supportedMaps));
  const roomIndexMap = new RoomIndexMap(indexMap);
  return {
    supportedAreas,
    supportedMaps,
    roomIndexMap,
  };
}

function findDuplicatedAreaIds(areas: ServiceArea.Area[], log?: AnsiLogger): boolean {
  const seen = new Set<string>();
  const duplicates: { areaId: number; mapId: number }[] = [];

  for (const area of areas) {
    const key = `${area.areaId}=${area.mapId}`;
    if (seen.has(key)) {
      duplicates.push({ areaId: area.areaId, mapId: area.mapId ?? 0 });
    } else {
      seen.add(key);
    }
  }

  if (duplicates.length > 0 && log) {
    const duplicated = areas.filter(({ areaId, mapId }) => duplicates.some((y) => y.areaId === areaId && y.mapId === (mapId ?? 0)));
    log.error(`Duplicated areaId(s) found: ${debugStringify(duplicated)}`);
  }

  return duplicates.length > 0;
}

function processValidData(
  enableMultipleMap: boolean,
  vacuumRooms: Room[],
  roomMap?: RoomMap,
): { supportedAreas: ServiceArea.Area[]; indexMap: Map<number, { roomId: number; mapId: number | null }> } {
  const indexMap = new Map<number, { roomId: number; mapId: number | null }>();
  const supportedAreas: ServiceArea.Area[] =
    roomMap?.rooms !== undefined && roomMap.rooms.length > 0
      ? roomMap.rooms.map((room, index) => {
          const locationName = room.displayName ?? vacuumRooms.find((r) => r.id === room.globalId || r.id === room.id)?.name ?? `Unknown Room ${randomInt(1000, 9999)}`;

          const areaId = enableMultipleMap ? index + 100 : room.id;
          const mapId = enableMultipleMap ? (room.mapId ?? null) : null;

          indexMap.set(areaId, { roomId: room.id, mapId: room.mapId ?? null });
          return {
            areaId: areaId,
            mapId: mapId,
            areaInfo: {
              locationInfo: {
                locationName: locationName,
                floorNumber: room.mapId ?? null,
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

function getSupportedMaps(enableMultipleMap: boolean, supportedAreas: ServiceArea.Area[], roomMap?: RoomMap): ServiceArea.Map[] {
  if (enableMultipleMap) {
    return (
      roomMap?.mapInfo?.map((map) => ({
        mapId: map.id,
        name: map.name ?? `Map ${map.id}`,
      })) ?? []
    );
  }

  return [];
}
