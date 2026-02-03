import { RoomEntity } from '../../core/domain/entities/Room.js';
import { Device } from './device.js';
import { Product } from './product.js';

export interface Home {
  id: number;
  name: string;
  products: Product[];
  devices: Device[];
  receivedDevices: Device[];
  rooms: RoomEntity[];
}
