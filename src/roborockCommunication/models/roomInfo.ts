import decodeComponent from '../helper/nameDecoder.js';
import { Room } from './room.js';

interface RoomEntry {
  id: number;
  name: string | undefined;
}

export class RoomInfo {
  readonly rooms: RoomEntry[] = [];

  constructor(roomInfo: Room[], roomData: number[][]) {
    this.rooms = roomData
      .map((entry) => {
        return { id: entry[0], globalId: entry[1] };
      })
      .map((entry) => {
        return {
          id: entry.id,
          room: roomInfo.find((el) => el.id == entry.globalId),
        };
      })
      .map((entry) => {
        return {
          id: entry.id,
          name: decodeComponent(entry.room?.name)?.toLowerCase(),
        };
      });
  }
}
