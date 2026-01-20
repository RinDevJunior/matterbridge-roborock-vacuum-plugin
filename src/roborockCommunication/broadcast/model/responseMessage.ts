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

  public get<T>(index: Protocol): T {
    return this.body?.get(index) as T;
  }

  public isForProtocol(protocol: Protocol): boolean {
    return this.header && this.header.isForProtocol(protocol);
  }

  public isForProtocols(protocols: Protocol[]): boolean {
    return this.header && protocols.some((protocol) => this.header.isForProtocol(protocol));
  }

  public isForStatus(status: number): boolean {
    return this.body !== undefined && this.body.get(status) !== undefined;
  }

  public isForStatuses(statuses: number[]): boolean {
    return statuses.some((status) => this.isForStatus(status));
  }
}
