import { AreaInfo, SegmentInfo } from '../../../initialData/getSupportedAreas.js';

export class RoomIndexMap {
  constructor(
    public readonly areaInfo: Map<number, AreaInfo>,
    public readonly roomInfo: Map<string, SegmentInfo>,
  ) {}

  // TODO: find a way to get map id value
  public getAreaId(roomId: number, mapId: number): number | undefined {
    return this.roomInfo.get(`${roomId}-${mapId}`)?.areaId;
  }

  public getAreaIdV2(roomId: number): number | undefined {
    for (const key of this.roomInfo.keys()) {
      if (key.startsWith(`${roomId}-`)) {
        return this.roomInfo.get(key)?.areaId;
      }
    }

    return undefined;
  }

  public getRoomId(areaId: number): number | undefined {
    return this.areaInfo.get(areaId)?.roomId;
  }
}
