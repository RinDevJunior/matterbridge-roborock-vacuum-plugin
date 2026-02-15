import { Dps } from './dps.js';
import { Protocol } from './protocol.js';

export class ResponseBody {
  constructor(public readonly data: Dps) {}

  public get(index: number | string | Protocol): unknown {
    return this.data !== undefined ? this.data[index.toString()] : undefined;
  }
}
