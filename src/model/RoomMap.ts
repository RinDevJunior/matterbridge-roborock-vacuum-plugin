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

import { MapRoom } from '../roborockCommunication/Zmodel/mapInfo.js';
import { Room } from '../roborockCommunication/Zmodel/room.js';

export interface RoomMapEntry {
  id: number;
  globalId: number | undefined;
  displayName?: string;
  alternativeId: string;
  mapId?: number;
}

export interface MapInfo {
  id: number;
  name: string | undefined;
}

export class RoomMap {
  readonly rooms: RoomMapEntry[];
  readonly mapInfo?: MapInfo[];

  constructor(roomData: MapRoom[], rooms: Room[], mapInfo: MapInfo[]) {
    this.rooms = roomData.map(({ id, globalId, tag, mapId }) => {
      const room = rooms.find((r) => Number(r.id) === Number(globalId) || Number(r.id) === Number(id));
      return {
        id,
        globalId: globalId !== undefined ? Number(globalId) : undefined,
        displayName: room?.name,
        alternativeId: `${id}${tag}`,
        mapId,
      };
    });

    this.mapInfo = mapInfo;
  }

  // Optionally, add utility methods for clarity
  // getGlobalId(id: number): number | undefined {
  //   return this.rooms.find((r) => r.id === id)?.globalId;
  // }

  // getRoomId(globalId: number): number | undefined {
  //   return this.rooms.find((r) => r.globalId === globalId)?.id;
  // }
}
