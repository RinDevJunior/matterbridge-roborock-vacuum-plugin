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

export default class RoomMap {
  readonly rooms: {
    id: number;
    globalId: number | undefined;
    displayName: string | undefined;
    alternativeId: string;
  }[] = [];

  constructor(roomData: number[][], rooms: Room[]) {
    this.rooms = roomData.map((entry) => {
      return {
        id: entry[0],
        globalId: Number(entry[1]),
        displayName: rooms.find((r) => Number(r.id) == Number(entry[1]))?.name,
        alternativeId: `${entry[0]}${entry[2]}`,
      };
    });
  }

  // getGlobalId(id: number): number | undefined {
  //   return this.rooms.find((r) => Number(r.id) == Number(id))?.globalId;
  // }

  // getRoomId(globalId: number): number | undefined {
  //   return this.rooms.find((r) => Number(r.globalId) == Number(globalId))?.id;
  // }
}
