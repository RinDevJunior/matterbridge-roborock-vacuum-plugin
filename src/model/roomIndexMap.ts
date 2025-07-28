export class RoomIndexMap {
  private indexMap: Map<number, { roomId: number; mapId: number | null }>;
  private roomMap: Map<number, number>;

  constructor(roomMap: Map<number, { roomId: number; mapId: number | null }>) {
    this.indexMap = roomMap;
    this.roomMap = new Map();
    for (const [areaId, { roomId }] of roomMap.entries()) {
      this.roomMap.set(roomId, areaId);
    }
  }

  public getAreaId(roomId: number): number | undefined {
    return this.roomMap.get(roomId);
  }

  public getRoomId(areaId: number): number | undefined {
    return this.indexMap.get(areaId)?.roomId;
  }
}
