import { AnsiLogger } from 'node-ansi-logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import RoomMap from '../model/RoomMap.js';
import Room from '../roborockCommunication/Zmodel/room.js';

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

export function getSupportedAreas(
  rooms: Room[],
  roomMap: RoomMap | undefined,
  log?: AnsiLogger,
): {
  supportedAreas: ServiceArea.Area[];
  defaultSelectedAreas: number;
} {
  if (!rooms || rooms.length === 0 || !roomMap) {
    log?.error('No rooms found');
    return { supportedAreas: [], defaultSelectedAreas: 0 };
  }

  log?.debug('getSupportedAreas', JSON.stringify(rooms));
  log?.debug('getSupportedAreas', JSON.stringify(roomMap));

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
  const defaultSelectedAreas = supportedAreas.find((room) => room.areaInfo.locationInfo?.locationName === 'Living Room')?.areaId ?? roomMap.rooms[0].id;

  log?.debug('getSupportedAreas', JSON.stringify(supportedAreas));

  return { supportedAreas, defaultSelectedAreas };
}
