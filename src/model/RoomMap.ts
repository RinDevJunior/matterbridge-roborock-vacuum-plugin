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

import { Room } from '../roborockCommunication/Zmodel/room.js';

export interface RoomMapEntry {
  id: number;
  globalId: number | undefined;
  displayName?: string;
  alternativeId: string;
}

export class RoomMap {
  readonly rooms: RoomMapEntry[];

  constructor(roomData: number[][], rooms: Room[]) {
    this.rooms = roomData.map(([id, globalId, altId]) => {
      const room = rooms.find((r) => Number(r.id) === Number(globalId) || Number(r.id) === Number(id));
      return {
        id,
        globalId: globalId !== undefined ? Number(globalId) : undefined,
        displayName: room?.name,
        alternativeId: `${id}${altId}`,
      };
    });
  }

  // Optionally, add utility methods for clarity
  // getGlobalId(id: number): number | undefined {
  //   return this.rooms.find((r) => r.id === id)?.globalId;
  // }

  // getRoomId(globalId: number): number | undefined {
  //   return this.rooms.find((r) => r.globalId === globalId)?.id;
  // }
}
