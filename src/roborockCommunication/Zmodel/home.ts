import { Device } from './device.js';
import { Product } from './product.js';
import { Room } from './room.js';

export interface Home {
  id: number;
  name: string;

  products: Product[];
  devices: Device[];
  receivedDevices: Device[];
  rooms: Room[];
}
