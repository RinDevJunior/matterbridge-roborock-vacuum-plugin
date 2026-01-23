import type { DeviceEntity } from './Device.js';
import type { RoomEntity } from './Room.js';

/**
 * Domain entity representing a Roborock home.
 * A home contains devices and rooms.
 */
export interface HomeEntity {
  /** Unique home identifier */
  readonly id: number;

  /** Home name */
  readonly name: string;

  /** Devices in this home */
  readonly devices: DeviceEntity[];

  /** Rooms in this home */
  readonly rooms: RoomEntity[];
}
