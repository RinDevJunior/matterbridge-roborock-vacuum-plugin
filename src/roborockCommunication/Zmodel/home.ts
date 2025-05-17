import Product from './product.js';
import Device from './device.js';
import Room from './room.js';

export default interface Home {
  id: number;
  name: string;

  products: Product[];
  devices: Device[];
  receivedDevices: Device[];
  rooms: Room[];
}
