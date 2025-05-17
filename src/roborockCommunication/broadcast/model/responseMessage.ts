import { Dps, DpsPayload } from './dps.js';

export class ResponseMessage {
  readonly duid: string;
  readonly dps: Dps;

  constructor(duid: string, dps: Dps) {
    this.duid = duid;
    this.dps = dps;
  }

  contain(index: number | string): boolean {
    return this.dps[index.toString()] !== undefined;
  }

  get(index: number | string): string | DpsPayload {
    return this.dps[index.toString()];
  }
}
