import { MapInfo } from '../../application/models/MapInfo.js';
import { RoomMap } from '../../application/models/RoomMap.js';
import { RoomEntity } from './Room.js';

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
  ) {}

  public get allRooms(): RoomEntity[] {
    return this.roomMap.rooms.map((room) => new RoomEntity(room.id, room.iot_name));
  }
}
