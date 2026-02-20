import { MapInfo } from '../../application/models/MapInfo.js';
import { RoomMap } from '../../application/models/RoomMap.js';
import { RoomMapping } from '../../application/models/RoomMapping.js';

/**
 * Domain entity representing a Roborock home.
 * A home contains devices and rooms.
 */
export class HomeEntity {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly roomMap: RoomMap,
    public readonly mapInfo: MapInfo,
    public activeMapId: number,
  ) {}

  public get rawRooms(): RoomMapping[] {
    return this.roomMap.rooms.length > 0 ? this.roomMap.rooms : [];
  }
}
