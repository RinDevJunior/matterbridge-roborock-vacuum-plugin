import { Dps } from './dps.js';
import { Protocol } from './protocol.js';

export class ResponseBody {
  data: Dps;

  constructor(data: Dps) {
    this.data = data;
  }

  public get(index: number | string | Protocol): unknown | undefined {
    return this.data !== undefined && this.data !== null ? this.data[index.toString()] : undefined;
  }
}
