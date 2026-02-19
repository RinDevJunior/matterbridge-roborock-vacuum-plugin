import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoomMap } from '../model/RoomMap.js';
import { Room } from '../roborockCommunication/Zmodel/room.js';
import { randomInt } from 'node:crypto';
import { RoomIndexMap } from '../model/roomIndexMap.js';

export function getSupportedAreas(
  vacuumRooms: Room[],
  roomMap: RoomMap | undefined,
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

    const roomIndexMap = new RoomIndexMap(new Map([[1, { roomId: 1, mapId: 0 }]]));

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
      roomIndexMap,
    };
  }

  const indexMap = new Map<number, { roomId: number; mapId: number }>();
  const supportedAreas: ServiceArea.Area[] = roomMap.rooms.map((room, index) => {
    const locationName = room.displayName ?? vacuumRooms.find((r) => r.id === room.globalId || r.id === room.id)?.name ?? `Unknown Room ${randomInt(1000, 9999)}`;
    const areaId = index + 1;
    indexMap.set(areaId, { roomId: room.id, mapId: room.mapId ?? 0 });

    return {
      areaId: areaId,
      mapId: room.mapId ?? null,
      areaInfo: {
        locationInfo: {
          locationName: `${locationName} - ${areaId}`,
          floorNumber: null,
          areaType: null,
        },
        landmarkInfo: null,
      },
    };
  });

  const duplicated = findDuplicatedAreaIds(supportedAreas, log);
  const roomIndexMap = new RoomIndexMap(indexMap);

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
      roomIndexMap,
    };
  }

  const supportedMaps =
    roomMap.mapInfo?.map((map) => ({
      mapId: map.id,
      name: map.name ?? `Map ${map.id}`,
    })) ?? [];

  // const supportedMaps = supportedAreas.map((area) => ({
  //   mapId: area.mapId ?? 0,
  //   name: `Map ${area.mapId ?? 0}`,
  // }));

  log?.debug('getSupportedAreas - supportedAreas', debugStringify(supportedAreas));
  log?.debug('getSupportedAreas - supportedMaps', debugStringify(supportedMaps));
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
