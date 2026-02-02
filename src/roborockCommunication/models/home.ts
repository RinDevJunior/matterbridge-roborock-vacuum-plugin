import { RoomEntity } from '../../core/domain/entities/Room.js';
import { Device } from './device.js';
import { Product } from './product.js';

export class Home {
  // id: number;
  // name: string;

  // products: Product[];
  // devices: Device[];
  // receivedDevices: Device[];
  // rooms: RoomEntity[];

  constructor(
    public id: number,
    public name: string,
    public products: Product[],
    public devices: Device[],
    public receivedDevices: Device[],
    public rooms: RoomEntity[],
  ) {}

  get hasRooms() {
    return this.rooms && this.rooms.length > 0;
  }

  get allDevices(): Device[] {
    return [...this.devices, ...this.receivedDevices];
  }
}
