import { MapRoom, Room } from '../roborockCommunication/models/index.js';

export interface RoomMapEntry {
  id: number;
  globalId: number | undefined;
  displayName: string;
  alternativeId: string;
  mapId?: number;
}

export interface MapInfo {
  id: number;
  name: string | undefined;
}

export class RoomMap {
  rooms: RoomMapEntry[];
  mapInfo?: MapInfo[];

  constructor(roomData: MapRoom[], rooms: Room[], mapInfo: MapInfo[], enableMultipleMap: boolean) {
    const mapid = mapInfo[0]?.id ?? 0;
    const roomDataTmp = enableMultipleMap ? roomData : roomData.filter((room) => room.mapId === undefined || room.mapId === mapid);

    this.rooms = roomDataTmp.map(({ id, globalId, tag, mapId }) => {
      const room = rooms.find((r) => Number(r.id) === Number(globalId) || Number(r.id) === Number(id));
      return {
        id,
        globalId: globalId !== undefined ? Number(globalId) : undefined,
        displayName: room?.name ?? `Room ${id}`,
        alternativeId: `${id}${tag ?? ''}`,
        mapId,
      };
    });

    this.mapInfo = mapInfo;
  }
}
