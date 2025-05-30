import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import RoomMap from '../model/RoomMap.js';
import { Room } from '../roborockCommunication/Zmodel/room.js';

/*
rooms = [
  { id: 123456, name: 'Study' },
  { id: 123457, name: 'Bedroom' },
  { id: 123458, name: 'Kitchen' },
  { id: 123459, name: 'Living room' }
]
roomMap = {
  rooms: [
    { id: 1, globalId: "123456", displayName: undefined },
    { id: 2, globalId: "123457", displayName: undefined },
    { id: 3, globalId: "123458", displayName: undefined },
    { id: 4, globalId: "123459", displayName: undefined },
  ],
};
*/

export function getSupportedAreas(rooms: Room[], roomMap: RoomMap | undefined, log?: AnsiLogger): ServiceArea.Area[] {
  log?.debug('getSupportedAreas', debugStringify(rooms));
  log?.debug('getSupportedAreas', roomMap ? debugStringify(roomMap) : 'undefined');

  if (!rooms || rooms.length === 0 || !roomMap?.rooms || roomMap.rooms.length == 0) {
    log?.error('No rooms found');
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

  const supportedAreas: ServiceArea.Area[] = rooms.map((room, index) => {
    return {
      areaId: roomMap.getRoomId(room.id) ?? index + 1,
      mapId: null,
      areaInfo: {
        locationInfo: {
          locationName: room.name,
          floorNumber: null,
          areaType: null,
        },
        landmarkInfo: null,
      },
    };
  });

  const duplicated = findDuplicatedAreaIds(supportedAreas, log);

  return duplicated
    ? [
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
