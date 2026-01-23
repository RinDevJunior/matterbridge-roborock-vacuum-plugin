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

  public get(index: Protocol): unknown {
    return this.body?.get(index);
  }

  public isForProtocol(protocol: Protocol): boolean {
    return this.header?.isForProtocol(protocol) ?? false;
  }

  public isForProtocols(protocols: Protocol[]): boolean {
    if (!this.header) return false;
    return protocols.some((p) => this.header.isForProtocol(p));
  }

  public isForStatus(status: number): boolean {
    return this.body?.get(status) !== undefined;
  }
}
