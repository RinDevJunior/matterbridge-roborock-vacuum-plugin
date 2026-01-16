import { MapInfo } from '../initialData/getSupportedAreas.js';

export class RoomIndexMap {
  public indexMap: Map<number, MapInfo>;
  public roomMap: Map<string, number>;

  constructor(roomMap: Map<number, MapInfo>) {
    this.indexMap = roomMap;
    this.roomMap = new Map();
    for (const [areaId, r] of roomMap.entries()) {
      this.roomMap.set(`${r.roomId}:${r.mapId}`, areaId);
    }
  }

  public getAreaId(roomId: number, mapId: number): number | undefined {
    const areaId = this.roomMap.get(`${roomId}:${mapId}`);
    if (areaId === undefined) {
      return undefined;
    }
    return areaId;
  }

  public getRoomId(areaId: number): number | undefined {
    return this.indexMap.get(areaId)?.roomId;
  }
}
