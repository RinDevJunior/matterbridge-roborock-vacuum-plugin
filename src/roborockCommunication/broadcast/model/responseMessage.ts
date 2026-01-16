import { HeaderMessage } from './headerMessage.js';
import { Protocol } from './protocol.js';
import { ResponseBody } from './responseBody.js';

export class ResponseMessage {
  readonly duid: string;
  readonly body?: ResponseBody;
  readonly header: HeaderMessage;

  constructor(duid: string, header: HeaderMessage, body?: ResponseBody) {
    this.duid = duid;
    this.body = body;
    this.header = header;
  }

  public get(index: number | string | Protocol): unknown | undefined {
    return this.body?.get(index);
  }

  public isForProtocol(protocol: number | string | Protocol): boolean {
    return this.header && this.header.isForProtocol(protocol);
  }
}
