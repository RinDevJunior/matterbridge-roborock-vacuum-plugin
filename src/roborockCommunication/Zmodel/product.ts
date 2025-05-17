import DeviceSchema from './deviceSchema.js';

export default interface Product {
  id: string;
  name: string;
  model: string;
  category: string;
  schema: DeviceSchema[];
}
