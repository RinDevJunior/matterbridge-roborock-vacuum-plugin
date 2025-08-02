export class RoomIndexMap {
  public indexMap: Map<number, { roomId: number; mapId: number | null }>;
  public roomMap: Map<string, number>;

  constructor(roomMap: Map<number, { roomId: number; mapId: number | null }>) {
    this.indexMap = roomMap;
    this.roomMap = new Map();
    for (const [areaId, { roomId, mapId }] of roomMap.entries()) {
      this.roomMap.set(`${roomId}:${mapId}`, areaId);
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
