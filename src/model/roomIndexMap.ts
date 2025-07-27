export class RoomIndexMap {
  private indexMap: Map<number, { roomId: number; mapId: number }>;
  private roomMap: Map<number, number>;

  constructor(roomMap: Map<number, { roomId: number; mapId: number }>) {
    this.indexMap = roomMap;
    this.roomMap = new Map();
    for (const [areaId, { roomId }] of roomMap.entries()) {
      this.roomMap.set(roomId, areaId);
    }
  }

  public getRoomIndex(roomId: number): number | undefined {
    return this.roomMap.get(roomId);
  }
}
