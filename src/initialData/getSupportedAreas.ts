import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoomMap } from '../model/RoomMap.js';
import { Room } from '../roborockCommunication/Zmodel/room.js';
import { randomInt } from 'node:crypto';

export function getSupportedAreas(vacuumRooms: Room[], roomMap: RoomMap | undefined, log?: AnsiLogger): ServiceArea.Area[] {
  log?.debug('getSupportedAreas-vacuum room', debugStringify(vacuumRooms));
  log?.debug('getSupportedAreas-roomMap', roomMap ? debugStringify(roomMap) : 'undefined');

  if (!vacuumRooms || vacuumRooms.length === 0 || !roomMap?.rooms || roomMap.rooms.length == 0) {
    if (!vacuumRooms || vacuumRooms.length === 0) {
      log?.error('No rooms found');
    }

    if (!roomMap || !roomMap.rooms || roomMap.rooms.length == 0) {
      log?.error('No room map found');
    }

    return [
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
    ];
  }

  const supportedAreas: ServiceArea.Area[] = roomMap.rooms.map((room) => {
    return {
      areaId: room.id,
      mapId: null,
      areaInfo: {
        locationInfo: {
          locationName: room.displayName ?? vacuumRooms.find((r) => r.id == room.globalId || r.id == room.id)?.name ?? `Unknown Room ${randomInt(1000, 9999)}`,
          floorNumber: null,
          areaType: null,
        },
        landmarkInfo: null,
      },
    };
  });

  log?.debug('getSupportedAreas - supportedAreas', debugStringify(supportedAreas));

  const duplicated = findDuplicatedAreaIds(supportedAreas, log);

  return duplicated
    ? [
        {
          areaId: 2,
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
      ]
    : supportedAreas;
}

function findDuplicatedAreaIds(areas: ServiceArea.Area[], log?: AnsiLogger): boolean {
  const seen = new Set<number>();
  const duplicates: number[] = [];
  for (const area of areas) {
    if (seen.has(area.areaId)) {
      duplicates.push(area.areaId);
    } else {
      seen.add(area.areaId);
    }
  }
  if (duplicates.length > 0 && log) {
    const duplicated = areas.filter((x) => duplicates.includes(x.areaId));
    log.error(`Duplicated areaId(s) found: ${debugStringify(duplicated)}`);
  }
  return duplicates.length > 0;
}
