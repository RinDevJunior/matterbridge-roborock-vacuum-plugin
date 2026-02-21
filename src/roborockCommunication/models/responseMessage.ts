import { HeaderMessage } from './headerMessage.js';
import { Protocol } from './protocol.js';
import { ResponseBody } from './responseBody.js';

export class ResponseMessage {
  constructor(
    public readonly duid: string,
    public readonly header: HeaderMessage,
    public readonly body: ResponseBody | undefined,
  ) {}

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

  public isSimpleOkResponse(): boolean {
    const rpcData = this.get(Protocol.rpc_response) as { result?: unknown } | undefined;
    if (!rpcData || !rpcData.result) return false;
    if (!Array.isArray(rpcData.result)) return false;
    return rpcData.result.length === 1 && rpcData.result[0] === 'ok';
  }
}
